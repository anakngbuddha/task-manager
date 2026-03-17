import { FastifyInstance } from 'fastify'
import { taskService } from '../services/task.service.js'
import { authenticate } from '../middlewares/authenticate.js'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  projectId: z.string(),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional(),
})

export async function taskRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/tasks', {
    preHandler: authenticate,
  }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    return taskService.getAll(projectId)
  })

  app.get('/tasks/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await taskService.getById(id)
    if (!task) return reply.status(404).send({ error: 'Task not found' })
    return task
  })

  app.post('/tasks', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const body = createTaskSchema.parse(req.body)
    const task = await taskService.create(body)
    return reply.status(201).send(task)
  })

  app.patch('/tasks/:id', {
    preHandler: authenticate,
  }, async (req) => {
    const { id } = req.params as { id: string }
    const body = updateTaskSchema.parse(req.body)
    return taskService.update(id, body)
  })

  app.delete('/tasks/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await taskService.delete(id)
    return reply.status(204).send()
  })
}