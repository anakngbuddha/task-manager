import { prisma } from '../lib/prisma.js';
export const activityService = {
    async record(input) {
        return prisma.activityEvent.create({
            data: {
                projectId: input.projectId,
                actorId: input.actorId,
                type: input.type,
                entityType: input.entityType,
                entityId: input.entityId,
                metadata: input.metadata ?? undefined,
            },
        });
    },
    async listForUser(userId, opts) {
        const memberships = await prisma.projectMember.findMany({
            where: { userId },
            select: { projectId: true },
        });
        const projectIds = memberships.map((m) => m.projectId);
        if (projectIds.length === 0)
            return [];
        return prisma.activityEvent.findMany({
            where: { projectId: { in: projectIds } },
            include: {
                project: true,
                actor: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: opts?.take ?? 50,
        });
    },
    async listForProject(projectId, opts) {
        return prisma.activityEvent.findMany({
            where: { projectId },
            include: {
                project: true,
                actor: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: opts?.take ?? 50,
        });
    },
    async contributionsForProject(projectId, days) {
        const safeDays = Math.min(Math.max(days, 7), 370);
        // Count contributions based on TASK_COMPLETED events, credited to the assignee.
        // If the task was assigned to Everyone (assigneeId is null), credit all members for that day.
        const rows = await prisma.$queryRaw `
      SELECT
        JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.assigneeId')) as assigneeId,
        DATE(createdAt) as day,
        COUNT(*) as count
      FROM ActivityEvent
      WHERE projectId = ${projectId}
        AND type = 'TASK_COMPLETED'
        AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ${safeDays} DAY)
      GROUP BY JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.assigneeId')), DATE(createdAt)
    `;
        // member list (to ensure we include 0-contribution members)
        const members = await prisma.projectMember.findMany({
            where: { projectId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        const byUser = {};
        for (const m of members)
            byUser[m.userId] = {};
        for (const r of rows) {
            const day = String(r.day);
            const count = Number(r.count);
            const assigneeId = r.assigneeId ? String(r.assigneeId) : null;
            if (!assigneeId) {
                // Everyone
                for (const m of members) {
                    byUser[m.userId][day] = (byUser[m.userId][day] ?? 0) + count;
                }
            }
            else {
                if (!byUser[assigneeId])
                    byUser[assigneeId] = {};
                byUser[assigneeId][day] = (byUser[assigneeId][day] ?? 0) + count;
            }
        }
        return {
            days: safeDays,
            members: members.map((m) => ({
                userId: m.userId,
                name: m.user?.name ?? null,
                email: m.user?.email ?? null,
                countsByDay: byUser[m.userId] ?? {},
            })),
        };
    },
    async contributionsForUser(userId, days) {
        const safeDays = Math.min(Math.max(days, 7), 370);
        const rows = await prisma.$queryRaw `
      SELECT
        DATE(a.createdAt) as day,
        COUNT(*) as count
      FROM ActivityEvent a
      INNER JOIN ProjectMember pm ON pm.projectId = a.projectId
      WHERE pm.userId = ${userId}
        AND a.type = 'TASK_COMPLETED'
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.assigneeId')) = ${userId}
          OR JSON_EXTRACT(a.metadata, '$.assigneeId') IS NULL
        )
        AND a.createdAt >= DATE_SUB(CURDATE(), INTERVAL ${safeDays} DAY)
      GROUP BY DATE(a.createdAt)
    `;
        const countsByDay = {};
        for (const r of rows)
            countsByDay[String(r.day)] = Number(r.count);
        return { days: safeDays, userId, countsByDay };
    },
};
