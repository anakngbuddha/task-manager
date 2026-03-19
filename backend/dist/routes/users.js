import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { userStatusService, USER_STATUSES } from '../services/userStatus.service.js';
export async function userRoutes(app) {
    app.patch('/users/me/status', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const schema = z.object({ status: z.enum(USER_STATUSES) });
        const body = schema.parse(req.body);
        const next = await userStatusService.setStatus(req.authUser.id, body.status);
        return reply.status(200).send({ status: next });
    });
}
