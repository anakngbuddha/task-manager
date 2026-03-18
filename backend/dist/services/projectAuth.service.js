import { prisma } from '../lib/prisma.js';
export async function requireProjectRole(projectId, userId, allowed) {
    const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { role: true },
    });
    if (!membership)
        throw new Error('FORBIDDEN');
    if (!allowed.includes(membership.role))
        throw new Error('FORBIDDEN');
    return membership.role;
}
