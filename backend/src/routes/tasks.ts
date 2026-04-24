import { FastifyInstance } from 'fastify'
import { taskService } from '../services/task.service.js'
import { authenticate } from '../middlewares/authenticate.js'
import { idempotencyPreHandler } from '../middlewares/idempotency.js'
import { z } from 'zod'
import { activityService } from '../services/activity.service.js'
import { notificationService } from '../services/notification.service.js'
import { prisma } from '../lib/prisma.js'
import { requireProjectRole } from '../services/projectAuth.service.js'

const DEFAULT_BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY'] as const

function normalizeStatus(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '_')
}

async function ensureProjectHasStatus(projectId: string, status: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, boardColumns: true },
  })
  if (!project) return null

  const currentColumns = Array.isArray(project.boardColumns) && project.boardColumns.length > 0
    ? project.boardColumns.map((s) => String(s))
    : [...DEFAULT_BOARD_COLUMNS]

  if (currentColumns.includes(status)) {
    return { project, statusList: currentColumns }
  }

  // Atomic: re-read and append inside a transaction to avoid lost-update race
  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.project.findUnique({
      where: { id: projectId },
      select: { boardColumns: true },
    })
    const cols = Array.isArray(fresh?.boardColumns) && fresh!.boardColumns.length > 0
      ? fresh!.boardColumns.map((s) => String(s))
      : [...DEFAULT_BOARD_COLUMNS]
    if (cols.includes(status)) return cols
    const newCols = [...cols, status]
    await tx.project.update({
      where: { id: projectId },
      data: { boardColumns: newCols },
    })
    return newCols
  })

  return { project, statusList: updated }
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  projectId: z.string(),
  assigneeId: z.string().min(1, 'Assignee is required').nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  status: z.string().min(1, 'Status is required'),
  // If explicitly 'null', task will not belong to any sprint.
  sprintId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  type: z.enum(['EPIC', 'STORY', 'TASK']).optional().default('TASK'),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime({ message: 'Valid deadline is required' }).nullable().optional(),
  githubPrUrl: z.string().url().nullable().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().nullable().optional(),
  // If null, clear sprint assignment.
  sprintId: z.string().nullable().optional(),
  type: z.enum(['EPIC', 'STORY', 'TASK']).optional().default('TASK'),
  parentId: z.string().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  githubPrUrl: z.string().url().nullable().optional(),
})

const hierarchyLevelMap: Record<string, number> = {
  EPIC: 0, STORY: 1, TASK: 2
};

async function validateTaskParent({
  childTaskId,
  projectId,
  parentId,
  childHierarchyLevel,
}: {
  childTaskId?: string
  projectId: string
  parentId: string
  childHierarchyLevel: number
}) {
  const parentTask = await prisma.task.findUnique({
    where: { id: parentId },
    select: { id: true, projectId: true, hierarchyLevel: true, parentId: true },
  })

  if (!parentTask) {
    return { ok: false as const, error: 'Parent task not found' }
  }
  if (parentTask.projectId !== projectId) {
    return { ok: false as const, error: 'Parent task must belong to the same project' }
  }
  if (childTaskId && parentTask.id === childTaskId) {
    return { ok: false as const, error: 'A task cannot be its own parent' }
  }
  if (childHierarchyLevel <= parentTask.hierarchyLevel) {
    return {
      ok: false as const,
      error: 'Invalid task hierarchy level. A child must have a strictly greater hierarchy level than its parent.',
    }
  }

  // Reject cycles when re-parenting an existing task.
  if (childTaskId) {
    let cursor: string | null = parentTask.parentId ?? null
    while (cursor) {
      if (cursor === childTaskId) {
        return { ok: false as const, error: 'Invalid hierarchy: cyclic parent relationship detected' }
      }
      const next = await prisma.task.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      })
      cursor = next?.parentId ?? null
    }
  }

  return { ok: true as const }
}

export async function taskRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/tasks', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return taskService.getAll(projectId)
  })

  app.get('/tasks/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        blockingTasks: { include: { blockedTask: true } },
        blockedByTasks: { include: { blockingTask: true } },
      },
    })
    if (!task) return reply.status(404).send({ error: 'Task not found' })
    try {
      await requireProjectRole(task.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return task
  })

  app.post('/tasks', {
    preHandler: [authenticate, idempotencyPreHandler('tasks.create')],
  }, async (req, reply) => {
    const body = createTaskSchema.parse(req.body)
    const normalizedStatus = normalizeStatus(body.status)
    try {
      await requireProjectRole(body.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (!(await ensureProjectHasStatus(body.projectId, normalizedStatus))) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    // Enforce that sprintId (if provided) belongs to the same project.
    if (body.sprintId != null) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: body.sprintId },
        select: { id: true, projectId: true },
      })
      if (!sprint || sprint.projectId !== body.projectId) {
        return reply.status(400).send({ error: 'Sprint not found for this project' })
      }
    }

    const now = new Date()
    if (body.deadline) {
      const deadlineDate = new Date(body.deadline)
      if (deadlineDate.getTime() < now.getTime()) {
        return reply.status(400).send({ error: 'Deadline cannot be in the past' })
      }
    }

    const type = body.type || 'TASK';
    const hierarchyLevel = hierarchyLevelMap[type as string];

    if (body.parentId) {
      const parentValidation = await validateTaskParent({
        projectId: body.projectId,
        parentId: body.parentId,
        childHierarchyLevel: hierarchyLevel,
      })
      if (!parentValidation.ok) {
        return reply.status(400).send({ error: parentValidation.error })
      }
    }

    const existingTask = await prisma.task.findFirst({
      where: { projectId: body.projectId, title: body.title }
    })
    if (existingTask) {
      return reply.status(400).send({ error: 'A task with this title already exists in the project' })
    }

    if (body.assigneeId === 'EVERYONE') {
      const members = await prisma.projectMember.findMany({
        where: { projectId: body.projectId },
        select: { userId: true },
      })
      if (members.length === 0) {
        return reply.status(400).send({ error: 'No members in project' })
      }
      const tasks = await Promise.all(members.map(async (m) => {
        return taskService.create({
          ...body,
          assigneeId: m.userId,
          status: normalizedStatus,
          startDate: body.startDate ? new Date(body.startDate) : null,
          deadline: body.deadline ? new Date(body.deadline) : null,
          parentId: body.parentId ?? null,
          type: type as any,
          hierarchyLevel,
        })
      }))
      
      await activityService.record({
        projectId: tasks[0].projectId,
        actorId: req.authUser.id,
        type: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: tasks[0].id,
        metadata: { title: tasks[0].title, bulk: true },
      })

      await Promise.all(tasks.map(t => notificationService.create({
        userId: t.assigneeId!,
        projectId: t.projectId,
        type: 'TASK_ASSIGNED',
        title: 'New task assigned to you',
        body: t.title,
        href: `/projects/${t.projectId}`,
        data: { taskId: t.id },
      })))

      return reply.status(201).send({ ...tasks[0], bulkCount: tasks.length })
    }

    const task = await taskService.create({
      ...body,
      assigneeId: body.assigneeId ?? undefined,
      status: normalizedStatus,
      startDate: body.startDate ? new Date(body.startDate) : null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      parentId: body.parentId ?? null,
      type: type as any,
      hierarchyLevel,
    })

    await activityService.record({
      projectId: task.projectId,
      actorId: req.authUser.id,
      type: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task.id,
      metadata: { title: task.title },
    })

    if (task.assigneeId) {
      await notificationService.create({
        userId: task.assigneeId,
        projectId: task.projectId,
        type: 'TASK_ASSIGNED',
        title: 'New task assigned to you',
        body: task.title,
        href: `/projects/${task.projectId}`,
        data: { taskId: task.id },
      })
    } else {
      const members = await prisma.projectMember.findMany({
        where: { projectId: task.projectId },
        select: { userId: true },
      })
      const recipients = members.map(m => m.userId).filter((id) => id !== req.authUser.id)
      await Promise.all(recipients.map((userId) => notificationService.create({
        userId,
        projectId: task.projectId,
        type: 'TASK_CREATED',
        title: 'New task created',
        body: task.title,
        href: `/projects/${task.projectId}`,
        data: { taskId: task.id },
      })))
    }
    return reply.status(201).send(task)
  })

  app.patch('/tasks/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const rawBody = (req.body ?? {}) as Record<string, unknown>
    const body = updateTaskSchema.parse(req.body)
    const typeProvided = Object.prototype.hasOwnProperty.call(rawBody, 'type')
    if (!typeProvided) {
      delete (body as any).type
    }

    const existing = await taskService.getById(id)
    if (!existing) return reply.status(404).send({ error: 'Task not found' })

    const updateType = body.type || existing.type;
    const updateHierarchyLevel = hierarchyLevelMap[updateType as string];
    const parentToCheck = body.parentId !== undefined ? body.parentId : existing.parentId;

    if (parentToCheck) {
      const parentValidation = await validateTaskParent({
        childTaskId: id,
        projectId: existing.projectId,
        parentId: parentToCheck,
        childHierarchyLevel: updateHierarchyLevel,
      })
      if (!parentValidation.ok) {
        return reply.status(400).send({ error: parentValidation.error })
      }
    }

    if (body.type) {
      const children = await prisma.task.findMany({
        where: { parentId: id },
        select: { id: true, hierarchyLevel: true },
      })
      const invalidChild = children.find((child) => child.hierarchyLevel <= updateHierarchyLevel)
      if (invalidChild) {
        return reply.status(400).send({
          error: 'Invalid task hierarchy level. Selected type is incompatible with one or more existing child tasks.',
        })
      }
    }

    try {
      await requireProjectRole(existing.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (body.title && body.title !== existing.title) {
      const duplicateTask = await prisma.task.findFirst({
        where: { projectId: existing.projectId, title: body.title }
      })
      if (duplicateTask) {
        return reply.status(400).send({ error: 'A task with this title already exists in the project' })
      }
    }

    // Enforce that sprintId (if provided) belongs to the same project.
    if (body.sprintId != null) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: body.sprintId },
        select: { id: true, projectId: true },
      })
      if (!sprint || sprint.projectId !== existing.projectId) {
        return reply.status(400).send({ error: 'Sprint not found for this project' })
      }
    }

    if (body.deadline) {
      const deadlineDate = new Date(body.deadline)
      const now = new Date()
      if (deadlineDate.getTime() < now.getTime()) {
        return reply.status(400).send({ error: 'Deadline cannot be in the past' })
      }
    }

    if (body.startDate && body.deadline) {
      if (new Date(body.startDate).getTime() > new Date(body.deadline).getTime()) {
        return reply.status(400).send({ error: 'Start date must be before deadline' })
      }
    }

    const normalizedStatus = typeof body.status === 'string' ? normalizeStatus(body.status) : undefined

    if (normalizedStatus) {
      if (!(await ensureProjectHasStatus(existing.projectId, normalizedStatus))) {
        return reply.status(404).send({ error: 'Project not found' })
      }
    }

    const updateData: any = { ...body }
    if (body.type || body.parentId !== undefined) {
      updateData.hierarchyLevel = updateHierarchyLevel;
    }
    if (normalizedStatus) {
      updateData.status = normalizedStatus
    }
    // Only convert/overwrite dates if the client explicitly provided them.
    if ('deadline' in body) {
      updateData.deadline = body.deadline ? new Date(body.deadline) : null
    }
    if ('startDate' in body) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null
    }

    const updated = await taskService.update(id, updateData)

    await activityService.record({
      projectId: updated.projectId,
      actorId: req.authUser.id,
      type: 'TASK_UPDATED',
      entityType: 'TASK',
      entityId: updated.id,
      metadata: { fields: Object.keys(body) },
    })

    if (body.assigneeId) {
      await notificationService.create({
        userId: body.assigneeId,
        projectId: updated.projectId,
        type: 'TASK_ASSIGNED',
        title: 'New task assigned to you',
        body: updated.title,
        href: `/projects/${updated.projectId}`,
        data: { taskId: updated.id },
      })
    } else if ('assigneeId' in body) {
      // Explicitly cleared / switched to Everyone
      const members = await prisma.projectMember.findMany({
        where: { projectId: updated.projectId },
        select: { userId: true },
      })
      const recipients = members.map(m => m.userId).filter((id) => id !== req.authUser.id)
      await Promise.all(recipients.map((userId) => notificationService.create({
        userId,
        projectId: updated.projectId,
        type: 'TASK_UPDATED',
        title: 'Task updated',
        body: updated.title,
        href: `/projects/${updated.projectId}`,
        data: { taskId: updated.id },
      })))
    }

    // If status changed, notify the assignee (or all members if unassigned)
    if (normalizedStatus && normalizedStatus !== existing.status) {
      const statusLabel: Record<string, string> = {
        TODO: 'To Do',
        IN_PROGRESS: 'In Progress',
        IN_REVIEW: 'In Review',
        READY: 'Ready',
        DONE: 'Done',
      }
      const label = statusLabel[normalizedStatus] ?? normalizedStatus
      const statusHref = `/projects/${updated.projectId}`
      const statusTitle = `Task "${updated.title}" moved to ${label}`

      if (updated.assigneeId && updated.assigneeId !== req.authUser.id) {
        await notificationService.create({
          userId: updated.assigneeId,
          projectId: updated.projectId,
          type: 'TASK_STATUS_CHANGED',
          title: statusTitle,
          body: `Status changed to: ${label}`,
          href: statusHref,
          data: { taskId: updated.id },
        })
      } else if (!updated.assigneeId) {
        const allMembers = await prisma.projectMember.findMany({
          where: { projectId: updated.projectId },
          select: { userId: true },
        })
        const recipients = allMembers.map((m) => m.userId).filter((id) => id !== req.authUser.id)
        await Promise.all(recipients.map((userId) => notificationService.create({
          userId,
          projectId: updated.projectId,
          type: 'TASK_STATUS_CHANGED',
          title: statusTitle,
          body: `Status changed to: ${label}`,
          href: statusHref,
          data: { taskId: updated.id },
        })))
      }
    }

    return updated
  })


  app.delete('/tasks/:id', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await taskService.getById(id)
    if (!existing) return reply.status(404).send({ error: 'Task not found' })
    try {
      await requireProjectRole(existing.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await taskService.delete(id)
    return reply.status(204).send()
  })

  // Dependencies
  app.post('/tasks/:id/dependencies', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { targetTaskId, type } = req.body as { targetTaskId: string; type: 'BLOCKS' | 'IS_BLOCKED_BY' }

    if (id === targetTaskId) return reply.status(400).send({ error: 'Cannot depend on itself' })

    const existingTask = await taskService.getById(id)
    const targetTask = await taskService.getById(targetTaskId)
    if (!existingTask || !targetTask) return reply.status(404).send({ error: 'Task not found' })

    if (existingTask.projectId !== targetTask.projectId) {
      return reply.status(400).send({ error: 'Cannot create dependencies across different projects' })
    }

    try {
      await requireProjectRole(existingTask.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    let blockingTaskId = id
    let blockedTaskId = targetTaskId
    if (type === 'IS_BLOCKED_BY') {
      blockingTaskId = targetTaskId
      blockedTaskId = id
    }

    // Duplicate check
    const existing = await prisma.taskDependency.findUnique({
      where: { blockingTaskId_blockedTaskId: { blockingTaskId, blockedTaskId } },
    })
    if (existing) {
      return reply.status(409).send({ error: 'This dependency already exists' })
    }

    // Cycle detection: check if blockedTask already (transitively) blocks blockingTask
    const visited = new Set<string>()
    const queue = [blockingTaskId]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (current === blockedTaskId) {
        return reply.status(400).send({ error: 'This dependency would create a cycle' })
      }
      if (visited.has(current)) continue
      visited.add(current)
      const upstreamDeps = await prisma.taskDependency.findMany({
        where: { blockedTaskId: current },
        select: { blockingTaskId: true },
      })
      for (const d of upstreamDeps) queue.push(d.blockingTaskId)
    }

    const dep = await prisma.taskDependency.create({
      data: {
        blockingTaskId,
        blockedTaskId,
        type: 'BLOCKS',
      },
      include: {
        blockingTask: true,
        blockedTask: true,
      }
    })

    return reply.status(201).send(dep)
  })

  app.delete('/tasks/:id/dependencies/:depId', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { id, depId } = req.params as { id: string; depId: string }

    const dep = await prisma.taskDependency.findUnique({
      where: { id: depId },
      include: { blockingTask: true, blockedTask: true },
    })

    if (!dep) return reply.status(404).send({ error: 'Dependency not found' })
    if (dep.blockingTaskId !== id && dep.blockedTaskId !== id) {
      return reply.status(403).send({ error: 'Dependency does not belong to this task' })
    }

    try {
      await requireProjectRole(dep.blockingTask.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
    } catch {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await prisma.taskDependency.delete({ where: { id: depId } })
    return reply.status(204).send()
  })
}