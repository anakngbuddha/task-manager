import { prisma } from '../lib/prisma.js';
export const projectDirectMessageService = {
    async listInbox(projectId, userId) {
        const msgs = await prisma.projectDirectMessage.findMany({
            where: {
                projectId,
                OR: [{ senderId: userId }, { recipientId: userId }],
            },
            orderBy: { createdAt: 'desc' },
        });
        const seen = new Set();
        const inbox = [];
        for (const m of msgs) {
            const otherUserId = m.senderId === userId ? m.recipientId : m.senderId;
            if (seen.has(otherUserId))
                continue;
            seen.add(otherUserId);
            inbox.push({ otherUserId, lastMessage: m });
        }
        return inbox;
    },
    async listConversation(projectId, userId, otherUserId) {
        return prisma.projectDirectMessage.findMany({
            where: {
                projectId,
                OR: [
                    { senderId: userId, recipientId: otherUserId },
                    { senderId: otherUserId, recipientId: userId },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });
    },
    async create(params) {
        const { projectId, senderId, recipientId, content, fileUrl, fileName } = params;
        return prisma.projectDirectMessage.create({
            data: { projectId, senderId, recipientId, content, fileUrl, fileName },
        });
    },
};
