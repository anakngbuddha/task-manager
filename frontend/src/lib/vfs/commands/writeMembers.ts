/**
 * Write commands for members: rm member, setrole, invite
 *
 * Backend auth:
 *   DELETE /projects/:id/members/:userId         → MASTER_ADMIN only
 *   PATCH  /projects/:id/members/:userId/role    → MASTER_ADMIN, PROJECT_MANAGER
 *   POST   /projects/:id/invites                 → MASTER_ADMIN, PROJECT_MANAGER (via useCreateInvite)
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const ADMIN_ONLY = ['MASTER_ADMIN'] as const
const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

export function createMemberWriteHandlers(
  vfs: VirtualFileSystem,
  projectId: string
): Record<string, CommandHandler> {
  return {
    // ── rm member ─────────────────────────────────────────────────────────────
    // Usage: rm members/<email>.json
    'rm-member': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...ADMIN_ONLY], 'rm member') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_ONLY], 'rm member') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'rm: missing operand' }] }

      const resolvedPath = vfs.resolve(targetPath)
      const filename = resolvedPath.split('/').pop()?.replace(/\.json$/, '') ?? ''

      // Members are named by email, email is the filename
      const { data: members } = await api.get(`/projects/${projectId}/members`)
      const matched = (members as any[]).find(
        (m: any) => (m.user?.email ?? m.email ?? '').toLowerCase() === filename.toLowerCase()
      )

      if (!matched) {
        return { lines: [{ type: 'stderr', content: `rm: member not found: "${filename}"` }] }
      }

      if (matched.userId === context.user?.id) {
        return { lines: [{ type: 'stderr', content: 'rm: you cannot remove yourself from the project.' }] }
      }

      try {
        await api.delete(`/projects/${projectId}/members/${matched.userId}`)
        return { lines: [{ type: 'success', content: `✓ Member removed: ${filename}` }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `rm member: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── setrole ───────────────────────────────────────────────────────────────
    // Usage: setrole members/<email>.json --role=MEMBER|PROJECT_MANAGER
    setrole: async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'setrole') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'setrole') } }

      const targetPath = parsed.args[0]
      const newRole = (parsed.flags['role'] as string)?.toUpperCase()

      if (!targetPath) return { lines: [{ type: 'stderr', content: 'setrole: usage: setrole members/<email>.json --role=MEMBER|PROJECT_MANAGER' }] }
      if (!newRole || !['MEMBER', 'PROJECT_MANAGER'].includes(newRole)) {
        return { lines: [{ type: 'stderr', content: 'setrole: --role must be MEMBER or PROJECT_MANAGER' }] }
      }

      const resolvedPath = vfs.resolve(targetPath)
      const filename = resolvedPath.split('/').pop()?.replace(/\.json$/, '') ?? ''

      const { data: members } = await api.get(`/projects/${projectId}/members`)
      const matched = (members as any[]).find(
        (m: any) => (m.user?.email ?? m.email ?? '').toLowerCase() === filename.toLowerCase()
      )

      if (!matched) return { lines: [{ type: 'stderr', content: `setrole: member not found: "${filename}"` }] }
      if (matched.userId === context.user?.id) {
        return { lines: [{ type: 'stderr', content: 'setrole: you cannot change your own role.' }] }
      }

      // PROJECT_MANAGER can only manage MEMBERs (backend enforces too)
      if (context.userRole === 'PROJECT_MANAGER' && matched.role !== 'MEMBER') {
        return {
          lines: [
            { type: 'stderr', content: `setrole: as PROJECT_MANAGER you can only change MEMBER roles.` },
            { type: 'system', content: `  "${filename}" currently has role: ${matched.role}` },
          ],
        }
      }

      try {
        await api.patch(`/projects/${projectId}/members/${matched.userId}/role`, { role: newRole })
        return {
          lines: [
            { type: 'success', content: `✓ Role updated: ${filename} → ${newRole}` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `setrole: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── invite ────────────────────────────────────────────────────────────────
    // Usage: invite <email>
    invite: async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'invite') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'invite') } }

      const email = parsed.args[0]
      if (!email || !email.includes('@')) {
        return { lines: [{ type: 'stderr', content: 'invite: usage: invite <email@domain.com>' }] }
      }

      try {
        await api.post(`/projects/${projectId}/invites`, { email })
        return {
          lines: [
            { type: 'success', content: `✓ Invite sent to: ${email}` },
            { type: 'system', content: `  They will receive a link to join "${context.projectName}".` },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `invite: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
