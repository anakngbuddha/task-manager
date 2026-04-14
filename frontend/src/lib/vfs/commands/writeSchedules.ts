/**
 * Write commands for schedules: touch schedule
 *
 * Backend auth:
 *   POST /schedules → Any authenticated user (projectId optional)
 *   If projectId is provided, user must be a member.
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'

const ANY_MEMBER = ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'] as const

const SCHEDULE_TYPES = ['MEETING', 'REVIEW', 'STANDUP', 'OTHER', 'DEADLINE', 'RETROSPECTIVE'] as const

export function createScheduleWriteHandlers(
  projectId: string
): Record<string, CommandHandler> {
  return {
    // ── touch schedule ────────────────────────────────────────────────────────
    // Usage: touch schedules/<title>.json
    //          --at=2025-12-31T10:00:00.000Z
    //         [--end=2025-12-31T11:00:00.000Z]
    //         [--type=MEETING|REVIEW|STANDUP|OTHER]
    //         [--attendees=alice@co.com,bob@co.com]
    //         [--location="Room 4"]
    //         [--details="Agenda: ..."]
    'touch-schedule': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...ANY_MEMBER], 'touch schedule') }
      catch { return { lines: authDeniedLines(context.userRole, [...ANY_MEMBER], 'touch schedule') } }

      const rawArg = parsed.args[0] ?? ''
      const title = (parsed.flags['title'] as string)
        || rawArg.replace(/\.json$/, '').replace(/[-_]+/g, ' ').trim()

      if (!title) {
        return { lines: [{ type: 'stderr', content: 'touch schedule: title is required (pass as filename or --title="...")' }] }
      }

      const at = parsed.flags['at'] as string
      if (!at) {
        return { lines: [{ type: 'stderr', content: 'touch schedule: --at=<ISO datetime> is required.' }] }
      }

      const rawType = ((parsed.flags['type'] as string) ?? 'MEETING').toUpperCase()
      if (!SCHEDULE_TYPES.includes(rawType as any)) {
        return {
          lines: [
            { type: 'stderr', content: `touch schedule: invalid type "${rawType}".` },
            { type: 'system', content: `  Valid: ${SCHEDULE_TYPES.join(', ')}` },
          ],
        }
      }

      const body: Record<string, unknown> = {
        title,
        type: rawType,
        scheduledAt: at,
        projectId,
      }

      if (parsed.flags['end']) body.endAt = parsed.flags['end']
      if (parsed.flags['location']) body.location = parsed.flags['location']
      if (parsed.flags['details']) body.details = parsed.flags['details']

      if (parsed.flags['attendees']) {
        const emails = String(parsed.flags['attendees']).split(',').map(e => e.trim()).filter(Boolean)
        body.attendees = emails.map(email => ({ email }))
      }

      try {
        const { data } = await api.post('/schedules', body)
        const dateStr = new Date(data.scheduledAt).toLocaleString()
        return {
          lines: [
            { type: 'success', content: `✓ Schedule created: "${data.title}"` },
            { type: 'system', content: `  Type: ${data.type} | When: ${dateStr}` },
            { type: 'system', content: `  Invites sent to ${data.attendees?.length ?? 0} attendees.` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `touch schedule: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
