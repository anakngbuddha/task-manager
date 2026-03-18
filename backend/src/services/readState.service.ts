import { prisma } from '../lib/prisma.js'

async function safeUpsertProjectRead(projectId: string, userId: string, attempts = 3) {
  const lastReadAt = new Date()
  for (let i = 0; i < attempts; i++) {
    try {
      const updated = await prisma.projectChatReadState.updateMany({
        where: { projectId, userId },
        data: { lastReadAt },
      })
      if (updated.count > 0) return { projectId, userId, lastReadAt }
      return await prisma.projectChatReadState.create({ data: { projectId, userId, lastReadAt } })
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      if (i < attempts - 1 && (msg.includes('Record has changed since last read') || msg.includes('P2034'))) {
        await new Promise((r) => setTimeout(r, 40 * (i + 1)))
        continue
      }
      throw e
    }
  }
  // unreachable
}

async function safeUpsertDirectRead(projectId: string, userId: string, otherUserId: string, attempts = 3) {
  const lastReadAt = new Date()
  for (let i = 0; i < attempts; i++) {
    try {
      const updated = await prisma.directChatReadState.updateMany({
        where: { projectId, userId, otherUserId },
        data: { lastReadAt },
      })
      if (updated.count > 0) return { projectId, userId, otherUserId, lastReadAt }
      return await prisma.directChatReadState.create({ data: { projectId, userId, otherUserId, lastReadAt } })
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      if (i < attempts - 1 && (msg.includes('Record has changed since last read') || msg.includes('P2034'))) {
        await new Promise((r) => setTimeout(r, 40 * (i + 1)))
        continue
      }
      throw e
    }
  }
  // unreachable
}

export const readStateService = {
  async markProjectRead(projectId: string, userId: string) {
    return safeUpsertProjectRead(projectId, userId)
  },

  async markDirectRead(projectId: string, userId: string, otherUserId: string) {
    return safeUpsertDirectRead(projectId, userId, otherUserId)
  },

  async seenForLatestProjectOutgoing(projectId: string, userId: string) {
    const latest = await prisma.projectMessage.findFirst({
      where: { projectId, authorId: userId },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) return { messageId: null as string | null, createdAt: null as Date | null, seenBy: [] as any[] }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    const reads = await prisma.projectChatReadState.findMany({
      where: { projectId, userId: { in: members.map((m) => m.userId) } },
    })
    const readMap = new Map(reads.map((r) => [r.userId, r.lastReadAt]))

    const seenBy = members
      .map((m) => m.user)
      .filter((u) => u.id !== userId)
      .filter((u) => (readMap.get(u.id)?.getTime() ?? 0) >= latest.createdAt.getTime())

    return { messageId: latest.id, createdAt: latest.createdAt, seenBy }
  },

  async seenForLatestDirectOutgoing(projectId: string, userId: string, otherUserId: string) {
    const latest = await prisma.projectDirectMessage.findFirst({
      where: { projectId, senderId: userId, recipientId: otherUserId },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) return { messageId: null as string | null, createdAt: null as Date | null, seenBy: [] as any[] }

    const read = await prisma.directChatReadState.findUnique({
      where: { projectId_userId_otherUserId: { projectId, userId: otherUserId, otherUserId: userId } },
    })
    const other = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, email: true },
    })
    const seen = !!read && read.lastReadAt.getTime() >= latest.createdAt.getTime()

    return { messageId: latest.id, createdAt: latest.createdAt, seenBy: seen && other ? [other] : [] }
  },
}

