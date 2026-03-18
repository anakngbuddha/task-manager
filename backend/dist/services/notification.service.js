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
        return prisma.notification.update({
            where: { id, userId },
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
