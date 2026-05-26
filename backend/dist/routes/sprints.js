import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { sprintService } from '../services/sprint.service.js';
import { runAutomations } from '../services/automation.engine.js';
import { auditLogService, computeChanges } from '../services/auditLog.service.js';
import { logger } from '../app.js';
const createSprintSchema = z.object({
    name: z.string().min(1).max(100),
    goal: z.string().max(1000).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});
const updateSprintSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    goal: z.string().max(1000).nullable().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});
const startSprintSchema = z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
});
const completeSprintSchema = z.object({
    moveIncompleteTasksTo: z.string().min(1),
});
const assignTasksSchema = z.object({
    taskIds: z.array(z.string()).min(0),
});
export async function sprintRoutes(app) {
    app.get('/projects/:projectId/sprints', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        return sprintService.list(projectId);
    });
    app.get('/projects/:projectId/sprints/active', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const sprint = await sprintService.getActiveSprint(projectId);
        if (!sprint)
            return reply.status(404).send({ error: 'No active sprint' });
        return sprint;
    });
    app.post('/projects/:projectId/sprints', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const body = createSprintSchema.parse(req.body);
        const sprint = await sprintService.create({
            projectId,
            name: body.name,
            goal: body.goal,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : undefined,
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'CREATE',
            entityType: 'SPRINT',
            entityId: sprint.id,
            entityName: sprint.name,
            projectId,
            metadata: { name: sprint.name },
            req,
        });
        return reply.status(201).send(sprint);
    });
    app.patch('/projects/:projectId/sprints/:sprintId', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await sprintService.getById(sprintId);
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Sprint not found' });
        }
        const body = updateSprintSchema.parse(req.body);
        try {
            const updated = await sprintService.update(sprintId, {
                name: body.name,
                goal: body.goal,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
            });
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'UPDATE',
                entityType: 'SPRINT',
                entityId: updated.id,
                entityName: updated.name,
                projectId,
                changes: computeChanges(existing, updated, Object.keys(body)),
                metadata: { fields: Object.keys(body) },
                req,
            });
            return updated;
        }
        catch (e) {
            return reply.status(400).send({ error: e.message });
        }
    });
    app.post('/projects/:projectId/sprints/:sprintId/start', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await sprintService.getById(sprintId);
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Sprint not found' });
        }
        const body = startSprintSchema.parse(req.body);
        const startDate = new Date(body.startDate);
        const endDate = new Date(body.endDate);
        try {
            const sprint = await sprintService.startSprint(sprintId, { startDate, endDate });
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'UPDATE',
                entityType: 'SPRINT',
                entityId: sprint.id,
                entityName: sprint.name,
                projectId,
                changes: { status: { from: existing.status, to: sprint.status } },
                metadata: { startDate: body.startDate, endDate: body.endDate },
                req,
            });
            runAutomations({
                projectId,
                actorId: req.authUser.id,
                triggerType: 'SPRINT_STARTED',
                sprint: { id: sprint.id, name: sprint.name, projectId, status: sprint.status },
            }).catch((err) => logger.error({ err }, 'automation_sprint_started_hook_error'));
            return sprint;
        }
        catch (e) {
            return reply.status(400).send({ error: e.message });
        }
    });
    app.post('/projects/:projectId/sprints/:sprintId/complete', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await sprintService.getById(sprintId);
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Sprint not found' });
        }
        const body = completeSprintSchema.parse(req.body);
        try {
            const result = await sprintService.completeSprint(sprintId, body.moveIncompleteTasksTo);
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'UPDATE',
                entityType: 'SPRINT',
                entityId: sprintId,
                entityName: existing.name,
                projectId,
                changes: { status: { from: existing.status, to: 'COMPLETED' } },
                metadata: { moveIncompleteTasksTo: body.moveIncompleteTasksTo },
                req,
            });
            runAutomations({
                projectId,
                actorId: req.authUser.id,
                triggerType: 'SPRINT_COMPLETED',
                sprint: { id: sprintId, name: existing.name, projectId, status: 'COMPLETED' },
            }).catch((err) => logger.error({ err }, 'automation_sprint_completed_hook_error'));
            return result;
        }
        catch (e) {
            return reply.status(400).send({ error: e.message });
        }
    });
    app.delete('/projects/:projectId/sprints/:sprintId', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await sprintService.getById(sprintId);
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Sprint not found' });
        }
        try {
            await sprintService.delete(sprintId);
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'DELETE',
                entityType: 'SPRINT',
                entityId: existing.id,
                entityName: existing.name,
                projectId,
                metadata: { name: existing.name },
                req,
            });
            return reply.status(204).send();
        }
        catch (e) {
            return reply.status(400).send({ error: e.message });
        }
    });
    app.patch('/projects/:projectId/sprints/:sprintId/assign-tasks', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await sprintService.getById(sprintId);
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Sprint not found' });
        }
        const { taskIds } = assignTasksSchema.parse(req.body);
        try {
            return await sprintService.assignTasks(sprintId, projectId, taskIds);
        }
        catch (e) {
            return reply.status(400).send({ error: e.message });
        }
    });
    app.get('/projects/:projectId/sprints/:sprintId/burndown', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, sprintId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const result = await sprintService.getBurndown(projectId, sprintId);
        if (!result)
            return reply.status(404).send({ error: 'Sprint not found' });
        return result;
    });
}
