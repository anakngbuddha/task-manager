import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { readStateService } from '../services/readState.service.js'

export async function readReceiptRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/messages/read', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    await readStateService.markProjectRead(projectId, req.authUser.id)
    return { ok: true }
  })

  app.post('/projects/:projectId/direct-messages/:otherUserId/read', { preHandler: authenticate }, async (req) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    await readStateService.markDirectRead(projectId, req.authUser.id, otherUserId)
    return { ok: true }
  })

  app.get('/projects/:projectId/messages/seen', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    return readStateService.seenForLatestProjectOutgoing(projectId, req.authUser.id)
  })

  app.get('/projects/:projectId/direct-messages/:otherUserId/seen', { preHandler: authenticate }, async (req) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    return readStateService.seenForLatestDirectOutgoing(projectId, req.authUser.id, otherUserId)
  })
}

