import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { projectDirectMessageService } from '../services/projectDirectMessage.service.js'
import { activityService } from '../services/activity.service.js'
import { notificationService } from '../services/notification.service.js'
import { prisma } from '../lib/prisma.js'

const createDirectMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function projectDirectMessageRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/direct-inbox', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    return projectDirectMessageService.listInbox(projectId, req.authUser.id)
  })

  app.get('/projects/:projectId/direct-messages/:otherUserId', { preHandler: authenticate }, async (req) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    return projectDirectMessageService.listConversation(projectId, req.authUser.id, otherUserId)
  })

  app.post('/projects/:projectId/direct-messages/:otherUserId', { preHandler: authenticate }, async (req) => {
    const { projectId, otherUserId } = req.params as { projectId: string; otherUserId: string }
    const body = createDirectMessageSchema.parse(req.body)

    const created = await projectDirectMessageService.create({
      projectId,
      senderId: req.authUser.id,
      recipientId: otherUserId,
      content: body.content,
    })

    await activityService.record({
      projectId,
      actorId: req.authUser.id,
      type: 'DIRECT_MESSAGE_SENT',
      entityType: 'PROJECT',
      entityId: projectId,
      metadata: { otherUserId, messageId: created.id },
    })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
    await notificationService.create({
      userId: otherUserId,
      projectId,
      type: 'DIRECT_MESSAGE',
      title: `New message in ${project?.name ?? 'a project'}`,
      body: body.content.slice(0, 120),
      href: `/projects/${projectId}/messages?mode=direct&user=${encodeURIComponent(req.authUser.id)}`,
      data: { projectId, fromUserId: req.authUser.id },
    })

    return created
  })
}

