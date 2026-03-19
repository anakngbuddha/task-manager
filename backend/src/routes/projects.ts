import { FastifyInstance } from 'fastify'
import { projectService } from '../services/project.service.js'
import { authenticate } from '../middlewares/authenticate.js'
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
    const project = await projectService.getById(id)
    if (!project) return reply.status(404).send({ error: 'Project not found' })
    return project
  })

  app.post('/projects', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { name } = createProjectSchema.parse(req.body)
    const project = await projectService.create(name, req.authUser.id)
    return reply.status(201).send(project)
  })

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
})

  app.patch('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = updateProjectSchema.parse(req.body)
    return projectService.update(id, data)
  })

  app.delete('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
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