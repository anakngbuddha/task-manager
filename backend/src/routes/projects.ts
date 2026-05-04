import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { projectService } from '../services/project.service.js'
import { authenticate } from '../middlewares/authenticate.js'
import { idempotencyPreHandler } from '../middlewares/idempotency.js'
import { z } from 'zod'
import { requireProjectRole } from '../services/projectAuth.service.js'
import { dashboardLayoutService, WIDGET_TYPES } from '../services/dashboardLayout.service.js'
import { prisma } from '../lib/prisma.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

const updateRoleSchema = z.object({
  // Master admins can only assign these roles (no master-admin promotion via UI/API).
  role: z.enum(['PROJECT_MANAGER', 'MEMBER']),
})

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', {
    preHandler: authenticate,
  }, async (req) => {
    return projectService.getAllForUser(req.authUser.id)
  })

  app.get('/projects/dashboard', {
    preHandler: authenticate,
  }, async (req) => {
    return projectService.getDashboardForUser(req.authUser.id)
  })

  app.get('/projects/pending-deadlines', {
    preHandler: authenticate,
  }, async (req) => {
    const query = req.query as { daysAhead?: string; daysBehind?: string; limit?: string; includeCompleted?: string }
    const daysAhead = Math.min(Math.max(Number(query.daysAhead) || 14, 1), 3650)
    const daysBehind = Math.min(Math.max(Number(query.daysBehind) || 0, 0), 3650)
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 5000)
    const includeCompleted = query.includeCompleted === 'true'
    return projectService.getPendingDeadlines(req.authUser.id, daysAhead, daysBehind, limit, includeCompleted)
  })

  // GET /api/projects/:projectId/dashboard-layout
  app.get(
    '/projects/:projectId/dashboard-layout',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const layout = await dashboardLayoutService.getOrCreateLayout(req.authUser.id, projectId)
      return reply.status(200).send({ layout })
    }
  )

  // PATCH /api/projects/:projectId/dashboard-layout
  const widgetTypeSchema = z.enum(WIDGET_TYPES)
  const dashboardLayoutSchema = z.object({
    layout: z.array(
      z.object({
        id: z.string(),
        type: widgetTypeSchema,
        position: z.object({
          x: z.number().int().nonnegative(),
          y: z.number().int().nonnegative(),
        }),
        size: z.object({
          w: z.number().int().min(1).max(2),
          h: z.number().int().min(1).max(12),
        }),
      })
    ),
  })

  app.patch(
    '/projects/:projectId/dashboard-layout',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }
      const body = dashboardLayoutSchema.parse(req.body)

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const layout = await dashboardLayoutService.updateLayout(req.authUser.id, projectId, body.layout)
      return reply.status(200).send({ layout })
    }
  )

  app.get('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await requireProjectRole(id, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const project = await projectService.getById(id)
    if (!project) return reply.status(404).send({ error: 'Project not found' })
    return project
  })

  app.post('/projects', {
    preHandler: [authenticate, idempotencyPreHandler('projects.create')],
  }, async (req, reply) => {
    const { name } = createProjectSchema.parse(req.body)

    try {
      const project = await prisma.$transaction(
        async (tx) => {
          const existingProjects = await tx.project.findMany({
            where: {
              name,
              status: 'ACTIVE',
              members: { some: { userId: req.authUser.id } },
            },
          })

          if (existingProjects.length > 0) {
            return null
          }

          return tx.project.create({
            data: {
              name,
              members: { create: { userId: req.authUser.id, role: 'MASTER_ADMIN' } },
            },
            include: { members: true },
          })
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      )

      if (!project) {
        return reply.status(400).send({
          error:
            'You already have an active project with this name. A project with the same name can only be created if the existing one is completed.',
        })
      }

      return reply.status(201).send(project)
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return reply.status(409).send({ error: 'Could not create project due to a conflict. Please try again.' })
      }
      throw e
    }
  })

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'AXED']).optional(),
  boardColumns: z.array(z.string()).optional(),
  githubStatusMap: z.record(z.string(), z.string().nullable()).nullable().optional(),
})

  app.patch('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await requireProjectRole(id, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const data = updateProjectSchema.parse(req.body)
    return projectService.update(id, data)
  })

  // ── Dependency diagram layout (persisted per project) ─────────────────
  app.get('/projects/:projectId/dependency-diagram-layout', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const row = await prisma.projectDependencyDiagramLayout.findUnique({
      where: { projectId },
      select: { layout: true, updatedAt: true },
    })
    if (!row) return reply.status(204).send()
    return reply.status(200).send(row)
  })

  const dependencyLayoutSchema = z.object({
    layout: z.any(),
  })

  app.put('/projects/:projectId/dependency-diagram-layout', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const body = dependencyLayoutSchema.parse(req.body)
    const row = await prisma.projectDependencyDiagramLayout.upsert({
      where: { projectId },
      update: { layout: body.layout },
      create: { projectId, layout: body.layout },
      select: { layout: true, updatedAt: true },
    })
    return reply.status(200).send(row)
  })

  app.delete('/projects/:projectId/dependency-diagram-layout', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await prisma.projectDependencyDiagramLayout.deleteMany({ where: { projectId } })
    return reply.status(204).send()
  })

  app.delete('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await requireProjectRole(id, req.authUser.id, ['MASTER_ADMIN'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await projectService.delete(id)
    return reply.status(204).send()
  })

  app.get('/projects/:projectId/members', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const membership = await projectService.getMemberRole(projectId, req.authUser.id)
    if (!membership) return reply.status(403).send({ error: 'Forbidden' })
    return projectService.listMembers(projectId)
  })

  app.patch('/projects/:projectId/members/:userId/role', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId, userId } = req.params as { projectId: string; userId: string }
    const { role } = updateRoleSchema.parse(req.body)

    // Disallow changing your own role (prevents MASTER_ADMIN self-demotion, etc.)
    if (req.authUser.id === userId) {
      return reply.status(403).send({ error: 'You cannot change your own role' })
    }

    const me = await projectService.getMemberRole(projectId, req.authUser.id)
    if (!me) return reply.status(403).send({ error: 'Forbidden' })

    // Permission rules:
    // - MASTER_ADMIN can change anyone's role (including other admins)
    // - PROJECT_MANAGER can only change MEMBER roles (cannot change MASTER_ADMIN/PROJECT_MANAGER)
    if (me.role === 'MEMBER') return reply.status(403).send({ error: 'Forbidden' })

    const target = await projectService.getMemberRole(projectId, userId)
    if (!target) return reply.status(404).send({ error: 'Member not found' })

    if (me.role === 'PROJECT_MANAGER') {
      if (target.role !== 'MEMBER') return reply.status(403).send({ error: 'Forbidden' })
      if (role !== 'MEMBER') return reply.status(403).send({ error: 'Forbidden' })
    }

    // Prevent removing the last MASTER_ADMIN (simple guard)
    // Note: we no longer allow assigning MASTER_ADMIN via this endpoint.
    if (target.role === 'MASTER_ADMIN') {
      const admins = await projectService.listMembers(projectId)
      const adminCount = admins.filter((m: any) => m.role === 'MASTER_ADMIN').length
      if (adminCount <= 1) return reply.status(400).send({ error: 'Project must have at least one MASTER_ADMIN' })
    }

    await projectService.updateMemberRole(projectId, userId, role)
    return { ok: true }
  })

  app.delete('/projects/:projectId/members/:userId', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId, userId } = req.params as { projectId: string; userId: string }

    // Only MASTER_ADMIN can remove members
    const me = await projectService.getMemberRole(projectId, req.authUser.id)
    if (!me) return reply.status(403).send({ error: 'Forbidden' })
    if (me.role !== 'MASTER_ADMIN') return reply.status(403).send({ error: 'Forbidden' })

    if (req.authUser.id === userId) {
      return reply.status(403).send({ error: 'You cannot remove yourself' })
    }

    const target = await projectService.getMemberRole(projectId, userId)
    if (!target) return reply.status(404).send({ error: 'Member not found' })

    // Prevent removing the last MASTER_ADMIN
    if (target.role === 'MASTER_ADMIN') {
      const admins = await projectService.listMembers(projectId)
      const adminCount = admins.filter((m: any) => m.role === 'MASTER_ADMIN').length
      if (adminCount <= 1) return reply.status(400).send({ error: 'Project must have at least one MASTER_ADMIN' })
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId, projectId } },
    })
    return reply.status(204).send()
  })
}