import { FastifyInstance } from 'fastify'
import { projectService } from '../services/project.service.js'
import { authenticate } from '../middlewares/authenticate.js'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', {
    preHandler: authenticate,
  }, async (req) => {
    return projectService.getAllForUser(req.authUser.id)
  })

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

  app.patch('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { name } = createProjectSchema.parse(req.body)
    return projectService.update(id, name)
  })

  app.delete('/projects/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await projectService.delete(id)
    return reply.status(204).send()
  })
}