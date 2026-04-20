/**
 * Write commands for messaging: msg, dm
 *
 * Backend auth:
 *   POST /projects/:id/messages              → ANY project member
 *   POST /projects/:id/direct/:userId        → ANY project member
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const ANY_MEMBER = ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'] as const

export function createMessageWriteHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── msg ───────────────────────────────────────────────────────────────────
    // Usage: msg "Hello everyone!"
    //   or:  msg Hello everyone!    (unquoted — all remaining args joined)
    msg: async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...ANY_MEMBER], 'msg') }
      catch { return { lines: authDeniedLines(context.userRole, [...ANY_MEMBER], 'msg') } }

      // Accept both: msg "Hello world" and msg Hello world
      const content = parsed.args.length > 0
        ? parsed.args.join(' ')
        : (parsed.flags['m'] as string) ?? ''

      if (!content.trim()) {
        return { lines: [{ type: 'stderr', content: 'msg: usage: msg "Your message here"' }] }
      }

      try {
        await api.post(`/projects/${vfs.projectId}/messages`, { content })
        return {
          lines: [
            { type: 'success', content: `✓ Message sent to #project-chat` },
            { type: 'system', content: `  "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `msg: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── dm ────────────────────────────────────────────────────────────────────
    // Usage: dm <email> "Hello!"
    //   or:  dm <email> Hello there
    dm: async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...ANY_MEMBER], 'dm') }
      catch { return { lines: authDeniedLines(context.userRole, [...ANY_MEMBER], 'dm') } }

      const [targetEmail, ...restArgs] = parsed.args
      const content = restArgs.join(' ')

      if (!targetEmail || !targetEmail.includes('@')) {
        return { lines: [{ type: 'stderr', content: 'dm: usage: dm <email> "Your message"' }] }
      }
      if (!content.trim()) {
        return { lines: [{ type: 'stderr', content: 'dm: message cannot be empty.' }] }
      }

      // Resolve email → userId from project members
      const { data: members } = await api.get(`/projects/${vfs.projectId}/members`)
      const matched = (members as any[]).find(
        (m: any) => (m.user?.email ?? '').toLowerCase() === targetEmail.toLowerCase()
      )

      if (!matched) {
        return {
          lines: [
            { type: 'stderr', content: `dm: member not found: "${targetEmail}"` },
            { type: 'system', content: '  Use "ls members/" to see who is in this project.' },
          ],
        }
      }

      if (matched.userId === context.user?.id) {
        return { lines: [{ type: 'stderr', content: 'dm: you cannot send a message to yourself.' }] }
      }

      try {
        await api.post(`/projects/${vfs.projectId}/direct/${matched.userId}`, { content })
        return {
          lines: [
            { type: 'success', content: `✓ DM sent to ${matched.user?.name ?? targetEmail}` },
            { type: 'system', content: `  "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `dm: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
