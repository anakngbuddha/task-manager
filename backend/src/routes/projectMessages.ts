import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { projectMessageService } from '../services/projectMessage.service.js'
import { activityService } from '../services/activity.service.js'
import { notificationService } from '../services/notification.service.js'
import { prisma } from '../lib/prisma.js'

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

    // Fetch project info + all members
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        members: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
      },
    })

    const senderName = project?.members.find((m) => m.userId === req.authUser.id)?.user?.name ?? 'Someone'
    const otherMembers = (project?.members ?? []).filter((m) => m.userId !== req.authUser.id)

    // Parse @mentions from the message content
    // Matches @Name or @everyone/@Everyone
    const mentionedEveryone = /\@everyone/i.test(body.content)
    const mentionMatches = body.content.match(/@([\w\s]+)/g) ?? []
    const mentionedNames = mentionMatches
      .map((m) => m.slice(1).trim().toLowerCase())
      .filter((n) => n !== 'everyone')

    // Determine which members are mentioned
    const mentionedUserIds = new Set<string>()
    if (mentionedEveryone) {
      otherMembers.forEach((m) => mentionedUserIds.add(m.userId))
    } else {
      for (const member of otherMembers) {
        const memberName = (member.user?.name ?? member.user?.email ?? '').toLowerCase()
        if (mentionedNames.some((n) => memberName.includes(n) || n.includes(memberName.split(' ')[0]))) {
          mentionedUserIds.add(member.userId)
        }
      }
    }

    const msgHref = `/projects/${projectId}/messages`

    // Send MENTION notifications
    for (const uid of mentionedUserIds) {
      await notificationService.create({
        userId: uid,
        projectId,
        type: 'MENTION',
        title: `${senderName} mentioned you in ${project?.name ?? 'a project'}`,
        body: body.content.slice(0, 120),
        href: msgHref,
        data: { projectId, fromUserId: req.authUser.id, messageId: created.id },
      })
    }

    // Send NEW_MESSAGE notifications to all non-mentioned non-sender members
    for (const member of otherMembers) {
      if (!mentionedUserIds.has(member.userId)) {
        await notificationService.create({
          userId: member.userId,
          projectId,
          type: 'NEW_MESSAGE',
          title: `New message in ${project?.name ?? 'a project'}`,
          body: `${senderName}: ${body.content.slice(0, 100)}`,
          href: msgHref,
          data: { projectId, fromUserId: req.authUser.id, messageId: created.id },
        })
      }
    }

    return created
  })
}


