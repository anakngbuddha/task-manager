import { prisma } from '../lib/prisma.js';
export const sprintService = {
    async list(projectId) {
        return prisma.sprint.findMany({
            where: { projectId },
            include: {
                tasks: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        priority: true,
                        assigneeId: true,
                        assignee: { select: { id: true, name: true, email: true } },
                    },
                },
            },
            orderBy: { startDate: 'asc' },
        });
    },
    async getById(id) {
        return prisma.sprint.findUnique({
            where: { id },
            include: { tasks: true },
        });
    },
    async create(data) {
        return prisma.sprint.create({ data, include: { tasks: true } });
    },
    async update(id, data) {
        return prisma.sprint.update({
            where: { id },
            data,
            include: { tasks: true },
        });
    },
    async delete(id) {
        // Unlink tasks before deleting (FK is SetNull, Prisma handles it via the relation)
        return prisma.sprint.delete({ where: { id } });
    },
    /**
     * Replace the full task list for a sprint.
     * - Clears sprintId from all tasks currently in this sprint.
     * - Sets sprintId on the provided task IDs (which must belong to the same project).
     */
    async assignTasks(sprintId, projectId, taskIds) {
        await prisma.$transaction([
            // Clear all existing assignments for this sprint
            prisma.task.updateMany({
                where: { sprintId },
                data: { sprintId: null },
            }),
            // Assign new tasks — only tasks that belong to the same project
            ...(taskIds.length > 0
                ? [
                    prisma.task.updateMany({
                        where: { id: { in: taskIds }, projectId },
                        data: { sprintId },
                    }),
                ]
                : []),
        ]);
        return prisma.sprint.findUnique({
            where: { id: sprintId },
            include: {
                tasks: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        priority: true,
                        assigneeId: true,
                        assignee: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
    },
    async getBurndown(projectId, sprintId) {
        const sprint = await prisma.sprint.findUnique({
            where: { id: sprintId },
            select: {
                id: true,
                name: true,
                projectId: true,
                startDate: true,
                endDate: true,
                status: true,
            },
        });
        if (!sprint || sprint.projectId !== projectId)
            return null;
        const tasks = await prisma.task.findMany({
            where: { sprintId },
            select: {
                id: true,
                status: true,
                updatedAt: true,
            },
        });
        const totalScope = tasks.length;
        const startUTC = new Date(sprint.startDate);
        const endUTC = new Date(sprint.endDate);
        const startOfDayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayMs = 24 * 60 * 60 * 1000;
        const sprintStart = startOfDayUTC(startUTC);
        const sprintEnd = startOfDayUTC(endUTC);
        const days = Math.max(1, Math.floor((sprintEnd.getTime() - sprintStart.getTime()) / dayMs) + 1);
        // Daily completed task counts within the sprint date range.
        // Note: tasks completed after sprintEnd are ignored; tasks completed before sprintStart are counted on day 0.
        const completedByDay = Array.from({ length: days }, () => 0);
        for (const t of tasks) {
            if (t.status !== 'DONE' && t.status !== 'READY')
                continue;
            const completedDayUTC = startOfDayUTC(new Date(t.updatedAt));
            const diffMs = completedDayUTC.getTime() - sprintStart.getTime();
            const idx = Math.floor(diffMs / dayMs);
            if (idx < 0) {
                completedByDay[0] += 1;
            }
            else if (idx >= days) {
                // Completed after sprint end: do not affect sprint burndown points.
                continue;
            }
            else {
                completedByDay[idx] += 1;
            }
        }
        const points = [];
        let completedCumulative = 0;
        for (let i = 0; i < days; i += 1) {
            completedCumulative += completedByDay[i];
            const actualRemaining = Math.max(0, totalScope - completedCumulative);
            let idealRemaining = 0;
            if (totalScope === 0) {
                idealRemaining = 0;
            }
            else if (days === 1) {
                idealRemaining = totalScope;
            }
            else {
                const ratio = i / (days - 1);
                idealRemaining = Math.max(0, Math.round(totalScope * (1 - ratio)));
            }
            const dayDate = new Date(sprintStart.getTime() + i * dayMs);
            const dateKey = dayDate.toISOString().slice(0, 10);
            points.push({
                date: dateKey,
                completedDaily: completedByDay[i],
                completedCumulative,
                total: totalScope,
                idealRemaining,
                actualRemaining,
            });
        }
        return {
            sprint: {
                id: sprint.id,
                name: sprint.name,
                startDate: sprint.startDate.toISOString(),
                endDate: sprint.endDate.toISOString(),
                status: sprint.status,
            },
            totalScope,
            points,
        };
    },
};
