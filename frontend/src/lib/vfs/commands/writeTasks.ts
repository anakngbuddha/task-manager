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
import { fetchTaskFiles } from '../dataAdapters'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const
const VALID_TASK_TYPES: TaskType[] = ['EPIC', 'STORY', 'TASK']

/**
 * Resolve a filename-encoded entity id from a .json file name.
 * Format: <safe-title>__<8-char-id>.json  OR just  <entity-id>.json
 * Returns the id portion, or null if no __id suffix was found (bare title).
 */
function extractEntityId(filename: string): string | null {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]+)$/)
  return match ? match[1] : null
}

/**
 * Normalise a string to alphanumeric for fuzzy comparison.
 */
function norm(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Resolve entity id from path, with fuzzy title fallback.
 * - If the filename has the expected __id suffix, return that id.
 * - Otherwise, query fetchTaskFiles for the given status and match
 *   by sanitised title prefix against the filename.
 */
async function resolveTaskEntityId(
  projectId: string,
  resolvedPath: string,
): Promise<{ entityId: string; filename: string } | null> {
  const filename = resolvedPath.split('/').pop() ?? ''
  const statusSlug = resolvedPath.split('/')[2] // e.g. 'todo'

  // Fast path: has __id suffix
  const directId = extractEntityId(filename)
  if (directId) return { entityId: directId, filename }

  // Fuzzy fallback: search the task list for matching title
  const statusMap: Record<string, string> = {
    todo: 'TODO', in_progress: 'IN_PROGRESS',
    in_review: 'IN_REVIEW', done: 'DONE', ready: 'READY',
  }
  const statusFilter = (statusMap[statusSlug] ?? null) as any
  const taskFiles = await fetchTaskFiles(projectId, statusFilter)
  const normalizedQuery = norm(filename.replace(/\.json$/, ''))
  const match = taskFiles.find(f => norm(f.name.replace(/\.json$/, '')).includes(normalizedQuery)
    || normalizedQuery.includes(norm(f.name.replace(/\.json$/, '').split('__')[0]))
    || norm(f.name.replace(/\.json$/, '').split('__')[0]) === normalizedQuery
  )
  if (!match) return null
  return { entityId: match.entityId, filename: match.name }
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

        const assignedText = created.assigneeId ? created.assigneeId : 'Everyone (Shared)'

        return {
          lines: [
            { type: 'success', content: `✓ Created [${TASK_TYPE_CONFIG[created.type as TaskType].icon} ${TASK_TYPE_CONFIG[created.type as TaskType].label}] "${created.title}" (id: ${created.id})` },
            { type: 'system',  content: `  Scope: ${created.sprintId ? 'Sprint' : 'No sprint'} | Assigned: ${assignedText}` },
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
      const resolved = await resolveTaskEntityId(vfs.projectId, resolvedPath)

      if (!resolved) {
        return { lines: [{ type: 'stderr', content: `rm: Task not found: "${targetPath}"` }] }
      }

      try {
        await api.delete(`/tasks/${resolved.entityId}`)
        return {
          lines: [{ type: 'success', content: `✓ Removed task: ${resolved.filename}` }],
          invalidations: [['tasks', vfs.projectId], ['sprints', vfs.projectId]]
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `rm: ${msg}` }] }
      }
    },

    // ── mv task (change status) ────────────────────────────────────────────────
    // Usage: mv tasks/todo/my-task__abc123.json tasks/in_progress/
    //    or: mv tasks/todo/My_Task_Title tasks/in_progress   (fuzzy match)
    'mv-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'mv task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'mv task') } }

      const [srcPath, dstPath] = parsed.args
      if (!srcPath || !dstPath) {
        return { lines: [{ type: 'stderr', content: 'mv: usage: mv <source-file> <target-status-dir>/' }] }
      }

      const resolvedSrc = vfs.resolve(srcPath)
      const resolved = await resolveTaskEntityId(vfs.projectId, resolvedSrc)

      if (!resolved) {
        return { lines: [{ type: 'stderr', content: `mv: Task not found: "${srcPath}". Use ls tasks/<status> to see exact filenames.` }] }
      }

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
        await api.patch(`/tasks/${resolved.entityId}`, { status: newStatus })
        return {
          lines: [{ type: 'success', content: `✓ Task moved: ${resolved.filename} → /tasks/${targetSlug}` }],
          newCwd: `/tasks/${targetSlug}`, // Switch PWD natively to show where it arrived
          invalidations: [['tasks', vfs.projectId], ['sprints', vfs.projectId]]
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `mv: ${msg}` }] }
      }
    },

    // ── edit task (patch fields) ───────────────────────────────────────────────
    // Usage: edit tasks/<status>/<file> [--title="..."] [--priority=HIGH] [--deadline="..."] [--description="..."]
    'edit-task': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'edit task') }
      catch (e: any) { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'edit task') } }

      const srcPath = parsed.args[0]
      if (!srcPath) {
        return {
          lines: [
            { type: 'stderr', content: 'edit: missing task path.' },
            { type: 'system', content: '  Usage: edit tasks/<status>/<file> [--title="..."] [--priority=HIGH] [--deadline="..."] [--description="..."]' },
          ],
        }
      }

      const resolvedSrc = vfs.resolve(srcPath)
      const resolved = await resolveTaskEntityId(vfs.projectId, resolvedSrc)

      if (!resolved) {
        return { lines: [{ type: 'stderr', content: `edit: Task not found: "${srcPath}"` }] }
      }

      const body: Record<string, unknown> = {}
      if (parsed.flags['title'])       body.title       = parsed.flags['title']
      if (parsed.flags['description']) body.description = parsed.flags['description']
      if (parsed.flags['priority']) {
        const p = String(parsed.flags['priority']).toUpperCase()
        if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(p)) {
          return { lines: [{ type: 'stderr', content: `edit: invalid priority "${p}". Use LOW, MEDIUM, HIGH, or URGENT.` }] }
        }
        body.priority = p
      }
      if (parsed.flags['deadline']) {
        const d = new Date(String(parsed.flags['deadline']))
        if (isNaN(d.getTime())) {
          return { lines: [{ type: 'stderr', content: `edit: invalid deadline format. Use YYYY-MM-DDTHH:MM` }] }
        }
        body.deadline = d.toISOString()
      }
      if (parsed.flags['status']) {
        const s = String(parsed.flags['status']).toLowerCase()
        const mapped = STATUS_PATH_MAP[s]
        if (!mapped) {
          return { lines: [{ type: 'stderr', content: `edit: unknown status "${s}". Valid: ${Object.keys(STATUS_PATH_MAP).join(', ')}` }] }
        }
        body.status = mapped
      }

      if (Object.keys(body).length === 0) {
        return {
          lines: [
            { type: 'stderr', content: 'edit: no fields specified.' },
            { type: 'system', content: '  Flags: --title="..." --priority=HIGH --deadline="YYYY-MM-DDTHH:MM" --description="..." --status=in_progress' },
          ],
        }
      }

      try {
        const { data: updated } = await api.patch(`/tasks/${resolved.entityId}`, body)
        const changed = Object.keys(body).map(k => `${k}=${JSON.stringify(body[k])}`).join(', ')
        return {
          lines: [
            { type: 'success', content: `✓ Task updated: ${resolved.filename}` },
            { type: 'system',  content: `  Changed: ${changed}` },
            { type: 'json',    content: JSON.stringify({ id: updated.id, status: updated.status, priority: updated.priority }) },
          ],
          invalidations: [['tasks', vfs.projectId], ['sprints', vfs.projectId]]
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err.message
        return { lines: [{ type: 'stderr', content: `edit: ${msg}` }] }
      }
    },
  }
}
