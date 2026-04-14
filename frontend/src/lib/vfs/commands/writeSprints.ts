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


export function createSprintWriteHandlers(
  vfs: VirtualFileSystem,
  projectId: string
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
      if (parsed.flags['start']) body.startDate = parsed.flags['start']
      if (parsed.flags['end']) body.endDate = parsed.flags['end']

      try {
        const { data } = await api.post(`/projects/${projectId}/sprints`, body)
        return {
          lines: [
            { type: 'success', content: `✓ Sprint created: "${data.name}"` },
            { type: 'json', content: JSON.stringify({ id: data.id, status: data.status }) },
          ],
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

      // Resolve full path then find sprint by name match
      const resolvedPath = vfs.resolve(targetPath)
      const filename = resolvedPath.split('/').pop() ?? ''

      // Sprint files are named: <safename>_<status>.json
      // Try to locate by listing sprints and matching filename
      const { data: sprints } = await api.get(`/projects/${projectId}/sprints`)
      const safe = (name: string, status: string) =>
        `${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)}_${status.toLowerCase()}.json`

      const matched = (sprints as any[]).find((s: any) => safe(s.name, s.status) === filename)
      if (!matched) {
        return { lines: [{ type: 'stderr', content: `rm: sprint not found: "${filename}"` }] }
      }

      try {
        await api.delete(`/projects/${projectId}/sprints/${matched.id}`)
        return { lines: [{ type: 'success', content: `✓ Sprint deleted: "${matched.name}"` }] }
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
      const { data: sprints } = await api.get(`/projects/${projectId}/sprints`)
      const safe = (name: string, status: string) =>
        `${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)}_${status.toLowerCase()}.json`
      const matched = (sprints as any[]).find((s: any) => safe(s.name, s.status) === filename)
      if (!matched) return { lines: [{ type: 'stderr', content: `start: sprint not found: "${filename}"` }] }
      if (matched.status !== 'PLANNING') {
        return { lines: [{ type: 'stderr', content: `start: sprint "${matched.name}" is ${matched.status}, not PLANNING.` }] }
      }

      try {
        const { data } = await api.post(`/projects/${projectId}/sprints/${matched.id}/start`, { startDate, endDate })
        return { lines: [{ type: 'success', content: `✓ Sprint "${data.name}" started (${startDate} → ${endDate})` }] }
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
      const { data: sprints } = await api.get(`/projects/${projectId}/sprints`)
      const safe = (name: string, status: string) =>
        `${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)}_${status.toLowerCase()}.json`
      const matched = (sprints as any[]).find((s: any) => safe(s.name, s.status) === filename)
      if (!matched) return { lines: [{ type: 'stderr', content: `close: sprint not found: "${filename}"` }] }
      if (matched.status !== 'ACTIVE') {
        return { lines: [{ type: 'stderr', content: `close: sprint "${matched.name}" is ${matched.status}, not ACTIVE.` }] }
      }

      try {
        await api.post(`/projects/${projectId}/sprints/${matched.id}/complete`, {
          moveIncompleteTasksTo: moveTo,
        })
        return {
          lines: [
            { type: 'success', content: `✓ Sprint "${matched.name}" completed.` },
            { type: 'system', content: `  Incomplete tasks moved to: ${moveTo}` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `close sprint: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
