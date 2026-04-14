/**
 * Write commands for tasks: touch task, rm task, mv task
 *
 * Backend auth:
 *   POST   /tasks              → MASTER_ADMIN, PROJECT_MANAGER
 *   DELETE /tasks/:id          → MASTER_ADMIN, PROJECT_MANAGER
 *   PATCH  /tasks/:id          → MASTER_ADMIN, PROJECT_MANAGER
 *
 * Frontend guard mirrors the above via assertVFSRole.
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult, OutputLineSpec } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'
import { TASK_STATUSES, STATUS_PATH_MAP } from '../mounts'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

function slug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 60)
}

function resolveStatusFromPath(filePath: string): string | null {
  const parts = filePath.split('/').filter(Boolean)
  if (parts[0] === 'tasks' && parts.length >= 2) {
    const statusSlug = parts[1]
    return STATUS_PATH_MAP[statusSlug] ?? null
  }
  return null
}

/**
 * Resolve a filename-encoded entity id from a .json file name.
 * Format: <safe-title>__<8-char-id>.json  OR just  <entity-id>.json
 */
function extractEntityId(filename: string): string {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]{8,})$/)
  return match ? match[1] : base
}

export function createTaskWriteHandlers(
  vfs: VirtualFileSystem,
  projectId: string
): Record<string, CommandHandler> {
  return {
    // ── touch task ────────────────────────────────────────────────────────────
    // Usage: touch tasks/<status>/<title>.json --priority=HIGH [--assignee=<email>]
    //        [--deadline=2025-12-31T00:00:00.000Z] [--sprint=<sprint-name>]
    'touch-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'touch task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'touch task') } }

      const targetPath = parsed.args[0]
      if (!targetPath || !targetPath.startsWith('tasks/')) {
        return { lines: [{ type: 'stderr', content: 'touch: path must be under tasks/<status>/<filename>.json' }] }
      }

      const parts = targetPath.split('/')
      if (parts.length < 3) {
        return { lines: [{ type: 'stderr', content: 'touch: expected tasks/<status>/<title>.json' }] }
      }

      const statusSlug = parts[1]
      const status = STATUS_PATH_MAP[statusSlug]
      if (!status) {
        return {
          lines: [
            { type: 'stderr', content: `touch: unknown status "${statusSlug}".` },
            { type: 'system', content: `Valid statuses: ${Object.keys(STATUS_PATH_MAP).join(', ')}` },
          ],
        }
      }

      const rawTitle = (parsed.flags['title'] as string) || parts[2].replace(/\.json$/, '').replace(/-+/g, ' ')
      const priority = ((parsed.flags['priority'] as string) || 'MEDIUM').toUpperCase()
      if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
        return { lines: [{ type: 'stderr', content: `touch: invalid priority "${priority}". Use LOW, MEDIUM, HIGH, or URGENT.` }] }
      }

      const body: Record<string, unknown> = {
        title: rawTitle,
        projectId,
        status,
        priority,
        assigneeId: (parsed.flags['assignee'] as string) ?? null,
        deadline: (parsed.flags['deadline'] as string) ?? null,
      }

      if (parsed.flags['sprint']) {
        // Resolve sprint name → id via list
        const { data: sprints } = await api.get(`/projects/${projectId}/sprints`)
        const sprint = (sprints as any[]).find(
          (s: any) => s.name?.toLowerCase() === String(parsed.flags['sprint']).toLowerCase()
        )
        if (!sprint) {
          return { lines: [{ type: 'stderr', content: `touch: sprint "${parsed.flags['sprint']}" not found.` }] }
        }
        body.sprintId = sprint.id
      }

      try {
        const { data: created } = await api.post('/tasks', body)
        return {
          lines: [
            { type: 'success', content: `✓ Task created: "${created.title}"` },
            { type: 'json', content: JSON.stringify({ id: created.id, status: created.status, priority: created.priority }) },
          ],
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `touch: ${msg}` }] }
      }
    },

    // ── rm task ───────────────────────────────────────────────────────────────
    // Usage: rm tasks/<status>/<file>.json
    'rm-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'rm task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'rm task') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'rm: missing operand' }] }

      const resolvedPath = vfs.resolve(targetPath)
      const filename = resolvedPath.split('/').pop() ?? ''
      const entityId = extractEntityId(filename)

      if (!entityId) return { lines: [{ type: 'stderr', content: `rm: could not resolve task id from "${targetPath}"` }] }

      try {
        await api.delete(`/tasks/${entityId}`)
        return { lines: [{ type: 'success', content: `✓ Task deleted: ${filename}` }] }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `rm: ${msg}` }] }
      }
    },

    // ── mv task (change status) ────────────────────────────────────────────────
    // Usage: mv tasks/todo/my-task__abc123.json tasks/in_progress/
    'mv-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'mv task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'mv task') } }

      const [srcPath, dstPath] = parsed.args
      if (!srcPath || !dstPath) {
        return { lines: [{ type: 'stderr', content: 'mv: usage: mv <source-file> <target-status-dir>/' }] }
      }

      const resolvedSrc = vfs.resolve(srcPath)
      const filename = resolvedSrc.split('/').pop() ?? ''
      const entityId = extractEntityId(filename)

      // Resolve target status
      const resolvedDst = vfs.resolve(dstPath.replace(/\/$/, ''))
      const newStatusSlug = resolvedDst.split('/').pop() ?? ''
      const newStatus = STATUS_PATH_MAP[newStatusSlug]

      if (!newStatus) {
        return {
          lines: [
            { type: 'stderr', content: `mv: unknown target status "${newStatusSlug}".` },
            { type: 'system', content: `Valid: ${Object.keys(STATUS_PATH_MAP).join(', ')}` },
          ],
        }
      }

      try {
        const { data: updated } = await api.patch(`/tasks/${entityId}`, { status: newStatus })
        return {
          lines: [
            { type: 'success', content: `✓ Task moved to ${newStatus}` },
            { type: 'system', content: `  ${filename} → tasks/${newStatusSlug}/` },
          ],
          newCwd: vfs.resolve(`tasks/${newStatusSlug}`),
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `mv: ${msg}` }] }
      }
    },
  }
}
