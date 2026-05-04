import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { idempotencyPreHandler } from '../middlewares/idempotency.js';
import { projectMessageService } from '../services/projectMessage.service.js';
import { activityService } from '../services/activity.service.js';
import { notificationService } from '../services/notification.service.js';
import { prisma } from '../lib/prisma.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { getIO } from '../lib/socketManager.js';
const createMessageSchema = z.object({
    content: z.string().max(2000).optional().default(''),
    fileUrl: z.string().optional(),
    fileName: z.string().optional(),
}).refine(data => data.content.length > 0 || !!data.fileUrl, { message: 'Message or file is required' });
export async function projectMessageRoutes(app) {
    app.get('/projects/:projectId/messages', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        return projectMessageService.listForProject(projectId);
    });
    app.post('/projects/:projectId/messages', { preHandler: [authenticate, idempotencyPreHandler('projects.messages.create')] }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const body = createMessageSchema.parse(req.body);
        const created = await projectMessageService.create({
            projectId,
            authorId: req.authUser.id,
            content: body.content,
            fileUrl: body.fileUrl,
            fileName: body.fileName,
        });
        getIO().to(projectId).emit('message:project', created);
        // Fire-and-forget: notifications and activity recording happen after the
        // response + socket event are already sent, so receivers see the message
        // instantly without waiting for this work to finish.
        setImmediate(async () => {
            try {
                await activityService.record({
                    projectId,
                    actorId: req.authUser.id,
                    type: 'PROJECT_MESSAGE_SENT',
                    entityType: 'PROJECT',
                    entityId: projectId,
                    metadata: { messageId: created.id },
                });
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: {
                        name: true,
                        members: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
                    },
                });
                const senderName = project?.members.find((m) => m.userId === req.authUser.id)?.user?.name ?? 'Someone';
                const otherMembers = (project?.members ?? []).filter((m) => m.userId !== req.authUser.id);
                const mentionedEveryone = /@everyone\b/i.test(body.content);
                const mentionMatches = body.content.match(/@(\w+)/g) ?? [];
                const mentionedNames = mentionMatches
                    .map((m) => m.slice(1).toLowerCase())
                    .filter((n) => n !== 'everyone');
                const mentionedUserIds = new Set();
                if (mentionedEveryone) {
                    otherMembers.forEach((m) => mentionedUserIds.add(m.userId));
                }
                else {
                    for (const member of otherMembers) {
                        const name = (member.user?.name ?? '').toLowerCase();
                        const email = (member.user?.email ?? '').toLowerCase();
                        const firstName = name.split(' ')[0];
                        const nameNoSpaces = name.replace(/\s+/g, '');
                        if (mentionedNames.some((n) => n === firstName || n === nameNoSpaces || n === email.split('@')[0])) {
                            mentionedUserIds.add(member.userId);
                        }
                    }
                }
                const msgHref = `/projects/${projectId}/messages`;
                for (const uid of mentionedUserIds) {
                    await notificationService.create({
                        userId: uid,
                        projectId,
                        type: 'MENTION',
                        title: `${senderName} mentioned you in ${project?.name ?? 'a project'}`,
                        body: body.content.slice(0, 120),
                        href: msgHref,
                        data: { projectId, fromUserId: req.authUser.id, messageId: created.id },
                    });
                }
                for (const member of otherMembers) {
                    if (!mentionedUserIds.has(member.userId)) {
                        await notificationService.create({
                            userId: member.userId,
                            projectId,
                            type: 'NEW_MESSAGE',
                            title: `New message in ${project?.name ?? 'a project'}`,
                            body: `${senderName}: ${body.content.slice(0, 100)}`,
                            href: msgHref,
                            data: { projectId, fromUserId: req.authUser.id, messageId: created.id },
                        });
                    }
                }
            }
            catch (err) {
                console.error('Background notification error:', err);
            }
        });
        return created;
    });
}
