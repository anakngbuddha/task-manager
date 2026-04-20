/**
 * Project-level commands: touch project, archive
 *
 * These run at workspace/dashboard level (no projectId scope).
 * Backend auth:
 *   POST   /projects         → any authenticated user
 *   GET    /projects         → any authenticated user
 *   PATCH  /projects/:id     → MASTER_ADMIN, PROJECT_MANAGER (for archive)
 *   DELETE /projects/:id     → MASTER_ADMIN only
 */
import { api } from '@/lib/api'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'

const ADMIN_OR_PM = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

export function createProjectWriteHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── touch project ─────────────────────────────────────────────────────────
    // Usage: touch project <project-name>
    //   or:  touch project --name="My Project"
    'touch-project': async (parsed, context): Promise<CommandResult> => {
      // Any authenticated user can create a project (backend check: just authenticate)
      if (!context.user) {
        return { lines: [{ type: 'stderr', content: 'touch project: you must be logged in.' }] }
      }

      const name = (parsed.flags['name'] as string)
        || parsed.args.join(' ')   // "touch project My Project Name"
        || parsed.args[0]          // fallback

      if (!name?.trim()) {
        return {
          lines: [
            { type: 'stderr', content: 'touch project: project name is required.' },
            { type: 'system', content: '  Usage: touch project "My Project Name"' },
            { type: 'system', content: '    or:  touch project --name="My Project Name"' },
          ],
        }
      }

      try {
        const { data } = await api.post('/projects', { name: name.trim() })
        return {
          lines: [
            { type: 'success', content: `✓ Project created: "${data.name}"` },
            { type: 'json', content: JSON.stringify({ id: data.id, name: data.name, status: data.status }) },
            { type: 'system', content: `  Navigate to: /projects/${data.id}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `touch project: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── archive (mark project complete) ───────────────────────────────────────
    // Usage: archive  (marks the current project as COMPLETED)
    archive: async (_parsed, context): Promise<CommandResult> => {
      // Read projectId from VFS at call time (fixes BUG-02)
      const currentProjectId = vfs.projectId
      if (!currentProjectId || currentProjectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'archive: this command must be run from within a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'archive') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'archive') } }

      try {
        await api.patch(`/projects/${currentProjectId}`, { status: 'COMPLETED' })
        return {
          lines: [
            { type: 'success', content: `✓ Project archived (marked as COMPLETED).` },
            { type: 'system', content: '  The project is now read-only. Navigate to dashboard to create a new project.' },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `archive: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
