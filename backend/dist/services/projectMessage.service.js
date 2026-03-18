import { prisma } from '../lib/prisma.js';
export const projectMessageService = {
    async listForProject(projectId) {
        return prisma.projectMessage.findMany({
            where: { projectId },
            include: { author: true },
            orderBy: { createdAt: 'asc' },
        });
    },
    async create(params) {
        const { projectId, authorId, content } = params;
        return prisma.projectMessage.create({
            data: { projectId, authorId, content },
            include: { author: true },
        });
    },
};
