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
};
