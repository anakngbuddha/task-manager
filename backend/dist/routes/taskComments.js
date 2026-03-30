import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { taskCommentService } from '../services/taskComment.service.js';
import { activityService } from '../services/activity.service.js';
import { notificationService } from '../services/notification.service.js';
import { prisma } from '../lib/prisma.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
const createCommentSchema = z.object({
    content: z.string().min(1).max(1000),
    parentId: z.string().optional(),
});
async function requireTaskMembership(taskId, userId, reply) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (!task) {
        reply.status(404).send({ error: 'Task not found' });
        return null;
    }
    try {
        await requireProjectRole(task.projectId, userId, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
    }
    catch {
        reply.status(403).send({ error: 'Forbidden' });
        return null;
    }
    return task;
}
export async function taskCommentRoutes(app) {
    app.get('/tasks/:taskId/comments', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const task = await requireTaskMembership(taskId, req.authUser.id, reply);
        if (!task)
            return;
        return taskCommentService.listForTask(taskId);
    });
    app.post('/tasks/:taskId/comments', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const taskCheck = await requireTaskMembership(taskId, req.authUser.id, reply);
        if (!taskCheck)
            return;
        const body = createCommentSchema.parse(req.body);
        const created = await taskCommentService.create({
            taskId,
            authorId: req.authUser.id,
            content: body.content,
            parentId: body.parentId,
        });
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                projectId: true,
                title: true,
                assigneeId: true,
                project: {
                    select: {
                        name: true,
                        members: { select: { userId: true } },
                    },
                },
            },
        });
        if (task) {
            await activityService.record({
                projectId: task.projectId,
                actorId: req.authUser.id,
                type: body.parentId ? 'TASK_COMMENT_REPLIED' : 'TASK_COMMENT_ADDED',
                entityType: 'TASK',
                entityId: taskId,
                metadata: { taskTitle: task.title },
            });
            const commentHref = `/projects/${task.projectId}/tasks/${taskId}`;
            const notifTitle = `New comment on "${task.title}"`;
            const notifBody = body.content.slice(0, 120);
            if (task.assigneeId && task.assigneeId !== req.authUser.id) {
                // Notify the assignee specifically
                await notificationService.create({
                    userId: task.assigneeId,
                    projectId: task.projectId,
                    type: 'TASK_COMMENT',
                    title: notifTitle,
                    body: notifBody,
                    href: commentHref,
                    data: { taskId, projectId: task.projectId, fromUserId: req.authUser.id },
                });
            }
            else if (!task.assigneeId) {
                // Unassigned task: notify all project members except the commenter
                const memberIds = (task.project?.members ?? [])
                    .map((m) => m.userId)
                    .filter((id) => id !== req.authUser.id);
                for (const uid of memberIds) {
                    await notificationService.create({
                        userId: uid,
                        projectId: task.projectId,
                        type: 'TASK_COMMENT',
                        title: notifTitle,
                        body: notifBody,
                        href: commentHref,
                        data: { taskId, projectId: task.projectId, fromUserId: req.authUser.id },
                    });
                }
            }
        }
        return created;
    });
}
