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
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'
import { STATUS_PATH_MAP } from '../mounts'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

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
    // Usage: touch tasks/<status>/<title>.json --priority=HIGH [--project=<id>]
    //        [--assignee=<email>] [--deadline=2025-12-31T00:00:00.000Z] [--sprint=<sprint-name>]
    'touch-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'touch task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'touch task') } }

      // Automatically uplift any `key=value` args to flags in case they forgot `--`
      for (const arg of parsed.args.slice(1)) {
        if (arg.includes('=') && !arg.startsWith('--')) {
          const [k, ...v] = arg.split('=')
          parsed.flags[k] = v.join('=')
        }
      }

      // Allow overriding the project via --project=<id or name>
      let targetProjectId = (parsed.flags['project'] as string) || projectId
      
      // If the user provided a plain name for --project (not a UUID), resolve it.
      if (targetProjectId && targetProjectId !== '__workspace__' && !targetProjectId.includes('-')) {
        try {
          const { data: apiProjects } = await api.get('/projects')
          const matchedProject = (apiProjects as any[]).find((p) => 
            p.name.toLowerCase().includes(targetProjectId.toLowerCase())
          )
          if (matchedProject) {
            targetProjectId = matchedProject.id
          }
        } catch {
          // ignore, fall back to literal value
        }
      }

      if (!targetProjectId || targetProjectId === '__workspace__') {
        return {
          lines: [
            { type: 'stderr', content: 'touch: no project context. Use --project=<project-name> or navigate to a project first.' },
          ],
        }
      }

      const inputPath = parsed.args[0]
      if (!inputPath) {
        return { lines: [{ type: 'stderr', content: 'touch: missing file operand' }] }
      }

      // Resolve the relative input path against VFS cwd
      const resolvedPath = vfs.resolve(inputPath)
      const parts = resolvedPath.split('/').filter(Boolean) // e.g. ['tasks', 'todo', 'my-task']

      if (parts.length < 3 || parts[0] !== 'tasks') {
        return { lines: [{ type: 'stderr', content: 'touch: path must resolve to tasks/<status>/<title>.json' }] }
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

      let assigneeId: string | null = null
      const rawAssignee = parsed.flags['assignee'] as string
      if (rawAssignee) {
        if (rawAssignee.toUpperCase() === 'EVERYONE' || rawAssignee === '@everyone') {
          assigneeId = 'EVERYONE'
        } else {
          try {
            const { data: members } = await api.get(`/projects/${targetProjectId}/members`)
            const matched = (members as any[]).find(
              (m: any) => (m.user?.email ?? m.email ?? '').toLowerCase() === rawAssignee.toLowerCase()
            )
            if (!matched) {
              return { lines: [{ type: 'stderr', content: `touch: assignee not found in project: "${rawAssignee}"` }] }
            }
            assigneeId = matched.userId
          } catch {
            return { lines: [{ type: 'stderr', content: 'touch: failed to resolve assignee email.' }] }
          }
        }
      }

      let deadlineIso: string | null = null
      const rawDeadline = parsed.flags['deadline'] as string
      if (rawDeadline) {
        const d = new Date(rawDeadline)
        if (isNaN(d.getTime())) {
          return { lines: [{ type: 'stderr', content: `touch: invalid deadline date format "${rawDeadline}"` }] }
        }
        deadlineIso = d.toISOString()
      }

      const body: Record<string, unknown> = {
        title: rawTitle,
        projectId: targetProjectId,
        status,
        priority,
        assigneeId,
        deadline: deadlineIso,
      }

      if (parsed.flags['sprint']) {
        // Resolve sprint name → id via list
        const { data: sprints } = await api.get(`/projects/${targetProjectId}/sprints`)
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
            { type: 'json', content: JSON.stringify({ id: created.id, status: created.status, priority: created.priority, projectId: targetProjectId }) },
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
        await api.patch(`/tasks/${entityId}`, { status: newStatus })
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
