/**
 * Data Adapters — fetch live API data and transform it into VFSFile arrays.
 *
 * Each adapter queries the backend via the existing `api` axios instance
 * (same pattern used by all existing hooks) and returns a list of VFSFile
 * objects that the VirtualFileSystem can surface as "files".
 */
import { api } from '@/lib/api'
import type { VFSFile } from './types'
import { STATUS_SLUG_MAP, type TaskStatus } from './mounts'

// ── Tasks ──────────────────────────────────────────────────────────

export async function fetchTaskFiles(
  projectId: string,
  statusFilter?: TaskStatus
): Promise<VFSFile[]> {
  const { data } = await api.get(`/projects/${projectId}/tasks`)
  const tasks: any[] = data ?? []

  return tasks
    .filter((t) => (statusFilter ? t.status === statusFilter : true))
    .map((t): VFSFile => {
      const statusSlug = STATUS_SLUG_MAP[t.status as TaskStatus] ?? t.status?.toLowerCase() ?? 'unknown'
      const safeName = (t.title ?? 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 40)
      const name = `${safeName}__${String(t.id).slice(0, 8)}.json`
      return {
        name,
        path: `/tasks/${statusSlug}/${name}`,
        type: 'file',
        entityType: 'task',
        entityId: String(t.id),
        data: t,
      }
    })
}

// ── Sprints ─────────────────────────────────────────────────────────

export async function fetchSprintFiles(projectId: string): Promise<VFSFile[]> {
  const { data } = await api.get(`/projects/${projectId}/sprints`)
  const sprints: any[] = data ?? []

  return sprints.map((s): VFSFile => {
    const statusSlug = (s.status ?? 'unknown').toLowerCase()
    const safeName = (s.name ?? 'sprint')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 40)
    const name = `${safeName}_${statusSlug}.json`
    return {
      name,
      path: `/sprints/${name}`,
      type: 'file',
      entityType: 'sprint',
      entityId: String(s.id),
      data: s,
    }
  })
}

// ── Members ──────────────────────────────────────────────────────────

export async function fetchMemberFiles(projectId: string): Promise<VFSFile[]> {
  const { data } = await api.get(`/projects/${projectId}/members`)
  const members: any[] = data ?? []

  return members.map((m): VFSFile => {
    const email = (m.user?.email ?? m.email ?? 'unknown').replace(/[^a-z0-9._@-]/gi, '-')
    const name = `${email}.json`
    return {
      name,
      path: `/members/${name}`,
      type: 'file',
      entityType: 'member',
      entityId: String(m.userId ?? m.id),
      data: m,
    }
  })
}

// ── Tags ─────────────────────────────────────────────────────────────

export async function fetchTagFiles(projectId: string): Promise<VFSFile[]> {
  // The tags endpoint lives at /tags?projectId=... or all global tags
  const { data } = await api.get(`/tags?projectId=${projectId}`)
  const tags: any[] = data ?? []

  return tags.map((tag): VFSFile => {
    const safeName = (tag.name ?? 'tag')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 40)
    const name = `${safeName}.json`
    return {
      name,
      path: `/tags/${name}`,
      type: 'file',
      entityType: 'tag',
      entityId: String(tag.id),
      data: tag,
    }
  })
}

// ── Schedules ─────────────────────────────────────────────────────────

export async function fetchScheduleFiles(projectId: string): Promise<VFSFile[]> {
  // If no real project, fetch all schedules for the current user (cross-project)
  const isWorkspace = !projectId || projectId === '__workspace__'
  const params = isWorkspace ? {} : { projectId }
  const { data } = await api.get('/schedules', { params })
  const schedules: any[] = data ?? []

  return schedules.map((s): VFSFile => {
    const safeName = (s.title ?? 'schedule')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 40)
    const name = `${safeName}__${String(s.id).slice(0, 8)}.json`
    return {
      name,
      path: `/schedules/${name}`,
      type: 'file',
      entityType: 'schedule',
      entityId: String(s.id),
      data: s,
    }
  })
}

// ── Time Logs ──────────────────────────────────────────────────────────

/**
 * Time logs are nested: /timelogs/<taskId-slug>/<log-id>.json
 * We first get the tasks, then for each task fetch the logs.
 * To avoid N+1 on every `ls`, we fetch all tasks and return
 * virtual subdirectory nodes (VFSDirectory logic is handled in VirtualFileSystem).
 */
export async function fetchTimelogTaskDirs(projectId: string): Promise<VFSFile[]> {
  // Return the task list so timelog dirs can be computed
  const { data } = await api.get(`/projects/${projectId}/tasks`)
  const tasks: any[] = data ?? []

  // Filter only tasks that may have time logs (all tasks qualify)
  return tasks.map((t): VFSFile => {
    const safeName = (t.title ?? 'task')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 30)
    const dirName = `${safeName}__${String(t.id).slice(0, 8)}`
    return {
      // Return a "file" record used as a proxy for generating subdirs
      name: dirName,
      path: `/timelogs/${dirName}`,
      type: 'file', // will be overridden to 'dir' in VFS
      entityType: 'timelogs-task',
      entityId: String(t.id),
      parentTaskId: String(t.id),
      data: { taskId: t.id, taskTitle: t.title },
    }
  })
}

export async function fetchTimelogFiles(taskId: string, basePath: string): Promise<VFSFile[]> {
  const { data } = await api.get(`/tasks/${taskId}/time-logs`)
  const logs: any[] = data ?? []

  return logs.map((log): VFSFile => {
    const name = `log-${String(log.id).slice(0, 8)}.json`
    return {
      name,
      path: `${basePath}/${name}`,
      type: 'file',
      entityType: 'timelog',
      entityId: String(log.id),
      data: log,
    }
  })
}

// ── Projects ─────────────────────────────────────────────────────────

export async function fetchProjectFiles(): Promise<VFSFile[]> {
  const { data } = await api.get('/projects')
  const projects: any[] = data ?? []

  return projects.map((p): VFSFile => {
    const safeName = (p.name ?? 'project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 40)
    const statusSlug = (p.status ?? 'active').toLowerCase()
    const name = `${safeName}__${String(p.id).slice(0, 8)}_${statusSlug}.json`
    return {
      name,
      path: `/projects/${name}`,
      type: 'file',
      entityType: 'project',
      entityId: String(p.id),
      data: p,
    }
  })
}
