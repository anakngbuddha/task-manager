import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { activityService } from '../services/activity.service.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
const listSchema = z.object({
    take: z.coerce.number().min(1).max(200).optional(),
});
export async function activityRoutes(app) {
    app.get('/activity', { preHandler: authenticate }, async (req) => {
        const { take } = listSchema.parse((req.query ?? {}));
        return activityService.listForUser(req.authUser.id, { take });
    });
    app.get('/activity/contributions', { preHandler: authenticate }, async (req) => {
        const schema = z.object({ days: z.coerce.number().min(7).max(370).optional() });
        const { days } = schema.parse((req.query ?? {}));
        return activityService.contributionsForUser(req.authUser.id, days ?? 365);
    });
    // Task-based contributions (GitHub-style: counts DONE tasks by assignee)
    app.get('/activity/task-contributions', { preHandler: authenticate }, async (req) => {
        const schema = z.object({ days: z.coerce.number().min(7).max(370).optional() });
        const { days } = schema.parse((req.query ?? {}));
        return activityService.taskContributionsForUser(req.authUser.id, days ?? 365);
    });
    app.get('/projects/:projectId/activity', { preHandler: authenticate }, async (req) => {
        const { projectId } = req.params;
        const { take } = listSchema.parse((req.query ?? {}));
        return activityService.listForProject(projectId, { take });
    });
    app.get('/projects/:projectId/contributions', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const schema = z.object({ days: z.coerce.number().min(7).max(370).optional() });
        const { days } = schema.parse((req.query ?? {}));
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const data = await activityService.contributionsForProject(projectId, days ?? 365);
        return reply.status(200).send(data);
    });
    // Task-based project contributions (GitHub-style)
    app.get('/projects/:projectId/task-contributions', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const schema = z.object({ days: z.coerce.number().min(7).max(370).optional() });
        const { days } = schema.parse((req.query ?? {}));
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const data = await activityService.taskContributionsForProject(projectId, days ?? 365);
        return reply.status(200).send(data);
    });
}
