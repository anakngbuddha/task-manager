/**
 * Project-level commands: touch project, lifecycle, reports
 *
 * These run at workspace/dashboard level (no projectId scope).
 * Backend auth:
 *   POST   /projects         → any authenticated user
 *   GET    /projects         → any authenticated user
 *   PATCH  /projects/:id     → MASTER_ADMIN, PROJECT_MANAGER (for lifecycle updates)
 *   DELETE /projects/:id     → MASTER_ADMIN only
 */
import { api } from '@/lib/api'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'

const ADMIN_OR_PM = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const
const DONE_TASK_STATUSES = new Set(['DONE', 'READY'])

function resolveProjectIdFromArgs(arg?: string): string | null {
  const candidate = (arg ?? '').trim()
  if (!candidate) return null
  if (candidate.startsWith('/')) {
    const parts = candidate.split('/').filter(Boolean)
    return parts[0] === 'projects' && parts[1] ? parts[1] : null
  }
  return candidate
}

async function updateProjectStatus(
  projectId: string,
  status: 'ACTIVE' | 'COMPLETED' | 'AXED',
) {
  await api.patch(`/projects/${projectId}`, { status })
}

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

    // ── project-close / archive (mark project complete) ───────────────────────
    // Usage: project-close [projectId] (defaults to current project)
    'project-close': async (parsed, context): Promise<CommandResult> => {
      // Read projectId from VFS at call time (fixes BUG-02)
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'project-close: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'archive') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'archive') } }

      try {
        await updateProjectStatus(projectId, 'COMPLETED')
        return {
          lines: [
            { type: 'success', content: '✓ Project closed (marked as COMPLETED).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `project-close: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
    'close-project': async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'close-project: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'close-project') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'close-project') } }

      try {
        await updateProjectStatus(projectId, 'COMPLETED')
        return {
          lines: [
            { type: 'success', content: '✓ Project closed (marked as COMPLETED).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `close-project: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // Backward-compatible alias.
    archive: async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'archive: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'archive') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'archive') } }

      try {
        await updateProjectStatus(projectId, 'COMPLETED')
        return {
          lines: [
            { type: 'success', content: '✓ Project archived (marked as COMPLETED).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `archive: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── project-axe (discontinue project) ────────────────────────────────────
    // Usage: project-axe [projectId] (defaults to current project)
    'project-axe': async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'project-axe: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'project-axe') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'project-axe') } }

      try {
        await updateProjectStatus(projectId, 'AXED')
        return {
          lines: [
            { type: 'success', content: '✓ Project discontinued (marked as AXED).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `project-axe: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
    'axe-project': async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'axe-project: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'axe-project') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'axe-project') } }

      try {
        await updateProjectStatus(projectId, 'AXED')
        return {
          lines: [
            { type: 'success', content: '✓ Project discontinued (marked as AXED).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `axe-project: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── project-reopen ────────────────────────────────────────────────────────
    // Usage: project-reopen <projectId> (or run within that project)
    'project-reopen': async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'project-reopen: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'project-reopen') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'project-reopen') } }

      try {
        await updateProjectStatus(projectId, 'ACTIVE')
        return {
          lines: [
            { type: 'success', content: '✓ Project re-opened (marked as ACTIVE).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `project-reopen: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
    'reopen-project': async (parsed, context): Promise<CommandResult> => {
      const currentProjectId = vfs.projectId
      const projectId = resolveProjectIdFromArgs(parsed.args[0]) ?? currentProjectId
      if (!projectId || projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'reopen-project: provide a project id, or run this inside a project terminal.' }] }
      }
      try { assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'reopen-project') }
      catch { return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'reopen-project') } }

      try {
        await updateProjectStatus(projectId, 'ACTIVE')
        return {
          lines: [
            { type: 'success', content: '✓ Project re-opened (marked as ACTIVE).' },
            { type: 'system', content: `  Project ID: ${projectId}` },
          ],
          invalidations: [['projects'], ['projects-dashboard']]
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `reopen-project: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── project-report ────────────────────────────────────────────────────────
    // Usage: project-report
    'project-report': async (_parsed, context): Promise<CommandResult> => {
      if (!context.user) {
        return { lines: [{ type: 'stderr', content: 'project-report: you must be logged in.' }] }
      }

      try {
        const { data: projectsData } = await api.get('/projects')
        const projects: any[] = projectsData ?? []
        if (projects.length === 0) {
          return { lines: [{ type: 'system', content: 'No projects found.' }] }
        }

        const taskResponses = await Promise.all(
          projects.map(async (project) => {
            const { data } = await api.get(`/projects/${project.id}/tasks`)
            return { projectId: String(project.id), tasks: (data as any[]) ?? [] }
          })
        )

        const tasksByProjectId = new Map(taskResponses.map((entry) => [entry.projectId, entry.tasks]))
        const lines: CommandResult['lines'] = []

        for (const project of projects) {
          const projectTasks = tasksByProjectId.get(String(project.id)) ?? []
          const completed = projectTasks.filter((task) => DONE_TASK_STATUSES.has(String(task.status))).length
          const pending = Math.max(projectTasks.length - completed, 0)

          lines.push(
            { type: 'system', content: `Project: ${project.name} (${project.status})` },
            { type: 'system', content: `  Remaining: ${pending} | Completed: ${completed} | Total: ${projectTasks.length}` }
          )

          if (projectTasks.length === 0) {
            lines.push({ type: 'stdout', content: '    - (no tasks)' })
            continue
          }

          for (const task of projectTasks) {
            const taskDone = DONE_TASK_STATUSES.has(String(task.status)) ? 'DONE' : 'PENDING'
            lines.push({
              type: 'stdout',
              content: `    - [${taskDone}] ${task.title} | status=${task.status}`
            })
          }
        }

        return { lines }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `project-report: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
