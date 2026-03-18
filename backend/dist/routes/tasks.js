import { taskService } from '../services/task.service.js';
import { authenticate } from '../middlewares/authenticate.js';
import { z } from 'zod';
import { activityService } from '../services/activity.service.js';
import { notificationService } from '../services/notification.service.js';
import { prisma } from '../lib/prisma.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { TaskStatus } from '@prisma/client';
const createTaskSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().optional(),
    projectId: z.string(),
    assigneeId: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    deadline: z.string().datetime().optional(),
});
const updateTaskSchema = z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.string().optional(),
    deadline: z.string().datetime().nullable().optional(),
});
export async function taskRoutes(app) {
    app.get('/projects/:projectId/tasks', {
        preHandler: authenticate,
    }, async (req) => {
        const { projectId } = req.params;
        return taskService.getAll(projectId);
    });
    app.get('/tasks/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        const task = await taskService.getById(id);
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        return task;
    });
    app.post('/tasks', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const body = createTaskSchema.parse(req.body);
        try {
            await requireProjectRole(body.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const now = new Date();
        if (body.deadline) {
            const deadlineDate = new Date(body.deadline);
            if (deadlineDate.getTime() < now.getTime()) {
                return reply.status(400).send({ error: 'Deadline cannot be in the past' });
            }
        }
        const task = await taskService.create({
            ...body,
            deadline: body.deadline ? new Date(body.deadline) : null,
        });
        await activityService.record({
            projectId: task.projectId,
            actorId: req.authUser.id,
            type: 'TASK_CREATED',
            entityType: 'TASK',
            entityId: task.id,
            metadata: { title: task.title },
        });
        if (task.assigneeId) {
            await notificationService.create({
                userId: task.assigneeId,
                projectId: task.projectId,
                type: 'TASK_ASSIGNED',
                title: 'New task assigned to you',
                body: task.title,
                href: `/projects/${task.projectId}`,
                data: { taskId: task.id },
            });
        }
        else {
            const members = await prisma.projectMember.findMany({
                where: { projectId: task.projectId },
                select: { userId: true },
            });
            const recipients = members.map(m => m.userId).filter((id) => id !== req.authUser.id);
            await Promise.all(recipients.map((userId) => notificationService.create({
                userId,
                projectId: task.projectId,
                type: 'TASK_CREATED',
                title: 'New task created',
                body: task.title,
                href: `/projects/${task.projectId}`,
                data: { taskId: task.id },
            })));
        }
        return reply.status(201).send(task);
    });
    app.patch('/tasks/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        const body = updateTaskSchema.parse(req.body);
        const existing = await taskService.getById(id);
        if (!existing)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            // Allow any member to edit general fields, but enforce READY transition separately below
            await requireProjectRole(existing.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        if (body.deadline) {
            const deadlineDate = new Date(body.deadline);
            const now = new Date();
            if (deadlineDate.getTime() < now.getTime()) {
                throw new Error('Deadline cannot be in the past');
            }
        }
        if (String(body.status) === 'READY') {
            try {
                await requireProjectRole(existing.projectId, req.authUser.id, ['MASTER_ADMIN']);
            }
            catch {
                return reply.status(403).send({ error: 'Only MASTER_ADMIN can move tasks to READY' });
            }
        }
        const updated = await taskService.update(id, {
            ...body,
            deadline: body.deadline ? new Date(body.deadline) : null,
        });
        await activityService.record({
            projectId: updated.projectId,
            actorId: req.authUser.id,
            type: 'TASK_UPDATED',
            entityType: 'TASK',
            entityId: updated.id,
            metadata: { fields: Object.keys(body) },
        });
        if (body.assigneeId) {
            await notificationService.create({
                userId: body.assigneeId,
                projectId: updated.projectId,
                type: 'TASK_ASSIGNED',
                title: 'New task assigned to you',
                body: updated.title,
                href: `/projects/${updated.projectId}`,
                data: { taskId: updated.id },
            });
        }
        else if ('assigneeId' in body) {
            // Explicitly cleared / switched to Everyone
            const members = await prisma.projectMember.findMany({
                where: { projectId: updated.projectId },
                select: { userId: true },
            });
            const recipients = members.map(m => m.userId).filter((id) => id !== req.authUser.id);
            await Promise.all(recipients.map((userId) => notificationService.create({
                userId,
                projectId: updated.projectId,
                type: 'TASK_UPDATED',
                title: 'Task updated',
                body: updated.title,
                href: `/projects/${updated.projectId}`,
                data: { taskId: updated.id },
            })));
        }
        return updated;
    });
    app.delete('/tasks/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        await taskService.delete(id);
        return reply.status(204).send();
    });
}
