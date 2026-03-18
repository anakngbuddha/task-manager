import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { requireProjectRole } from '../services/projectAuth.service.js'
import { sprintService } from '../services/sprint.service.js'
import { SprintStatus } from '@prisma/client'

const createSprintSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(1000).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.nativeEnum(SprintStatus).optional(),
})

const updateSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(1000).nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.nativeEnum(SprintStatus).optional(),
})

const assignTasksSchema = z.object({
  taskIds: z.array(z.string()).min(0),
})

export async function sprintRoutes(app: FastifyInstance) {
  // GET /projects/:projectId/sprints
  app.get(
    '/projects/:projectId/sprints',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      // Any project member can view sprints
      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      return sprintService.list(projectId)
    }
  )

  // POST /projects/:projectId/sprints
  app.post(
    '/projects/:projectId/sprints',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const body = createSprintSchema.parse(req.body)

      const startDate = new Date(body.startDate)
      const endDate = new Date(body.endDate)

      if (endDate <= startDate) {
        return reply.status(400).send({ error: 'endDate must be after startDate' })
      }

      const sprint = await sprintService.create({
        projectId,
        name: body.name,
        goal: body.goal,
        startDate,
        endDate,
        status: body.status,
      })

      return reply.status(201).send(sprint)
    }
  )

  // PATCH /projects/:projectId/sprints/:sprintId
  app.patch(
    '/projects/:projectId/sprints/:sprintId',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId, sprintId } = req.params as { projectId: string; sprintId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const existing = await sprintService.getById(sprintId)
      if (!existing || existing.projectId !== projectId) {
        return reply.status(404).send({ error: 'Sprint not found' })
      }

      const body = updateSprintSchema.parse(req.body)

      const startDate = body.startDate ? new Date(body.startDate) : existing.startDate
      const endDate = body.endDate ? new Date(body.endDate) : existing.endDate

      if (endDate <= startDate) {
        return reply.status(400).send({ error: 'endDate must be after startDate' })
      }

      const updated = await sprintService.update(sprintId, {
        name: body.name,
        goal: body.goal,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        status: body.status,
      })

      return updated
    }
  )

  // DELETE /projects/:projectId/sprints/:sprintId
  app.delete(
    '/projects/:projectId/sprints/:sprintId',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId, sprintId } = req.params as { projectId: string; sprintId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const existing = await sprintService.getById(sprintId)
      if (!existing || existing.projectId !== projectId) {
        return reply.status(404).send({ error: 'Sprint not found' })
      }

      await sprintService.delete(sprintId)
      return reply.status(204).send()
    }
  )

  // PATCH /projects/:projectId/sprints/:sprintId/assign-tasks
  app.patch(
    '/projects/:projectId/sprints/:sprintId/assign-tasks',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId, sprintId } = req.params as { projectId: string; sprintId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const existing = await sprintService.getById(sprintId)
      if (!existing || existing.projectId !== projectId) {
        return reply.status(404).send({ error: 'Sprint not found' })
      }

      const { taskIds } = assignTasksSchema.parse(req.body)

      return sprintService.assignTasks(sprintId, projectId, taskIds)
    }
  )
}
