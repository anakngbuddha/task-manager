import { prisma } from '../lib/prisma.js';
import { userStatusService } from './userStatus.service.js';
const lastActive = new Map(); // userId -> epoch ms
export const presenceService = {
    ping(userId) {
        lastActive.set(userId, Date.now());
    },
    lastActiveAt(userId) {
        const ms = lastActive.get(userId);
        return ms ? new Date(ms).toISOString() : null;
    },
    async listForProject(projectId) {
        const members = await prisma.projectMember.findMany({
            where: { projectId },
            select: { userId: true },
        });
        const userIds = members.map((m) => m.userId);
        const statuses = await Promise.all(userIds.map(async (id) => [id, await userStatusService.getStatus(id)]));
        const statusByUser = new Map(statuses);
        return userIds.map((id) => ({
            userId: id,
            lastActiveAt: presenceService.lastActiveAt(id),
            status: statusByUser.get(id) ?? 'ONLINE',
        }));
    },
};
