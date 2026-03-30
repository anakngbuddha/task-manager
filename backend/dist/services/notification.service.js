import { prisma } from '../lib/prisma.js';
export const notificationService = {
    async create(input) {
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
        });
    },
    async listForUser(userId, opts) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: opts?.take ?? 50,
        });
    },
    async unreadCount(userId) {
        return prisma.notification.count({
            where: { userId, readAt: null },
        });
    },
    async markRead(userId, id) {
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification || notification.userId !== userId) {
            throw new Error('NOT_FOUND');
        }
        return prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });
    },
    async markAllRead(userId) {
        return prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
    },
};
