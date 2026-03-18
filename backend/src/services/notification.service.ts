import { prisma } from '../lib/prisma.js'

export type NotificationCreateInput = {
  userId: string
  projectId?: string
  type: string
  title: string
  body?: string
  href: string
  data?: any
}

export const notificationService = {
  async create(input: NotificationCreateInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href,
        data: input.data ?? undefined,
      },
    })
  },

  async listForUser(userId: string, opts?: { take?: number }) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    })
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, readAt: null },
    })
  },

  async markRead(userId: string, id: string) {
    return prisma.notification.update({
      where: { id, userId } as any,
      data: { readAt: new Date() },
    })
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  },
}

