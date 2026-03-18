import { prisma } from '../lib/prisma.js'

export const projectDirectMessageService = {
  async listInbox(projectId: string, userId: string) {
    const msgs = await prisma.projectDirectMessage.findMany({
      where: {
        projectId,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    })

    const seen = new Set<string>()
    const inbox: Array<{ otherUserId: string; lastMessage: any }> = []

    for (const m of msgs) {
      const otherUserId = m.senderId === userId ? m.recipientId : m.senderId
      if (seen.has(otherUserId)) continue
      seen.add(otherUserId)
      inbox.push({ otherUserId, lastMessage: m })
    }

    return inbox
  },

  async listConversation(projectId: string, userId: string, otherUserId: string) {
    return prisma.projectDirectMessage.findMany({
      where: {
        projectId,
        OR: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  async create(params: { projectId: string; senderId: string; recipientId: string; content: string }) {
    const { projectId, senderId, recipientId, content } = params
    return prisma.projectDirectMessage.create({
      data: { projectId, senderId, recipientId, content },
    })
  },
}

