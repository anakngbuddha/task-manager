import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { notificationService } from '../services/notification.service.js';
const listSchema = z.object({
    take: z.coerce.number().min(1).max(200).optional(),
});
export async function notificationRoutes(app) {
    app.get('/notifications', { preHandler: authenticate }, async (req) => {
        const { take } = listSchema.parse((req.query ?? {}));
        const items = await notificationService.listForUser(req.authUser.id, { take });
        const unread = await notificationService.unreadCount(req.authUser.id);
        return { items, unread };
    });
    app.post('/notifications/:id/read', { preHandler: authenticate }, async (req) => {
        const { id } = req.params;
        await notificationService.markRead(req.authUser.id, id);
        return { ok: true };
    });
    app.post('/notifications/read-all', { preHandler: authenticate }, async (req) => {
        await notificationService.markAllRead(req.authUser.id);
        return { ok: true };
    });
}
