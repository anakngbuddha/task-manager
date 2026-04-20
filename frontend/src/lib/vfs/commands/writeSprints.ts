/**
 * Write commands for sprints: touch sprint, rm sprint, start sprint, close sprint
 *
 * Backend auth:
 *   POST   /projects/:id/sprints              → MASTER_ADMIN, PROJECT_MANAGER
 *   DELETE /projects/:id/sprints/:id          → MASTER_ADMIN, PROJECT_MANAGER
 *   POST   /projects/:id/sprints/:id/start    → MASTER_ADMIN, PROJECT_MANAGER
 *   POST   /projects/:id/sprints/:id/complete → MASTER_ADMIN, PROJECT_MANAGER
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

/**
 * BUG-07 fix: sprint files now use safeName__id8.json format (ID-stable).
 * Extract the 8-char ID slice from the sprint filename so lookups work
 * regardless of current sprint status.
 */
function extractSprintId(filename: string): string {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]+)$/)
  return match ? match[1] : base
}

/**
 * Fetch the full sprint object by the ID embedded in its filename.
 * Matches against the first N chars of s.id where N == idSlice.length.
 */
async function resolveSprint(projectId: string, filename: string): Promise<any | null> {
  const idSlice = extractSprintId(filename)
  const { data: sprints } = await api.get(`/projects/${projectId}/sprints`)
  return (sprints as any[]).find(
    (s: any) => String(s.id).slice(0, idSlice.length) === idSlice
  ) ?? null
}

export function createSprintWriteHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── touch sprint ─────────────────────────────────────────────────────────
    // Usage: touch sprints/<name>.json [--goal="Sprint goal"] [--start=<ISO>] [--end=<ISO>]
    'touch-sprint': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'touch sprint') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'touch sprint') } }

      const rawArg = parsed.args[0] ?? ''
      const rawName = (parsed.flags['name'] as string)
        || rawArg.replace(/\.json$/, '').replace(/[-_]+/g, ' ')

      if (!rawName.trim()) {
        return { lines: [{ type: 'stderr', content: 'touch sprint: sprint name is required. Use --name="Sprint 1" or pass a filename.' }] }
      }

      const body: Record<string, unknown> = { name: rawName.trim() }
      if (parsed.flags['goal']) body.goal = parsed.flags['goal']
      
      // BUG-20 fix: Validate date strings
      if (parsed.flags['start']) {
        if (Number.isNaN(Date.parse(parsed.flags['start'] as string))) {
          return { lines: [{ type: 'stderr', content: 'touch sprint: invalid start date format. Must be ISO 8601.' }] }
        }
        body.startDate = parsed.flags['start']
      }
      if (parsed.flags['end']) {
        if (Number.isNaN(Date.parse(parsed.flags['end'] as string))) {
          return { lines: [{ type: 'stderr', content: 'touch sprint: invalid end date format. Must be ISO 8601.' }] }
        }
        body.endDate = parsed.flags['end']
      }

      try {
        const { data } = await api.post(`/projects/${vfs.projectId}/sprints`, body)
        return {
          lines: [
            { type: 'success', content: `✓ Sprint created: "${data.name}"` },
            { type: 'json', content: JSON.stringify({ id: data.id, status: data.status }) },
          ],
          invalidations: [['sprints', vfs.projectId], ['tasks', vfs.projectId]]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `touch sprint: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── rm sprint ─────────────────────────────────────────────────────────────
    // Usage: rm sprints/<file>.json
    'rm-sprint': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'rm sprint') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'rm sprint') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'rm: missing operand' }] }

      const filename = vfs.resolve(targetPath).split('/').pop() ?? ''
      const matched = await resolveSprint(vfs.projectId, filename)
      if (!matched) {
        return { lines: [{ type: 'stderr', content: `rm: sprint not found: "${filename}"` }] }
      }

      try {
        await api.delete(`/projects/${vfs.projectId}/sprints/${matched.id}`)
        return {
          lines: [{ type: 'success', content: `✓ Sprint removed: ${filename}` }],
          invalidations: [['sprints', vfs.projectId], ['tasks', vfs.projectId]]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `rm sprint: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── start sprint ──────────────────────────────────────────────────────────
    // Usage: start sprints/<file>.json --start=<ISO> --end=<ISO>
    'start-sprint': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'start sprint') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'start sprint') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'start: usage: start sprints/<file>.json --start=<ISO> --end=<ISO>' }] }

      const startDate = parsed.flags['start'] as string
      const endDate = parsed.flags['end'] as string
      if (!startDate || !endDate) {
        return { lines: [{ type: 'stderr', content: 'start: --start and --end dates are required (ISO 8601).' }] }
      }

      const filename = vfs.resolve(targetPath).split('/').pop() ?? ''
      const matched = await resolveSprint(vfs.projectId, filename)
      if (!matched) return { lines: [{ type: 'stderr', content: `start: sprint not found: "${filename}"` }] }
      if (matched.status !== 'PLANNING') {
        return { lines: [{ type: 'stderr', content: `start: sprint "${matched.name}" is ${matched.status}, not PLANNING.` }] }
      }

      try {
        const { data } = await api.post(`/projects/${vfs.projectId}/sprints/${matched.id}/start`, { startDate, endDate })
        return {
          lines: [{ type: 'success', content: `✓ Sprint "${data.name}" started (${startDate} → ${endDate})` }],
          invalidations: [['sprints', vfs.projectId], ['tasks', vfs.projectId]]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `start sprint: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── close sprint ──────────────────────────────────────────────────────────
    // Usage: close sprints/<file>.json [--move-to=todo]
    'close-sprint': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'close sprint') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'close sprint') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'close: usage: close sprints/<file>.json [--move-to=TODO]' }] }

      const moveTo = (parsed.flags['move-to'] as string)?.toUpperCase() ?? 'TODO'

      const filename = vfs.resolve(targetPath).split('/').pop() ?? ''
      const matched = await resolveSprint(vfs.projectId, filename)
      if (!matched) return { lines: [{ type: 'stderr', content: `close: sprint not found: "${filename}"` }] }
      if (matched.status !== 'ACTIVE') {
        return { lines: [{ type: 'stderr', content: `close: sprint "${matched.name}" is ${matched.status}, not ACTIVE.` }] }
      }

      try {
        await api.post(`/projects/${vfs.projectId}/sprints/${matched.id}/complete`, {
          moveIncompleteTasksTo: moveTo,
        })
        return {
          lines: [
            { type: 'success', content: `✓ Sprint "${matched.name}" completed.` },
            { type: 'system', content: `  Incomplete tasks moved to: ${moveTo}` },
          ],
          invalidations: [['sprints', vfs.projectId], ['tasks', vfs.projectId]]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `close sprint: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
