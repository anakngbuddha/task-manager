import { authenticate } from '../middlewares/authenticate.js';
import { prisma } from '../lib/prisma.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { auditLogService } from '../services/auditLog.service.js';
const MAX_TAG_LENGTH = 30;
function normalizeTagName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, MAX_TAG_LENGTH);
}
export async function tagRoutes(app) {
    // ── GET /tags?search= — autocomplete ──────────────────────────────
    app.get('/tags', { preHandler: authenticate }, async (req, reply) => {
        const { search } = req.query;
        const where = search?.trim()
            ? { name: { contains: normalizeTagName(search) } }
            : {};
        const tags = await prisma.tag.findMany({
            where,
            orderBy: { name: 'asc' },
            take: 20,
        });
        return tags;
    });
    // ── POST /tags — create or upsert a tag ───────────────────────────
    app.post('/tags', { preHandler: authenticate }, async (req, reply) => {
        const { name, color } = req.body;
        const normalized = normalizeTagName(name ?? '');
        if (!normalized) {
            return reply.status(400).send({ error: 'Tag name is required' });
        }
        if (normalized.length > MAX_TAG_LENGTH) {
            return reply.status(400).send({ error: `Tag name must be at most ${MAX_TAG_LENGTH} characters` });
        }
        const tag = await prisma.tag.upsert({
            where: { name: normalized },
            update: {},
            create: { name: normalized, color: color ?? '#6366f1' },
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'CREATE',
            entityType: 'SETTINGS',
            entityId: tag.id,
            entityName: tag.name,
            changes: { name: { from: null, to: tag.name }, color: { from: null, to: tag.color } },
            metadata: { upsert: true },
            req,
        });
        return reply.status(201).send(tag);
    });
    // ── GET /tasks/:taskId/tags — list tags for one task ──────────────
    app.get('/tasks/:taskId/tags', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, [
                'MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER',
            ]);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const taskTags = await prisma.taskTag.findMany({
            where: { taskId },
            include: { tag: true },
            orderBy: { tag: { name: 'asc' } },
        });
        return taskTags.map((tt) => tt.tag);
    });
    // ── POST /tasks/:taskId/tags — assign a tag to a task ────────────
    app.post('/tasks/:taskId/tags', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const { tagId, name, color } = req.body;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, [
                'MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER',
            ]);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        // Resolve tag — either by id or by name (upsert if new)
        let resolvedTagId = tagId;
        if (!resolvedTagId) {
            const normalized = normalizeTagName(name ?? '');
            if (!normalized) {
                return reply.status(400).send({ error: 'Either tagId or name is required' });
            }
            if (normalized.length > MAX_TAG_LENGTH) {
                return reply.status(400).send({ error: `Tag name must be at most ${MAX_TAG_LENGTH} characters` });
            }
            const tag = await prisma.tag.upsert({
                where: { name: normalized },
                update: {},
                create: { name: normalized, color: color ?? '#6366f1' },
            });
            resolvedTagId = tag.id;
        }
        // Check tag exists
        const tag = await prisma.tag.findUnique({ where: { id: resolvedTagId } });
        if (!tag)
            return reply.status(404).send({ error: 'Tag not found' });
        // Upsert the join — idempotent
        await prisma.taskTag.upsert({
            where: { taskId_tagId: { taskId, tagId: resolvedTagId } },
            update: {},
            create: { taskId, tagId: resolvedTagId },
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'UPDATE',
            entityType: 'TASK',
            entityId: taskId,
            entityName: `task:${taskId}`,
            projectId: task.projectId,
            metadata: { tagId: resolvedTagId, tagName: tag.name, op: 'ADD_TAG' },
            req,
        });
        return reply.status(201).send(tag);
    });
    // ── DELETE /tasks/:taskId/tags/:tagId — remove a tag from a task ──
    app.delete('/tasks/:taskId/tags/:tagId', { preHandler: authenticate }, async (req, reply) => {
        const { taskId, tagId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, [
                'MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER',
            ]);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        await prisma.taskTag.deleteMany({ where: { taskId, tagId } });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'UPDATE',
            entityType: 'TASK',
            entityId: taskId,
            entityName: `task:${taskId}`,
            projectId: task.projectId,
            metadata: { tagId, op: 'REMOVE_TAG' },
            req,
        });
        return reply.status(204).send();
    });
    // ── GET /projects/:projectId/tasks/filtered?tag= — filter by tag ──
    app.get('/projects/:projectId/tasks/filtered', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const { tag } = req.query;
        try {
            await requireProjectRole(projectId, req.authUser.id, [
                'MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER',
            ]);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const normalized = tag ? normalizeTagName(tag) : undefined;
        const tasks = await prisma.task.findMany({
            where: {
                projectId,
                ...(normalized
                    ? { tags: { some: { tag: { name: normalized } } } }
                    : {}),
            },
            include: {
                assignee: true,
                children: { select: { id: true, title: true, type: true, status: true } },
                parent: { select: { id: true, title: true, type: true } },
                blockingTasks: { include: { blockedTask: true } },
                blockedByTasks: { include: { blockingTask: true } },
                tags: { include: { tag: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return tasks;
    });
}
