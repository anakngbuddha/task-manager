import { prisma } from '../lib/prisma.js';
function roundHours(hours) {
    return Math.round((hours + Number.EPSILON) * 100) / 100;
}
export const timeLogService = {
    async listByTask(taskId) {
        return prisma.timeLog.findMany({
            where: { taskId },
            orderBy: { loggedAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });
    },
    async create(data) {
        return prisma.timeLog.create({
            data: {
                taskId: data.taskId,
                userId: data.userId,
                durationMinutes: data.durationMinutes,
                note: data.note,
                loggedAt: data.loggedAt,
            },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });
    },
    async getById(id) {
        return prisma.timeLog.findUnique({
            where: { id },
            include: {
                task: { select: { projectId: true } },
            },
        });
    },
    async delete(id) {
        return prisma.timeLog.delete({ where: { id } });
    },
    async projectTimeReport(projectId) {
        const logs = await prisma.timeLog.findMany({
            where: { task: { projectId } },
            include: {
                user: { select: { id: true, name: true, email: true } },
                task: { select: { id: true, title: true } },
            },
            orderBy: { loggedAt: 'asc' },
        });
        const byUserMinutes = new Map();
        const byTaskMinutes = new Map();
        const byUserTaskMinutes = new Map();
        const userMeta = new Map();
        const taskMeta = new Map();
        for (const log of logs) {
            byUserMinutes.set(log.userId, (byUserMinutes.get(log.userId) ?? 0) + log.durationMinutes);
            byTaskMinutes.set(log.taskId, (byTaskMinutes.get(log.taskId) ?? 0) + log.durationMinutes);
            if (!byUserTaskMinutes.has(log.userId))
                byUserTaskMinutes.set(log.userId, new Map());
            const inner = byUserTaskMinutes.get(log.userId);
            inner.set(log.taskId, (inner.get(log.taskId) ?? 0) + log.durationMinutes);
            userMeta.set(log.userId, {
                userId: log.userId,
                name: log.user?.name,
                email: log.user?.email ?? null,
            });
            taskMeta.set(log.taskId, { taskId: log.taskId, title: log.task?.title ?? 'Untitled task' });
        }
        const byTask = Array.from(byTaskMinutes.entries()).map(([taskId, minutes]) => ({
            taskId,
            taskTitle: taskMeta.get(taskId)?.title ?? 'Untitled task',
            totalHours: roundHours(minutes / 60),
        }));
        const byUser = Array.from(byUserMinutes.entries()).map(([userId, minutes]) => ({
            userId,
            name: userMeta.get(userId)?.name ?? undefined,
            email: userMeta.get(userId)?.email ?? undefined,
            totalHours: roundHours(minutes / 60),
        }));
        const members = Array.from(byUserMinutes.entries())
            .map(([userId, minutes]) => {
            const inner = byUserTaskMinutes.get(userId) ?? new Map();
            const tasks = Array.from(inner.entries()).map(([taskId, taskMinutes]) => ({
                taskId,
                taskTitle: taskMeta.get(taskId)?.title ?? 'Untitled task',
                hours: roundHours(taskMinutes / 60),
            }));
            tasks.sort((a, b) => b.hours - a.hours);
            return {
                userId,
                userName: userMeta.get(userId)?.name ?? userMeta.get(userId)?.email ?? userId,
                totalHours: roundHours(minutes / 60),
                tasks,
            };
        })
            .sort((a, b) => b.totalHours - a.totalHours);
        const grandTotalHours = roundHours(logs.reduce((sum, l) => sum + l.durationMinutes, 0) / 60);
        return {
            grandTotalHours,
            byUser,
            byTask,
            members,
        };
    },
};
