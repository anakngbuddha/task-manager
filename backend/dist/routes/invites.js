import { authenticate } from '../middlewares/authenticate.js';
import { idempotencyPreHandler } from '../middlewares/idempotency.js';
import { projectService } from '../services/project.service.js';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'crypto';
import { requireProjectRole } from '../services/projectAuth.service.js';
function generateCode() {
    return randomBytes(24).toString('base64url');
}
export async function inviteRoutes(app) {
    app.post('/projects/:projectId/invites', {
        preHandler: [authenticate, idempotencyPreHandler('projects.invites.create')],
    }, async (req, reply) => {
        const { projectId } = req.params;
        const userId = req.authUser.id;
        try {
            await requireProjectRole(projectId, userId, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const project = await projectService.getById(projectId);
        if (!project) {
            return reply.status(404).send({ error: 'Project not found' });
        }
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
        const invite = await prisma.projectInvite.create({
            data: {
                code,
                projectId,
                createdById: userId,
                expiresAt,
            },
        });
        return {
            code: invite.code,
            projectId,
            expiresAt: invite.expiresAt,
        };
    });
    app.get('/invites/:code', async (req, reply) => {
        const { code } = req.params;
        const invite = await prisma.projectInvite.findUnique({
            where: { code },
            include: { project: true },
        });
        if (!invite) {
            return reply.status(404).send({ error: 'Invite not found' });
        }
        const isExpired = invite.expiresAt.getTime() < Date.now();
        return {
            code: invite.code,
            projectId: invite.projectId,
            projectName: invite.project.name,
            expiresAt: invite.expiresAt,
            isExpired,
        };
    });
    app.post('/invites/:code/accept', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { code } = req.params;
        const userId = req.authUser.id;
        const invite = await prisma.projectInvite.findUnique({
            where: { code },
        });
        if (!invite) {
            return reply.status(404).send({ error: 'Invite not found' });
        }
        if (invite.expiresAt.getTime() < Date.now()) {
            return reply.status(400).send({ error: 'Invite has expired' });
        }
        if (invite.acceptedById) {
            return reply.status(400).send({ error: 'Invite has already been used' });
        }
        await projectService.addMember(invite.projectId, userId).catch(() => {
            // ignore if already a member (unique constraint)
        });
        await prisma.projectInvite.update({
            where: { id: invite.id },
            data: { acceptedById: userId },
        });
        const project = await projectService.getById(invite.projectId);
        return reply.send({
            projectId: invite.projectId,
            projectName: project?.name ?? '',
        });
    });
}
