import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { prisma } from '../lib/prisma.js';
import { auditLogService, computeChanges } from '../services/auditLog.service.js';
// ─── Validation schemas ───────────────────────────────────────────────────────
const VALID_TRIGGERS = [
    'TASK_CREATED',
    'TASK_STATUS_CHANGED',
    'TASK_ASSIGNED',
    'TASK_PRIORITY_CHANGED',
    'TASK_DEADLINE_APPROACHING',
    'SPRINT_STARTED',
    'SPRINT_COMPLETED',
];
const VALID_ACTION_TYPES = [
    'SET_STATUS',
    'SET_PRIORITY',
    'ASSIGN_TO_MEMBER',
    'UNASSIGN_TASK',
    'ADD_TAG',
    'SEND_NOTIFICATION',
    'MOVE_TO_SPRINT',
    'REMOVE_FROM_SPRINT',
];
const actionSchema = z.object({
    type: z.enum(VALID_ACTION_TYPES),
    params: z.record(z.string(), z.unknown()).default({}),
});
const conditionSchema = z
    .object({
    fromStatus: z.string().optional(),
    toStatus: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    taskType: z.string().optional(),
    hasAssignee: z.boolean().optional(),
    tagName: z.string().optional(),
})
    .optional();
const createRuleSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    trigger: z.enum(VALID_TRIGGERS),
    conditions: conditionSchema,
    actions: z.array(actionSchema).min(1, 'At least one action is required'),
    executionOrder: z.number().int().nonnegative().default(0),
});
const updateRuleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isEnabled: z.boolean().optional(),
    trigger: z.enum(VALID_TRIGGERS).optional(),
    conditions: conditionSchema,
    actions: z.array(actionSchema).min(1).optional(),
    executionOrder: z.number().int().nonnegative().optional(),
});
// ─── Routes ───────────────────────────────────────────────────────────────────
export async function automationRoutes(app) {
    // ── GET /projects/:projectId/automations ── List all rules
    app.get('/projects/:projectId/automations', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const rules = await prisma.automationRule.findMany({
            where: { projectId },
            include: {
                createdBy: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { logs: true } },
            },
            orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
        });
        return rules;
    });
    // ── POST /projects/:projectId/automations ── Create a rule
    app.post('/projects/:projectId/automations', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const body = createRuleSchema.parse(req.body);
        const rule = await prisma.automationRule.create({
            data: {
                projectId,
                name: body.name,
                description: body.description,
                trigger: body.trigger,
                conditions: body.conditions ?? undefined,
                actions: body.actions,
                executionOrder: body.executionOrder,
                createdById: req.authUser.id,
            },
            include: {
                createdBy: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { logs: true } },
            },
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'CREATE',
            entityType: 'AUTOMATION',
            entityId: rule.id,
            entityName: rule.name,
            projectId,
            metadata: { trigger: rule.trigger, isEnabled: rule.isEnabled },
            req,
        });
        return reply.status(201).send(rule);
    });
    // ── PATCH /projects/:projectId/automations/:ruleId ── Update a rule
    app.patch('/projects/:projectId/automations/:ruleId', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, ruleId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Automation rule not found' });
        }
        const body = updateRuleSchema.parse(req.body);
        const updated = await prisma.automationRule.update({
            where: { id: ruleId },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
                ...(body.trigger !== undefined && { trigger: body.trigger }),
                ...(body.conditions !== undefined && { conditions: body.conditions ?? null }),
                ...(body.actions !== undefined && { actions: body.actions }),
                ...(body.executionOrder !== undefined && { executionOrder: body.executionOrder }),
            },
            include: {
                createdBy: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { logs: true } },
            },
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'UPDATE',
            entityType: 'AUTOMATION',
            entityId: updated.id,
            entityName: updated.name,
            projectId,
            changes: computeChanges(existing, updated, Object.keys(body)),
            metadata: { fields: Object.keys(body) },
            req,
        });
        return updated;
    });
    // ── POST /projects/:projectId/automations/:ruleId/toggle ── Enable / disable
    app.post('/projects/:projectId/automations/:ruleId/toggle', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, ruleId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Automation rule not found' });
        }
        const updated = await prisma.automationRule.update({
            where: { id: ruleId },
            data: { isEnabled: !existing.isEnabled },
        });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'UPDATE',
            entityType: 'AUTOMATION',
            entityId: updated.id,
            entityName: existing.name,
            projectId,
            changes: { isEnabled: { from: existing.isEnabled, to: updated.isEnabled } },
            metadata: { toggle: true },
            req,
        });
        return { id: updated.id, isEnabled: updated.isEnabled };
    });
    // ── DELETE /projects/:projectId/automations/:ruleId ── Delete a rule
    app.delete('/projects/:projectId/automations/:ruleId', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, ruleId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Automation rule not found' });
        }
        await prisma.automationRule.delete({ where: { id: ruleId } });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'DELETE',
            entityType: 'AUTOMATION',
            entityId: existing.id,
            entityName: existing.name,
            projectId,
            metadata: { trigger: existing.trigger },
            req,
        });
        return reply.status(204).send();
    });
    // ── GET /projects/:projectId/automations/:ruleId/logs ── Execution logs (paginated)
    app.get('/projects/:projectId/automations/:ruleId/logs', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, ruleId } = req.params;
        const query = req.query;
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const existing = await prisma.automationRule.findUnique({ where: { id: ruleId } });
        if (!existing || existing.projectId !== projectId) {
            return reply.status(404).send({ error: 'Automation rule not found' });
        }
        const [logs, total] = await Promise.all([
            prisma.automationLog.findMany({
                where: { ruleId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.automationLog.count({ where: { ruleId } }),
        ]);
        return { logs, total, page, limit };
    });
    // ── GET /projects/:projectId/automations-logs ── Recent logs for entire project
    app.get('/projects/:projectId/automation-logs', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const query = req.query;
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const logs = await prisma.automationLog.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                rule: { select: { id: true, name: true, trigger: true } },
            },
        });
        return logs;
    });
}
