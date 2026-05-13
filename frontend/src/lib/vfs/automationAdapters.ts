/**
 * Automations data adapter — fetches automation rules and returns VFSFile[].
 * Used by VirtualFileSystem.listDir('/automations').
 */
import { api } from '@/lib/api'
import type { VFSFile } from './types'

export async function fetchAutomationFiles(projectId: string): Promise<VFSFile[]> {
  const { data } = await api.get(`/projects/${projectId}/automations`)
  const rules: any[] = data ?? []

  return rules.map((r): VFSFile => {
    const safeName = (r.name ?? 'automation')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 40)
    const name = `${safeName}__${String(r.id).slice(0, 8)}.json`
    return {
      name,
      path: `/automations/${name}`,
      type: 'file',
      entityType: 'automation',
      entityId: String(r.id),
      data: r,
    }
  })
}

/**
 * Task-comments adapter — fetches comments for a given task.
 * Used in /tasks/<status>/<task>/comments/ pseudo-directory.
 */
export async function fetchTaskCommentFiles(taskId: string, basePath: string): Promise<VFSFile[]> {
  const { data } = await api.get(`/tasks/${taskId}/comments`)
  const comments: any[] = data ?? []

  return comments.map((c): VFSFile => {
    const authorSlug = (c.author?.email ?? c.authorId ?? 'anon')
      .toLowerCase()
      .replace(/[^a-z0-9._@-]/g, '-')
      .slice(0, 24)
    const name = `${authorSlug}__${String(c.id).slice(0, 8)}.json`
    return {
      name,
      path: `${basePath}/${name}`,
      type: 'file',
      entityType: 'task-comment',
      entityId: String(c.id),
      data: c,
    }
  })
}
