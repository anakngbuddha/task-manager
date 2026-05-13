import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { prisma } from '../lib/prisma.js';
const USER_STATUSES = ['ONLINE', 'WORKING', 'BUSY', 'AWAY', 'IN_MEETING', 'OFFLINE'];
const updateStatusSchema = z.object({
    status: z.enum(USER_STATUSES),
});
const updateConsentSchema = z.object({
    essential: z.boolean(),
    analytics: z.boolean(),
    preferences: z.boolean(),
    timestamp: z.string(),
    version: z.string(),
});
export async function userRoutes(app) {
    app.get('/users/me', { preHandler: authenticate }, async (req) => {
        const user = await prisma.user.findUnique({
            where: { id: req.authUser.id },
            select: { id: true, name: true, email: true, status: true, lastSeenAt: true, consent: true },
        });
        return user;
    });
    app.patch('/users/me/status', { preHandler: authenticate }, async (req, reply) => {
        const { status } = updateStatusSchema.parse(req.body);
        const user = await prisma.user.update({
            where: { id: req.authUser.id },
            data: { status, lastSeenAt: new Date() },
            select: { id: true, status: true, lastSeenAt: true },
        });
        return reply.status(200).send(user);
    });
    app.patch('/users/me/consent', { preHandler: authenticate }, async (req, reply) => {
        const consent = updateConsentSchema.parse(req.body);
        const user = await prisma.user.update({
            where: { id: req.authUser.id },
            data: { consent: consent },
            select: { id: true, consent: true },
        });
        return reply.status(200).send(user);
    });
    app.post('/users/me/ping', { preHandler: authenticate }, async (req, reply) => {
        await prisma.user.update({
            where: { id: req.authUser.id },
            data: { lastSeenAt: new Date() },
        });
        return reply.status(204).send();
    });
    app.get('/users/status', { preHandler: authenticate }, async (req) => {
        const schema = z.object({ ids: z.string() });
        const { ids } = schema.parse((req.query ?? {}));
        const userIds = ids.split(',').filter(Boolean);
        if (userIds.length === 0)
            return [];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, status: true, lastSeenAt: true },
        });
        return users;
    });
}
