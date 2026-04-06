import { prisma } from '../lib/prisma.js';
const DONE_STATUSES = ['DONE', 'READY'];
export const taskService = {
    async getAll(projectId) {
        return prisma.task.findMany({
            where: { projectId, parentId: null },
            include: {
                assignee: true,
                subtasks: { include: { assignee: true } },
                blockingTasks: { include: { blockedTask: true } },
                blockedByTasks: { include: { blockingTask: true } },
                tags: { include: { tag: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getById(id) {
        return prisma.task.findUnique({
            where: { id },
            include: {
                assignee: true,
                project: true,
                subtasks: { include: { assignee: true } },
            },
        });
    },
    async create(data) {
        const completedAt = data.status && DONE_STATUSES.includes(data.status) ? new Date() : null;
        return prisma.task.create({
            data: { ...data, completedAt },
            include: { assignee: true, subtasks: true },
        });
    },
    async update(id, data) {
        if (data.status !== undefined) {
            const existing = await prisma.task.findUnique({ where: { id }, select: { status: true } });
            if (existing) {
                const wasDone = DONE_STATUSES.includes(existing.status);
                const isDone = DONE_STATUSES.includes(data.status);
                if (isDone && !wasDone) {
                    ;
                    data.completedAt = new Date();
                }
                else if (!isDone && wasDone) {
                    ;
                    data.completedAt = null;
                }
            }
        }
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
