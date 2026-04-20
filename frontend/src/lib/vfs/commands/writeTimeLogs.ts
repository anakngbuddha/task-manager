/**
 * Write commands for time logs: log
 *
 * Backend auth:
 *   POST /tasks/:taskId/time-logs → ANY project member
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const ANY_MEMBER = ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'] as const

/**
 * Extracts the task entity id from a VFS file path.
 * Supports: tasks/<status>/<safetitle>__<id>.json
 */
function extractTaskId(filename: string): string {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]+)$/)
  return match ? match[1] : base
}

export function createTimeLogWriteHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── log ───────────────────────────────────────────────────────────────────
    // Usage: log <task-file-path> --minutes=60 --title="Fixed bug" --desc="Details here"
    //  Alt:  log <task-file-path> --hours=1.5 --title="..."
    log: async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...ANY_MEMBER], 'log') }
      catch { return { lines: authDeniedLines(context.userRole, [...ANY_MEMBER], 'log') } }

      const targetPath = parsed.args[0]
      if (!targetPath) {
        return {
          lines: [
            { type: 'stderr', content: 'log: missing task file path.' },
            { type: 'system', content: '  Usage: log tasks/todo/my-task__abc12345.json --minutes=60 --title="..." --desc="..."' },
          ],
        }
      }

      const logTitle = parsed.flags['title'] as string
      const logDesc = (parsed.flags['desc'] as string) || (parsed.flags['description'] as string) || (parsed.flags['d'] as string)

      if (!logTitle) return { lines: [{ type: 'stderr', content: 'log: --title is required.' }] }
      if (!logDesc) return { lines: [{ type: 'stderr', content: 'log: --desc is required.' }] }

      // Calculate minutes
      let durationMinutes: number
      if (parsed.flags['minutes']) {
        durationMinutes = parseInt(String(parsed.flags['minutes']), 10)
      } else if (parsed.flags['hours']) {
        durationMinutes = Math.round(parseFloat(String(parsed.flags['hours'])) * 60)
      } else {
        return { lines: [{ type: 'stderr', content: 'log: --minutes=<n> or --hours=<n> is required.' }] }
      }

      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return { lines: [{ type: 'stderr', content: 'log: duration must be a positive number.' }] }
      }
      if (durationMinutes > 14400) {
        return { lines: [{ type: 'stderr', content: 'log: max duration is 14400 minutes (10 days).' }] }
      }

      // Resolve task file → task id
      const resolvedPath = vfs.resolve(targetPath)
      const filename = resolvedPath.split('/').pop() ?? ''
      const taskId = extractTaskId(filename)

      if (!taskId) {
        return { lines: [{ type: 'stderr', content: `log: could not resolve task id from "${targetPath}"` }] }
      }

      const body = {
        durationMinutes,
        title: logTitle,
        description: logDesc,
      }

      try {
        await api.post(`/tasks/${taskId}/time-logs`, body)
        const hrs = (durationMinutes / 60).toFixed(2)
        return {
          lines: [
            { type: 'success', content: `✓ Time logged: ${durationMinutes}min (${hrs}h)` },
            { type: 'system', content: `  Task: ${filename}` },
            { type: 'system', content: `  Note: ${logTitle}` },
          ],
          invalidations: [['timeLogs', taskId], ['tasks', vfs.projectId]]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `log: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
