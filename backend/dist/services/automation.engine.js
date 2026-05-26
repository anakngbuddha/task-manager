import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socketManager.js';
import { notificationService } from './notification.service.js';
import { logger } from '../app.js';
// ─── Condition Evaluator ──────────────────────────────────────────────────────
function evaluateConditions(conditions, ctx) {
    if (!conditions || Object.keys(conditions).length === 0)
        return true;
    const task = ctx.task;
    const changes = ctx.changes ?? [];
    if ('fromStatus' in conditions && task) {
        const fromChange = changes.find((c) => c.field === 'status');
        if (!fromChange)
            return false;
        if (String(fromChange.from).toUpperCase() !== String(conditions.fromStatus).toUpperCase())
            return false;
    }
    if ('toStatus' in conditions && task) {
        const toChange = changes.find((c) => c.field === 'status');
        const currentStatus = toChange ? String(toChange.to).toUpperCase() : task.status.toUpperCase();
        if (currentStatus !== String(conditions.toStatus).toUpperCase())
            return false;
    }
    if ('priority' in conditions && task) {
        if (task.priority.toUpperCase() !== String(conditions.priority).toUpperCase())
            return false;
    }
    if ('taskType' in conditions && task) {
        // task type would need to be in context; skip silently if not present
    }
    if ('hasAssignee' in conditions && task) {
        const expected = Boolean(conditions.hasAssignee);
        const actual = task.assigneeId !== null;
        if (expected !== actual)
            return false;
    }
    if ('tagName' in conditions && task) {
        const tags = task.tags ?? [];
        const hasTag = tags.some((t) => t.tag.name.toLowerCase() === String(conditions.tagName).toLowerCase());
        if (!hasTag)
            return false;
    }
    return true;
}
// ─── Action Executor ──────────────────────────────────────────────────────────
async function executeAction(action, ctx) {
    const result = { type: action.type, params: action.params, success: false };
    try {
        const task = ctx.task;
        switch (action.type) {
            case 'SET_STATUS': {
                if (!task)
                    throw new Error('No task in context');
                const newStatus = String(action.params.status ?? '').trim().toUpperCase().replace(/\s+/g, '_');
                if (!newStatus)
                    throw new Error('SET_STATUS requires a status param');
                // Ensure project has the column
                const project = await prisma.project.findUnique({ where: { id: ctx.projectId }, select: { boardColumns: true } });
                const cols = Array.isArray(project?.boardColumns) ? project.boardColumns : [];
                if (!cols.includes(newStatus)) {
                    await prisma.project.update({
                        where: { id: ctx.projectId },
                        data: { boardColumns: [...cols, newStatus] },
                    });
                }
                await prisma.task.update({ where: { id: task.id }, data: { status: newStatus } });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, status: newStatus }, actorId: 'automation' });
                break;
            }
            case 'SET_PRIORITY': {
                if (!task)
                    throw new Error('No task in context');
                const priority = String(action.params.priority ?? '').toUpperCase();
                const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
                if (!validPriorities.includes(priority))
                    throw new Error(`Invalid priority: ${priority}`);
                await prisma.task.update({ where: { id: task.id }, data: { priority: priority } });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, priority }, actorId: 'automation' });
                break;
            }
            case 'ASSIGN_TO_MEMBER': {
                if (!task)
                    throw new Error('No task in context');
                const userId = String(action.params.userId ?? '');
                if (!userId)
                    throw new Error('ASSIGN_TO_MEMBER requires a userId param');
                // Verify member belongs to project
                const member = await prisma.projectMember.findUnique({
                    where: { userId_projectId: { userId, projectId: ctx.projectId } },
                });
                if (!member)
                    throw new Error(`User ${userId} is not a member of this project`);
                await prisma.task.update({ where: { id: task.id }, data: { assigneeId: userId } });
                await notificationService.create({
                    userId,
                    projectId: ctx.projectId,
                    type: 'TASK_ASSIGNED',
                    title: 'Task assigned to you (automation)',
                    body: task.title,
                    href: `/projects/${ctx.projectId}`,
                    data: { taskId: task.id },
                });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, assigneeId: userId }, actorId: 'automation' });
                break;
            }
            case 'UNASSIGN_TASK': {
                if (!task)
                    throw new Error('No task in context');
                await prisma.task.update({ where: { id: task.id }, data: { assigneeId: null } });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, assigneeId: null }, actorId: 'automation' });
                break;
            }
            case 'ADD_TAG': {
                if (!task)
                    throw new Error('No task in context');
                const tagName = String(action.params.tagName ?? '').trim().toLowerCase();
                if (!tagName)
                    throw new Error('ADD_TAG requires a tagName param');
                let tag = await prisma.tag.findUnique({ where: { name: tagName } });
                if (!tag) {
                    tag = await prisma.tag.create({ data: { name: tagName } });
                }
                // Upsert the task-tag link
                await prisma.taskTag.upsert({
                    where: { taskId_tagId: { taskId: task.id, tagId: tag.id } },
                    update: {},
                    create: { taskId: task.id, tagId: tag.id },
                });
                break;
            }
            case 'SEND_NOTIFICATION': {
                const message = String(action.params.message ?? 'Automation triggered');
                const to = String(action.params.to ?? 'ASSIGNEE');
                const taskTitle = task?.title ?? ctx.sprint?.name ?? 'Project event';
                const href = task ? `/projects/${ctx.projectId}?task=${task.id}` : `/projects/${ctx.projectId}`;
                let recipients = [];
                if (to === 'ASSIGNEE' && task?.assigneeId) {
                    recipients = [task.assigneeId];
                }
                else if (to === 'MANAGERS') {
                    const managers = await prisma.projectMember.findMany({
                        where: { projectId: ctx.projectId, role: { in: ['MASTER_ADMIN', 'PROJECT_MANAGER'] } },
                        select: { userId: true },
                    });
                    recipients = managers.map((m) => m.userId);
                }
                else {
                    // ALL
                    const all = await prisma.projectMember.findMany({
                        where: { projectId: ctx.projectId },
                        select: { userId: true },
                    });
                    recipients = all.map((m) => m.userId);
                }
                await Promise.all(recipients.map((userId) => notificationService.create({
                    userId,
                    projectId: ctx.projectId,
                    type: 'AUTOMATION',
                    title: message,
                    body: taskTitle,
                    href,
                    data: task ? { taskId: task.id } : undefined,
                })));
                break;
            }
            case 'MOVE_TO_SPRINT': {
                if (!task)
                    throw new Error('No task in context');
                const sprintId = String(action.params.sprintId ?? '');
                if (!sprintId)
                    throw new Error('MOVE_TO_SPRINT requires a sprintId param');
                const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true, projectId: true } });
                if (!sprint || sprint.projectId !== ctx.projectId)
                    throw new Error('Sprint not found in this project');
                await prisma.task.update({ where: { id: task.id }, data: { sprintId } });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, sprintId }, actorId: 'automation' });
                break;
            }
            case 'REMOVE_FROM_SPRINT': {
                if (!task)
                    throw new Error('No task in context');
                await prisma.task.update({ where: { id: task.id }, data: { sprintId: null } });
                getIO().to(ctx.projectId).emit('task:updated', { task: { ...task, sprintId: null }, actorId: 'automation' });
                break;
            }
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
        result.success = true;
    }
    catch (err) {
        result.error = err?.message ?? String(err);
    }
    return result;
}
// ─── Main Engine ─────────────────────────────────────────────────────────────
export async function runAutomations(ctx) {
    // Depth guard — prevent infinite chains
    const depth = ctx.depth ?? 0;
    if (depth > 3) {
        logger.warn({ projectId: ctx.projectId }, '[automation] Max chain depth reached for project, aborting.');
        return;
    }
    try {
        const rules = await prisma.automationRule.findMany({
            where: {
                projectId: ctx.projectId,
                trigger: ctx.triggerType,
                isEnabled: true,
            },
            orderBy: { executionOrder: 'asc' },
        });
        if (rules.length === 0)
            return;
        for (const rule of rules) {
            const conditions = rule.conditions;
            if (!evaluateConditions(conditions, ctx))
                continue;
            const actions = rule.actions ?? [];
            const actionResults = [];
            let overallSuccess = true;
            let errorMsg;
            for (const action of actions) {
                const res = await executeAction(action, ctx);
                actionResults.push(res);
                if (!res.success) {
                    overallSuccess = false;
                    errorMsg = res.error;
                    // Continue executing remaining actions even if one fails
                }
            }
            // Log the execution
            await prisma.automationLog.create({
                data: {
                    ruleId: rule.id,
                    projectId: ctx.projectId,
                    taskId: ctx.task?.id ?? null,
                    sprintId: ctx.sprint?.id ?? null,
                    triggerData: {
                        triggerType: ctx.triggerType,
                        changes: ctx.changes,
                        taskId: ctx.task?.id,
                        sprintId: ctx.sprint?.id,
                    },
                    actionsRun: actionResults,
                    success: overallSuccess,
                    errorMessage: errorMsg ?? null,
                },
            });
            // Broadcast to room so the UI can show live log updates
            getIO().to(ctx.projectId).emit('automation:fired', {
                ruleId: rule.id,
                ruleName: rule.name,
                success: overallSuccess,
                taskId: ctx.task?.id,
            });
            logger.info({ ruleName: rule.name, depth, success: overallSuccess }, '[automation] Rule fired');
        }
    }
    catch (err) {
        logger.error({ err }, '[automation] Engine error');
    }
}
