import { prisma } from '../lib/prisma.js';
export const taskCommentService = {
    async listForTask(taskId) {
        return prisma.taskComment.findMany({
            where: { taskId, parentId: null },
            include: {
                author: true,
                replies: {
                    include: { author: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    },
    async create(params) {
        const { taskId, authorId, content, parentId } = params;
        return prisma.taskComment.create({
            data: {
                taskId,
                authorId,
                content,
                parentId: parentId ?? null,
            },
            include: { author: true },
        });
    },
};
