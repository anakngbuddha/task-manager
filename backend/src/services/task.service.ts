import { prisma } from '../lib/prisma.js'
import { Prisma, Priority, TaskType } from '@prisma/client'
import { DONE_STATUSES } from '../config/constants.js'

/**
 * Relations loaded for task list responses.
 *
 * Extracted verbatim from the previous inline include in `getAll` so that
 * `getAll` and the new paginated `getPage` return structurally identical task
 * objects. That is deliberate: it lets callers adopt pagination without also
 * absorbing a response-shape change.
 *
 * This include is wider than the board strictly needs (`assignee: true` returns
 * every user column, and the dependency includes return whole task rows).
 * Narrowing it to explicit `select` blocks would cut payload size further, but
 * it silently changes the response shape and there is currently no test suite
 * to catch a page that reads a field we dropped. Narrow it in a follow-up, once
 * every consumer of `useTasks` has been audited.
 */
const TASK_LIST_INCLUDE = {
  assignee: true,
  children: { select: { id: true, title: true, type: true, status: true } },
  parent: { select: { id: true, title: true, type: true } },
  blockingTasks: { include: { blockedTask: true } },
  blockedByTasks: { include: { blockingTask: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.TaskInclude

/** Default page size when a caller opts into pagination without naming one. */
export const TASK_PAGE_DEFAULT_LIMIT = 50
/** Hard ceiling, mirrored by the Zod schema on the route. */
export const TASK_PAGE_MAX_LIMIT = 200

export interface TaskPage<T> {
  items: T[]
  /** Pass back as `?cursor=` to fetch the next page. Null when exhausted. */
  nextCursor: string | null
  hasMore: boolean
}

export const taskService = {
  /**
   * Every task in a project, unbounded.
   *
   * Kept for backwards compatibility: `GET /projects/:projectId/tasks` still
   * routes here when no pagination parameters are supplied, so no existing
   * front-end caller breaks. Prefer `getPage` for anything new, and be aware
   * this is O(project size) on both the query and the JSON payload.
   */
  async getAll(projectId: string) {
    return prisma.task.findMany({
      where: { projectId },
      include: TASK_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  },

  /**
   * One page of a project's tasks, newest first.
   *
   * Uses keyset (cursor) pagination rather than offset pagination. Offset
   * paging makes the database walk and discard every skipped row, so deep pages
   * get progressively slower; keyset paging seeks straight to the cursor and
   * stays flat. It is also stable under concurrent inserts, which matters here
   * because tasks are created while people are scrolling a board.
   *
   * `id` is included as a tiebreaker because `createdAt` is not unique. Without
   * it, tasks created in the same millisecond can be skipped or repeated across
   * page boundaries.
   *
   * Backed by the `(projectId, createdAt)` composite index added in migration
   * 20260915000000_task_perf_indexes. Without that index this degrades to a
   * filesort over the whole project.
   */
  async getPage(
    projectId: string,
    { limit = TASK_PAGE_DEFAULT_LIMIT, cursor }: { limit?: number; cursor?: string } = {},
  ): Promise<TaskPage<Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>>> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || TASK_PAGE_DEFAULT_LIMIT, 1), TASK_PAGE_MAX_LIMIT)

    // Over-fetch by one to learn whether another page exists without a
    // second COUNT query.
    const rows = await prisma.task.findMany({
      where: { projectId },
      include: TASK_LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > safeLimit
    const items = hasMore ? rows.slice(0, safeLimit) : rows

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    }
  },

  async getById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: { 
        assignee: true, 
        project: true,
        parent:   { select: { id: true, title: true, type: true } },
        children: { select: { id: true, title: true, type: true, status: true } },
      },
    })
  },

  async create(data: {
    title: string
    description?: string
    projectId: string
    assigneeId?: string
    priority?: Priority
    status?: string
    sprintId?: string | null
    parentId?: string | null
    type?: TaskType
    hierarchyLevel?: number
    startDate?: Date | null
    deadline?: Date | null
  }) {
    const completedAt = data.status && DONE_STATUSES.includes(data.status) ? new Date() : null
    return prisma.task.create({
      data: { ...data, completedAt },
      include: { assignee: true, children: true, parent: true },
    })
  },

  async update(id: string, data: {
    title?: string
    description?: string
    status?: string
    priority?: Priority
    assigneeId?: string
    sprintId?: string | null
    parentId?: string | null
    type?: TaskType
    hierarchyLevel?: number
    startDate?: Date | null
    deadline?: Date | null
  }) {
    if (data.status !== undefined) {
      const existing = await prisma.task.findUnique({ where: { id }, select: { status: true } })
      if (existing) {
        const wasDone = DONE_STATUSES.includes(existing.status)
        const isDone = DONE_STATUSES.includes(data.status)

        if (isDone && !wasDone) {
          ;(data as any).completedAt = new Date()
        } else if (!isDone && wasDone) {
          ;(data as any).completedAt = null
        }
      }
    }

    return prisma.task.update({
      where: { id },
      data,
      include: { assignee: true },
    })
  },

  async delete(id: string) {
    return prisma.task.delete({ where: { id } })
  },
}
