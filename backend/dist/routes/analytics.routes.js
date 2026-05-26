import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/auth.js';
// Mirror of frontend/src/lib/analytics.ts::AnalyticsEventType plus a few
// runtime-only event types emitted from hooks (PERFORMANCE, etc.).
const ALLOWED_EVENT_TYPES = [
    'PAGE_VIEW',
    'CLICK',
    'ERROR',
    'PERFORMANCE',
    'SESSION_START',
    'SESSION_END',
    'TASK_CREATED',
    'TASK_COMPLETED',
    'FEATURE_USED',
    'SEARCH',
    'INVITE_SENT',
    'INVITE_ACCEPTED',
];
const MAX_METADATA_BYTES = 4096;
const analyticsSchema = z.object({
    eventType: z.enum(ALLOWED_EVENT_TYPES),
    pageUrl: z.string().max(512).optional(),
    elementId: z.string().max(256).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
// Simple analytics ingestion route. Authentication is optional — we tag the
// user when their session cookie is present, otherwise we record an anonymous
// event. Rate limiting is enforced at the route config level (see app.ts).
export async function analyticsRoutes(app) {
    app.post('/analytics/event', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        let body;
        try {
            body = analyticsSchema.parse(req.body);
        }
        catch (err) {
            return reply.status(400).send({ error: 'Invalid analytics payload' });
        }
        if (body.metadata !== undefined) {
            // Bound metadata to prevent abuse / database bloat (audit finding #6).
            try {
                const serialized = JSON.stringify(body.metadata);
                if (serialized.length > MAX_METADATA_BYTES) {
                    return reply.status(400).send({ error: 'metadata too large' });
                }
            }
            catch {
                return reply.status(400).send({ error: 'metadata is not serialisable' });
            }
        }
        let userId = null;
        try {
            const session = await auth.api.getSession({ headers: req.headers });
            if (session?.user?.id)
                userId = session.user.id;
        }
        catch {
            // Anonymous event — fine, leave userId null.
        }
        try {
            await prisma.analyticsEvent.create({
                data: {
                    eventType: body.eventType,
                    pageUrl: body.pageUrl ?? null,
                    elementId: body.elementId ?? null,
                    metadata: body.metadata ?? null,
                    userId,
                },
            });
            return reply.status(204).send();
        }
        catch (err) {
            req.log.error(err, 'Failed to save analytics event');
            return reply.status(500).send({ error: 'Failed to record event' });
        }
    });
}
