/**
 * Mount table — describes the static directory skeleton of the VFS.
 *
 * Each entry maps an absolute virtual path to metadata about
 * what kind of data lives there.  Dynamic children (the actual
 * task files, sprint files, etc.) are generated at runtime by
 * dataAdapters.ts based on live API data.
 */

export interface MountEntry {
  /** The entity type that owns this directory */
  entityType: string
  /** Human-friendly label (used in ls listings) */
  label: string
  /** If this directory is a sub-filter of tasks, this is the status value */
  taskStatus?: string
  /** Whether the directory contains files (leaf) or other dirs (branch) */
  leaf: boolean
}

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

/** Maps virtual status path segment → Prisma status string */
export const STATUS_PATH_MAP: Record<string, TaskStatus> = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_REVIEW',
  done: 'DONE',
  ready: 'READY',
}

/** Maps Prisma status string → virtual path segment */
export const STATUS_SLUG_MAP: Record<TaskStatus, string> = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  READY: 'ready',
}

/**
 * Top-level directories that always exist.
 * Children are populated dynamically from API data.
 */
export const MOUNT_TABLE: Record<string, MountEntry> = {
  '/tasks': {
    entityType: 'tasks',
    label: 'tasks',
    leaf: false,
  },
  '/tasks/todo': {
    entityType: 'tasks-status',
    label: 'todo',
    taskStatus: 'TODO',
    leaf: true,
  },
  '/tasks/in_progress': {
    entityType: 'tasks-status',
    label: 'in_progress',
    taskStatus: 'IN_PROGRESS',
    leaf: true,
  },
  '/tasks/in_review': {
    entityType: 'tasks-status',
    label: 'in_review',
    taskStatus: 'IN_REVIEW',
    leaf: true,
  },
  '/tasks/done': {
    entityType: 'tasks-status',
    label: 'done',
    taskStatus: 'DONE',
    leaf: true,
  },
  '/tasks/ready': {
    entityType: 'tasks-status',
    label: 'ready',
    taskStatus: 'READY',
    leaf: true,
  },
  '/sprints': {
    entityType: 'sprints',
    label: 'sprints',
    leaf: true,
  },
  '/members': {
    entityType: 'members',
    label: 'members',
    leaf: true,
  },
  '/tags': {
    entityType: 'tags',
    label: 'tags',
    leaf: true,
  },
  '/schedules': {
    entityType: 'schedules',
    label: 'schedules',
    leaf: true,
  },
  '/timelogs': {
    entityType: 'timelogs',
    label: 'timelogs',
    leaf: false,
  },
}

/** Return the direct children of a given virtual path from the mount table. */
export function getMountChildren(parentPath: string): string[] {
  const normalised = parentPath === '' ? '/' : parentPath
  return Object.keys(MOUNT_TABLE).filter((p) => {
    if (p === normalised) return false
    const parent = p.substring(0, p.lastIndexOf('/')) || '/'
    return parent === normalised
  })
}
