/**
 * Automation write commands: touch automation, rm automation, toggle automation
 *
 * Backend auth:
 *   GET    /projects/:id/automations   → any member
 *   POST   /projects/:id/automations   → MASTER_ADMIN, PROJECT_MANAGER
 *   PATCH  /projects/:id/automations/:ruleId → MASTER_ADMIN, PROJECT_MANAGER
 *   DELETE /projects/:id/automations/:ruleId → MASTER_ADMIN, PROJECT_MANAGER
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const WRITE_ROLES = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const

const VALID_TRIGGERS = [
  'TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNED',
  'TASK_PRIORITY_CHANGED', 'TASK_DEADLINE_APPROACHING',
  'SPRINT_STARTED', 'SPRINT_COMPLETED',
] as const

const VALID_ACTIONS = [
  'SET_STATUS', 'SET_PRIORITY', 'ASSIGN_TO_MEMBER',
  'UNASSIGN_TASK', 'ADD_TAG', 'SEND_NOTIFICATION',
  'MOVE_TO_SPRINT', 'REMOVE_FROM_SPRINT',
] as const

function extractEntityId(filename: string): string | null {
  const base = filename.replace(/\.json$/, '')
  const match = base.match(/__([a-zA-Z0-9]+)$/)
  return match ? match[1] : null
}

async function resolveAutomationId(
  projectId: string,
  resolvedPath: string,
): Promise<{ entityId: string; name: string } | null> {
  const filename = resolvedPath.split('/').pop() ?? ''
  const directId = extractEntityId(filename)
  if (directId) return { entityId: directId, name: filename }

  // Fuzzy fallback: search by name
  const { data } = await api.get(`/projects/${projectId}/automations`)
  const rules: any[] = data ?? []
  const normalizedQuery = filename.toLowerCase().replace(/[^a-z0-9]/g, '')
  const match = rules.find(r => {
    const safeName = (r.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return safeName === normalizedQuery || safeName.includes(normalizedQuery)
  })
  if (!match) return null
  return { entityId: match.id, name: match.name }
}

export function createAutomationHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── touch automation ──────────────────────────────────────────────────────
    // Usage: touch automations/<name> --trigger=TASK_CREATED --action=SET_STATUS --action-status=IN_PROGRESS
    'touch-automation': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'touch automation') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'touch automation') } }

      if (!vfs.projectId || vfs.projectId === '__workspace__') {
        return { lines: [{ type: 'stderr', content: 'touch automation: navigate to a project first.' }] }
      }

      const namePart = parsed.args[0]?.replace(/^automations\//, '').replace(/\.json$/, '')
      if (!namePart) {
        return {
          lines: [
            { type: 'stderr', content: 'touch automation: name is required.' },
            { type: 'system', content: '  Usage: touch automations/<name> --trigger=TASK_CREATED --action=SET_STATUS [--action-status=IN_PROGRESS]' },
            { type: 'system', content: `  Valid triggers: ${VALID_TRIGGERS.join(', ')}` },
            { type: 'system', content: `  Valid actions:  ${VALID_ACTIONS.join(', ')}` },
          ],
        }
      }

      const trigger = String(parsed.flags['trigger'] ?? '').toUpperCase()
      if (!VALID_TRIGGERS.includes(trigger as any)) {
        return {
          lines: [
            { type: 'stderr', content: `touch automation: invalid trigger "${trigger}".` },
            { type: 'system', content: `  Valid: ${VALID_TRIGGERS.join(', ')}` },
          ],
        }
      }

      const actionType = String(parsed.flags['action'] ?? '').toUpperCase()
      if (!VALID_ACTIONS.includes(actionType as any)) {
        return {
          lines: [
            { type: 'stderr', content: `touch automation: invalid action "${actionType}".` },
            { type: 'system', content: `  Valid: ${VALID_ACTIONS.join(', ')}` },
          ],
        }
      }

      // Build action params from remaining flags
      const actionParams: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(parsed.flags)) {
        if (k.startsWith('action-')) actionParams[k.slice(7)] = v
      }

      const body = {
        name: namePart.replace(/-+/g, ' '),
        description: (parsed.flags['description'] as string) ?? '',
        trigger,
        actions: [{ type: actionType, params: actionParams }],
      }

      try {
        const { data } = await api.post(`/projects/${vfs.projectId}/automations`, body)
        return {
          lines: [
            { type: 'success', content: `✓ Automation created: "${data.name}"` },
            { type: 'json', content: JSON.stringify({ id: data.id, trigger: data.trigger, isEnabled: data.isEnabled }) },
          ],
          invalidations: [['automations', vfs.projectId]],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `touch automation: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── rm automation ─────────────────────────────────────────────────────────
    // Usage: rm automations/<name-or-file>
    'rm-automation': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'rm automation') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'rm automation') } }

      const targetPath = parsed.args[0]
      if (!targetPath) return { lines: [{ type: 'stderr', content: 'rm: missing operand' }] }

      const resolvedPath = vfs.resolve(targetPath)
      const resolved = await resolveAutomationId(vfs.projectId, resolvedPath)

      if (!resolved) {
        return { lines: [{ type: 'stderr', content: `rm: automation not found: "${targetPath}"` }] }
      }

      try {
        await api.delete(`/projects/${vfs.projectId}/automations/${resolved.entityId}`)
        return {
          lines: [{ type: 'success', content: `✓ Automation deleted: ${resolved.name}` }],
          invalidations: [['automations', vfs.projectId]],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `rm automation: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── toggle automation ─────────────────────────────────────────────────────
    // Usage: toggle automations/<name-or-file>
    'toggle-automation': async (parsed, context): Promise<CommandResult> => {
      try { assertVFSRole(context.userRole, [...WRITE_ROLES], 'toggle automation') }
      catch { return { lines: authDeniedLines(context.userRole, [...WRITE_ROLES], 'toggle automation') } }

      const targetPath = parsed.args[0]
      if (!targetPath) {
        return {
          lines: [
            { type: 'stderr', content: 'toggle: missing automation path.' },
            { type: 'system', content: '  Usage: toggle automations/<name>' },
          ],
        }
      }

      const resolvedPath = vfs.resolve(targetPath)
      const resolved = await resolveAutomationId(vfs.projectId, resolvedPath)

      if (!resolved) {
        return { lines: [{ type: 'stderr', content: `toggle: automation not found: "${targetPath}"` }] }
      }

      try {
        const { data } = await api.post(`/projects/${vfs.projectId}/automations/${resolved.entityId}/toggle`)
        return {
          lines: [
            { type: 'success', content: `✓ Automation ${data.isEnabled ? 'enabled' : 'disabled'}: ${resolved.name}` },
          ],
          invalidations: [['automations', vfs.projectId]],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `toggle automation: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
