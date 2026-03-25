import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { readStateService } from '../services/readState.service.js'
import { requireProjectRole } from '../services/projectAuth.service.js'

export async function readReceiptRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/messages/read', { preHandler: authenticate }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await readStateService.markProjectRead(projectId, req.authUser.id)
    return { ok: true }
  })

  app.post('/projects/:projectId/direct-messages/:otherUserId/read', { preHandler: authenticate }, async (req, reply) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await readStateService.markDirectRead(projectId, req.authUser.id, otherUserId)
    return { ok: true }
  })

  app.get('/projects/:projectId/messages/seen', { preHandler: authenticate }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return readStateService.seenForLatestProjectOutgoing(projectId, req.authUser.id)
  })

  app.get('/projects/:projectId/direct-messages/:otherUserId/seen', { preHandler: authenticate }, async (req, reply) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return readStateService.seenForLatestDirectOutgoing(projectId, req.authUser.id, otherUserId)
  })
}

