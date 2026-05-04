import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { idempotencyPreHandler } from '../middlewares/idempotency.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { prisma } from '../lib/prisma.js';
import { timeLogService } from '../services/timeLog.service.js';
import { activityService } from '../services/activity.service.js';
export async function timeLogRoutes(app) {
    // GET /api/tasks/:taskId/time-logs
    app.get('/tasks/:taskId/time-logs', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true, title: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const logs = await timeLogService.listByTask(taskId);
        return reply.status(200).send(logs);
    });
    // POST /api/tasks/:taskId/time-logs
    app.post('/tasks/:taskId/time-logs', { preHandler: [authenticate, idempotencyPreHandler('tasks.time_logs.create')] }, async (req, reply) => {
        const { taskId } = req.params;
        const createSchema = z.object({
            durationMinutes: z.number().int().positive().max(14400),
            title: z.string().min(1).max(200),
            description: z.string().min(1).max(5000),
            loggedAt: z.string().datetime().optional(),
        });
        const body = createSchema.parse(req.body);
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true, title: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const note = body.title + '\n' + body.description;
        const created = await timeLogService.create({
            taskId,
            userId: req.authUser.id,
            durationMinutes: body.durationMinutes,
            note,
            loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
        });
        await activityService.record({
            projectId: task.projectId,
            actorId: req.authUser.id,
            type: 'TIME_LOG_CREATED',
            entityType: 'TIME_LOG',
            entityId: created.id,
            metadata: {
                taskId: task.id,
                taskTitle: task.title,
                durationMinutes: created.durationMinutes,
                title: body.title,
                description: body.description,
                loggedAt: created.loggedAt.toISOString(),
                createdAt: created.createdAt.toISOString(),
                createdByUserId: created.userId,
            },
        });
        return reply.status(201).send(created);
    });
    // DELETE /api/time-logs/:id
    app.delete('/time-logs/:id', { preHandler: authenticate }, async (req, reply) => {
        const { id } = req.params;
        const log = await prisma.timeLog.findUnique({
            where: { id },
            include: {
                task: { select: { id: true, title: true, projectId: true } },
                user: { select: { id: true, name: true, email: true } },
            },
        });
        if (!log)
            return reply.status(404).send({ error: 'Time log not found' });
        const projectId = log.task?.projectId;
        if (!projectId)
            return reply.status(404).send({ error: 'Project not found' });
        const membershipRole = await prisma.projectMember.findUnique({
            where: { userId_projectId: { userId: req.authUser.id, projectId } },
            select: { role: true },
        });
        const isElevated = membershipRole?.role === 'MASTER_ADMIN' || membershipRole?.role === 'PROJECT_MANAGER';
        const isOwner = log.userId === req.authUser.id;
        if (!isElevated && !isOwner)
            return reply.status(403).send({ error: 'Forbidden' });
        await activityService.record({
            projectId,
            actorId: req.authUser.id,
            type: 'TIME_LOG_DELETED',
            entityType: 'TIME_LOG',
            entityId: log.id,
            metadata: {
                taskId: log.taskId,
                taskTitle: log.task?.title ?? null,
                durationMinutes: log.durationMinutes,
                title: null,
                description: log.note ?? null,
                loggedAt: log.loggedAt.toISOString(),
                createdAt: log.createdAt.toISOString(),
                deletedAt: new Date().toISOString(),
                originalAuthor: {
                    id: log.user?.id ?? log.userId,
                    name: log.user?.name ?? null,
                    email: log.user?.email ?? null,
                },
                deletedByUserId: req.authUser.id,
            },
        });
        await timeLogService.delete(id);
        return reply.status(204).send();
    });
    // GET /api/projects/:projectId/time-report
    app.get('/projects/:projectId/time-report', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const report = await timeLogService.projectTimeReport(projectId);
        return reply.status(200).send(report);
    });
}
