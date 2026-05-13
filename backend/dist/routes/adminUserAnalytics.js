import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/auth.js';
import { getOnlineUsers, getUserPresenceStatus } from '../lib/userPresence.js';
export async function adminUserAnalyticsRoutes(app) {
    app.addHook('preValidation', async (req, reply) => {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session)
            return reply.status(401).send({ error: 'Unauthorized' });
        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user || user.role !== 'admin') {
            return reply.status(403).send({ error: 'Forbidden. Admin level required.' });
        }
    });
    app.get('/admin/users/online', async (_req, reply) => {
        return reply.send(getOnlineUsers());
    });
    app.get('/admin/users/:id/analytics', async (req, reply) => {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
                lastSeenAt: true,
            },
        });
        if (!user)
            return reply.status(404).send({ error: 'User not found' });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [sessions, pageViews, clicks, recentEvents] = await Promise.all([
            prisma.userSession.findMany({
                where: { userId: id },
                orderBy: { startedAt: 'desc' },
                take: 50,
            }),
            prisma.analyticsEvent.groupBy({
                by: ['pageUrl'],
                where: {
                    userId: id,
                    eventType: 'PAGE_VIEW',
                    pageUrl: { not: null },
                    createdAt: { gte: thirtyDaysAgo },
                },
                _count: { pageUrl: true },
                orderBy: { _count: { pageUrl: 'desc' } },
                take: 10,
            }),
            prisma.analyticsEvent.groupBy({
                by: ['elementId'],
                where: {
                    userId: id,
                    eventType: 'CLICK',
                    elementId: { not: null },
                    createdAt: { gte: thirtyDaysAgo },
                },
                _count: { elementId: true },
                orderBy: { _count: { elementId: 'desc' } },
                take: 10,
            }),
            prisma.analyticsEvent.findMany({
                where: { userId: id, createdAt: { gte: thirtyDaysAgo } },
                select: { createdAt: true },
            }),
        ]);
        const totalTimeSeconds = sessions.reduce((sum, session) => sum + (session.duration ?? 0), 0);
        const totalIdleSeconds = sessions.reduce((sum, session) => sum + session.idleTime, 0);
        const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            label: `${String(hour).padStart(2, '0')}:00`,
            count: 0,
        }));
        recentEvents.forEach((event) => {
            const hour = event.createdAt.getHours();
            hourlyActivity[hour].count += 1;
        });
        return reply.send({
            user,
            currentStatus: getUserPresenceStatus(id),
            totalTimeSeconds,
            totalIdleSeconds,
            topPages: pageViews.map((entry) => ({
                url: entry.pageUrl,
                count: entry._count.pageUrl,
            })),
            topClicks: clicks.map((entry) => ({
                element: entry.elementId,
                count: entry._count.elementId,
            })),
            hourlyActivity,
            sessions,
        });
    });
}
