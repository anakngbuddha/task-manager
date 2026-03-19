import { prisma } from '../lib/prisma.js';
export const taskService = {
    async getAll(projectId) {
        return prisma.task.findMany({
            where: { projectId },
            include: {
                assignee: true,
                blockingTasks: { include: { blockedTask: true } },
                blockedByTasks: { include: { blockingTask: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getById(id) {
        return prisma.task.findUnique({
            where: { id },
            include: { assignee: true, project: true },
        });
    },
    async create(data) {
        return prisma.task.create({
            data,
            include: { assignee: true },
        });
    },
    async update(id, data) {
        return prisma.task.update({
            where: { id },
            data,
            include: { assignee: true },
        });
    },
    async delete(id) {
        return prisma.task.delete({ where: { id } });
    },
};
