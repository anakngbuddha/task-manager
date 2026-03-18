import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { projectMessageService } from '../services/projectMessage.service.js'
import { activityService } from '../services/activity.service.js'

const createMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function projectMessageRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/messages', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    return projectMessageService.listForProject(projectId)
  })

  app.post('/projects/:projectId/messages', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    const body = createMessageSchema.parse(req.body)

    const created = await projectMessageService.create({
      projectId,
      authorId: req.authUser.id,
      content: body.content,
    })

    await activityService.record({
      projectId,
      actorId: req.authUser.id,
      type: 'PROJECT_MESSAGE_SENT',
      entityType: 'PROJECT',
      entityId: projectId,
      metadata: { messageId: created.id },
    })

    return created
  })
}

