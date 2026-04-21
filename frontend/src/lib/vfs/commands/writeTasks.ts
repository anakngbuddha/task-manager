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
import { TASK_TYPE_CONFIG, VALID_PARENT_TYPES } from '@/lib/taskTypes'
import type { TaskType } from '@/lib/taskTypes'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const
const VALID_TASK_TYPES: TaskType[] = ['EPIC', 'STORY', 'TASK']

/**
 * Resolve a filename-encoded entity id from a .json file name.
 * Format: <safe-title>__<8-char-id>.json  OR just  <entity-id>.json
 */
function extractEntityId(filename: string): string {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]+)$/)
  return match ? match[1] : base
}

export function createTaskWriteHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── touch task ────────────────────────────────────────────────────────────
    // Usage: touch tasks/<status>/<title>.json --priority=HIGH [--project=<id>]
    //        --type=epic|story|task --sprint=<sprint-name|none>
    //        --assignee=<email> --deadline=2025-12-31T00:00:00.000Z [--description=<text>] [--parent=<task-id>]
    'touch-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'touch task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'touch task') } }

      const flags = { ...parsed.flags }
      // Automatically uplift any `key=value` args to flags in case they forgot `--`
      for (const arg of parsed.args.slice(1)) {
        if (arg.includes('=') && !arg.startsWith('--')) {
          const [k, ...v] = arg.split('=')
          flags[k] = v.join('=')
        }
      }

      // Allow overriding the project via --project=<id or name>
      let targetProjectId = (flags['project'] as string) || vfs.projectId
      
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

      // ── REQUIRED: --type (epic|story|task|normal-task) ─────────────────────
      const rawTypeInput = flags['type'] as string | undefined
      if (!rawTypeInput) {
        return {
          lines: [
            { type: 'stderr', content: 'Error: --type must be one of: epic, story, task' },
          ],
        }
      }
      const normalizedTypeInput = rawTypeInput.toLowerCase().replace(/[\s_-]+/g, '')
      const mappedType: TaskType | null =
        normalizedTypeInput === 'epic' ? 'EPIC' :
        normalizedTypeInput === 'story' ? 'STORY' :
        (normalizedTypeInput === 'task' || normalizedTypeInput === 'normaltask' || normalizedTypeInput === 'normal')
          ? 'TASK'
          : null
      if (!mappedType || !VALID_TASK_TYPES.includes(mappedType)) {
        return {
          lines: [
            { type: 'stderr', content: 'Error: --type must be one of: epic, story, task' },
          ],
        }
      }
      const rawType = mappedType

      // ── OPTIONAL: --parent ──────────────────────────────────────────────────
      let parentId: string | undefined
      const rawParent = flags['parent'] as string | undefined
      if (rawParent) {
        const allowedParentTypes = VALID_PARENT_TYPES[rawType]
        if (allowedParentTypes.length === 0) {
          return {
            lines: [
              { type: 'stderr', content: `Error: A ${rawType} cannot be a child of a none.` },
              { type: 'stderr', content: `Valid parents for ${rawType}: none` },
            ],
          }
        }
        try {
          const { data: parentTask } = await api.get(`/tasks/${rawParent}`)
          if (!allowedParentTypes.includes(parentTask.type as TaskType)) {
            return {
              lines: [
                { type: 'stderr', content: `Error: A ${rawType} cannot be a child of a ${parentTask.type}.` },
                { type: 'stderr', content: `Valid parents for ${rawType}: ${allowedParentTypes.join(', ') || 'none'}` },
              ],
            }
          }
          parentId = String(parentTask.id)
        } catch {
          return { lines: [{ type: 'stderr', content: `touch: parent task not found: "${rawParent}"` }] }
        }
      }

      // ── REQUIRED (non-Epic): --assignee ─────────────────────────────────────
      const rawAssignee = flags['assignee'] as string | undefined
      // Epics are not strictly assigned to an individual — treat as optional
      const isEpic = rawType === 'EPIC'
      if (!rawAssignee && !isEpic) {
        return {
          lines: [
            { type: 'stderr', content: 'touch: --assignee=<email|everyone> is required.' },
            { type: 'system', content: '  Assign to a specific member: --assignee=user@email.com' },
            { type: 'system', content: '  Assign to everyone:          --assignee=everyone' },
          ],
        }
      }

      let assigneeId: string | null = null
      if (rawAssignee.toUpperCase() === 'EVERYONE' || rawAssignee === '@everyone') {
        assigneeId = 'EVERYONE'
      } else {
        try {
          const { data: members } = await api.get(`/projects/${targetProjectId}/members`)
          const matched = (members as any[]).find(
            (m: any) => (m.user?.email ?? m.email ?? '').toLowerCase() === rawAssignee.toLowerCase()
          )
          if (!matched) {
            const validEmails = (members as any[]).map((m: any) => m.user?.email ?? m.email ?? '').filter(Boolean)
            return {
              lines: [
                { type: 'stderr', content: `touch: assignee not found in project: "${rawAssignee}"` },
                { type: 'system', content: `Valid members: ${validEmails.join(', ')}` },
                { type: 'system', content: 'Or use --assignee=everyone to assign to all members.' },
              ],
            }
          }
          assigneeId = matched.userId
        } catch {
          return { lines: [{ type: 'stderr', content: 'touch: failed to resolve assignee email.' }] }
        }
      }

      // ── REQUIRED (non-Epic): --deadline ─────────────────────────────────────
      const rawDeadline = flags['deadline'] as string | undefined
      if (!rawDeadline && !isEpic) {
        return {
          lines: [
            { type: 'stderr', content: 'touch: --deadline=<datetime> is required.' },
            { type: 'system', content: '  Example: --deadline="2026-12-31T23:59"' },
            { type: 'system', content: '  Format:  YYYY-MM-DDTHH:MM  (interpreted as your local time)' },
          ],
        }
      }
      let deadlineIso: string | null = null
      if (rawDeadline) {
        const d = new Date(rawDeadline)
        if (isNaN(d.getTime())) {
          return {
            lines: [
              { type: 'stderr', content: `touch: invalid deadline format: "${rawDeadline}"` },
              { type: 'system', content: '  Example: --deadline="2026-12-31T23:59"' },
            ],
          }
        }
        if (d.getTime() <= Date.now()) {
          return {
            lines: [
              { type: 'stderr', content: 'touch: deadline cannot be in the past.' },
              { type: 'system', content: `  You provided: ${d.toLocaleString()}` },
            ],
          }
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
        description: (flags['description'] as string) || '',
        type: rawType,
        ...(parentId ? { parentId } : {}),
      }

      // ── REQUIRED: --sprint=<name|none> ──────────────────────────────────────
      const rawSprintInput = flags['sprint'] as string | undefined
      if (rawSprintInput === undefined) {
        return {
          lines: [
            { type: 'stderr', content: 'touch: --sprint is required. Use --sprint=<name> or --sprint=none' },
          ],
        }
      }

      const normalizedSprintInput = String(rawSprintInput).trim().toLowerCase()
      if (normalizedSprintInput === 'none' || normalizedSprintInput === 'nosprint' || normalizedSprintInput === 'no-sprint') {
        body.sprintId = null
      } else {
        // Resolve sprint name → id via list
        const { data: sprints } = await api.get(`/projects/${targetProjectId}/sprints`)
        const sprint = (sprints as any[]).find(
          (s: any) => s.name?.toLowerCase() === String(rawSprintInput).toLowerCase()
        )
        if (!sprint) {
          return { lines: [{ type: 'stderr', content: `touch: sprint "${rawSprintInput}" not found.` }] }
        }
        body.sprintId = sprint.id
      }

      try {
        const { data: created } = await api.post('/tasks', body)
        const bulkCount: number | undefined = (created as any).bulkCount

        if (bulkCount && bulkCount > 1) {
          return {
            lines: [
              { type: 'success', content: `✓ Task "${created.title}" created for ${bulkCount} members (one task each).` },
              { type: 'system',  content: `  All ${bulkCount} project members have been assigned their own task copy.` },
              { type: 'json',    content: JSON.stringify({ id: created.id, status: created.status, priority: created.priority, assignedTo: `${bulkCount} members`, deadline: deadlineIso }) },
            ],
            invalidations: [['tasks', targetProjectId], ['sprints', targetProjectId]]
          }
        }

        return {
          lines: [
            { type: 'success', content: `✓ Created [${TASK_TYPE_CONFIG[created.type as TaskType].icon} ${TASK_TYPE_CONFIG[created.type as TaskType].label}] "${created.title}" (id: ${created.id})` },
            { type: 'system',  content: `  Scope: ${created.sprintId ? 'Sprint' : 'No sprint'}` },
            { type: 'json',    content: JSON.stringify({ id: created.id, status: created.status, priority: created.priority, projectId: targetProjectId, deadline: deadlineIso }) },
          ],
          invalidations: [['tasks', targetProjectId], ['sprints', targetProjectId]]
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
        return {
          lines: [{ type: 'success', content: `✓ Removed task: ${filename}` }],
          invalidations: [['tasks', vfs.projectId], ['sprints', vfs.projectId]]
        }
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
      const targetSlug = resolvedDst.split('/').pop() ?? ''
      const newStatus = STATUS_PATH_MAP[targetSlug]

      if (!newStatus) {
        return {
          lines: [
            { type: 'stderr', content: `mv: unknown target status "${targetSlug}".` },
            { type: 'system', content: `Valid: ${Object.keys(STATUS_PATH_MAP).join(', ')}` },
          ],
        }
      }

      try {
        await api.patch(`/tasks/${entityId}`, { status: newStatus })
        return {
          lines: [{ type: 'success', content: `✓ Task moved: ${filename} → /tasks/${targetSlug}` }],
          newCwd: `/tasks/${targetSlug}`, // Switch PWD natively to show where it arrived
          invalidations: [['tasks', vfs.projectId], ['sprints', vfs.projectId]]
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `mv: ${msg}` }] }
      }
    },
  }
}
