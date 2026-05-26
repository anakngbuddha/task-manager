/**
 * Admin-only VFS commands — MASTER_ADMIN role required for all handlers.
 *
 * Commands:
 *   users            List all platform users
 *   metrics          Print platform metrics summary
 *   ban <email>      Suspend a user account
 *   unban <email>    Reactivate a suspended user account
 *   audit [n]        Show last N audit log entries (default 20)
 *   purge-project    Hard-delete a project (irreversible)
 *
 * These commands call backend endpoints that are already admin-guarded
 * server-side (user.role === 'admin'). The frontend guard here is
 * defence-in-depth for a better UX error message.
 */
import { api } from '@/lib/api'
import type { CommandHandler, CommandResult, CommandContext } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

function checkAdmin(context: CommandContext, cmd: string): CommandResult | null {
  if (context.user?.role?.toUpperCase() !== 'ADMIN') {
    return { lines: [{ type: 'stderr', content: `${cmd}: permission denied. System ADMIN required.` }] }
  }
  return null
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createAdminHandlers(
  _vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── users ─────────────────────────────────────────────────────────────────
    // Usage: users
    users: async (_parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'users')
      if (authError) return authError

      try {
        const { data } = await api.get('/admin/users')
        const users: any[] = data ?? []
        if (users.length === 0) {
          return { lines: [{ type: 'system', content: 'No users found.' }] }
        }

        const header = `<span class="term-json-key">${'ID'.padEnd(12)} ${'EMAIL'.padEnd(32)} ${'NAME'.padEnd(20)} ${'ROLE'.padEnd(14)} LAST SEEN</span>`
        const rows = users.map((u: any) => {
          const id    = escapeHtml(String(u.id ?? '').slice(0, 8))
          const email = escapeHtml((u.email ?? '').slice(0, 30))
          const name  = escapeHtml((u.name  ?? '—').slice(0, 18))
          const role  = escapeHtml(u.role   ?? 'user')
          const lastSeen = u.lastSeenAt
            ? new Date(u.lastSeenAt).toLocaleDateString()
            : '—'
          const roleColor = role.toUpperCase() === 'ADMIN' ? '#bc8cff' : role.toUpperCase() === 'BANNED' ? '#f85149' : '#3fb950'
          return (
            `<span class="term-file">${id.padEnd(12)} ${email.padEnd(32)} ${name.padEnd(20)} </span>` +
            `<span style="color:${escapeHtml(roleColor)}">${role.padEnd(14)}</span> ` +
            `<span class="term-json-str">${escapeHtml(lastSeen)}</span>`
          )
        })

        return {
          lines: [
            { type: 'system', content: `${users.length} user(s) registered:` },
            { type: 'table', content: [header, ...rows].join('\n') },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `users: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── metrics ───────────────────────────────────────────────────────────────
    // Usage: metrics
    metrics: async (_parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'metrics')
      if (authError) return authError

      try {
        const { data: m } = await api.get('/admin/metrics')
        const pct = (v: number) => `${v}%`
        const html = [
          `<span class="term-json-key">Platform Overview</span>`,
          `  <span class="term-json-key">Total Users:      </span><span class="term-json-num">${m.totalUsers}</span>  (+${m.recentSignups} this week)`,
          `  <span class="term-json-key">Active Projects:  </span><span class="term-json-num">${m.activeProjects}</span>`,
          `  <span class="term-json-key">Total Tasks:      </span><span class="term-json-num">${m.totalTasks}</span>`,
          ``,
          `<span class="term-json-key">Task Health</span>`,
          `  <span class="term-json-key">Completion Rate:  </span><span class="term-json-num">${pct(m.taskCompletionRate)}</span>`,
          `  <span class="term-json-key">Overdue Tasks:    </span><span style="color:${m.overdueTasks > 0 ? '#f85149' : '#3fb950'}">${m.overdueTasks}</span>`,
          `  <span class="term-json-key">Avg Days/Task:    </span><span class="term-json-num">${m.avgCompletionDays}d</span>`,
          ``,
          `<span class="term-json-key">Engagement</span>`,
          `  <span class="term-json-key">DAU:              </span><span class="term-json-num">${m.dauCount}</span>`,
          `  <span class="term-json-key">WAU:              </span><span class="term-json-num">${m.wauCount}</span>`,
          `  <span class="term-json-key">Churn Risk:       </span><span style="color:${m.churnRiskUsers > 0 ? '#ffa657' : '#3fb950'}">${m.churnRiskUsers}</span>`,
          `  <span class="term-json-key">Invite Acceptance:</span><span class="term-json-num">${pct(m.inviteAcceptanceRate)}</span>`,
          ``,
          `<span class="term-json-key">Consent</span>`,
          `  <span class="term-json-key">Accepted All:     </span><span class="term-json-num">${m.consentOverview?.acceptedAll ?? 0}</span>`,
          `  <span class="term-json-key">Essential Only:   </span><span class="term-json-num">${m.consentOverview?.essentialOnly ?? 0}</span>`,
          `  <span class="term-json-key">No Choice:        </span><span class="term-json-num">${m.consentOverview?.noChoice ?? 0}</span>`,
        ].join('\n')

        return { lines: [{ type: 'table', content: html }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `metrics: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── audit ─────────────────────────────────────────────────────────────────
    // Usage: audit [n]   — shows last n audit log entries (default 20, max 50)
    audit: async (parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'audit')
      if (authError) return authError

      const n = Math.min(50, Math.max(1, parseInt(parsed.args[0] ?? '20', 10) || 20))

      try {
        const { data } = await api.get('/admin/audit-logs', { params: { pageSize: n, page: 1 } })
        const items: any[] = data?.items ?? data ?? []
        if (items.length === 0) {
          return { lines: [{ type: 'system', content: 'No audit log entries found.' }] }
        }

        const rows = items.map((log: any) => {
          const ts  = log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'
          const who = escapeHtml((log.userEmail ?? log.userName ?? log.userId ?? '?').slice(0, 28))
          const act = escapeHtml((log.action ?? '').padEnd(8))
          const ent = escapeHtml((log.entityType ?? '').padEnd(12))
          const name = escapeHtml((log.entityName ?? log.entityId ?? '').slice(0, 30))
          return (
            `<span class="term-json-str">${escapeHtml(ts).padEnd(20)}</span> ` +
            `<span class="term-file">${who.padEnd(30)}</span> ` +
            `<span style="color:#ffa657">${act}</span> ` +
            `<span class="term-dir">${ent}</span> ` +
            `<span class="term-json-key">${name}</span>`
          )
        })

        return {
          lines: [
            { type: 'system', content: `Last ${items.length} audit log entries:` },
            { type: 'table', content: rows.join('\n') },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `audit: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── ban ───────────────────────────────────────────────────────────────────
    // Usage: ban <email>
    ban: async (parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'ban')
      if (authError) return authError

      const email = parsed.args[0]?.trim()
      if (!email) {
        return {
          lines: [
            { type: 'stderr', content: 'ban: missing email.' },
            { type: 'system', content: '  Usage: ban <user@email.com>' },
          ],
        }
      }

      try {
        // Find the user by email first
        const { data: users } = await api.get('/admin/users')
        const user = (users as any[]).find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (!user) {
          return { lines: [{ type: 'stderr', content: `ban: user not found: "${email}"` }] }
        }
        if (user.role === 'admin') {
          return { lines: [{ type: 'stderr', content: 'ban: cannot ban a system admin.' }] }
        }

        await api.patch(`/admin/users/${user.id}/status`, { status: 'banned' })
        return {
          lines: [{ type: 'success', content: `✓ User banned: ${email}` }],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `ban: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── unban ─────────────────────────────────────────────────────────────────
    // Usage: unban <email>
    unban: async (parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'unban')
      if (authError) return authError

      const email = parsed.args[0]?.trim()
      if (!email) {
        return {
          lines: [
            { type: 'stderr', content: 'unban: missing email.' },
            { type: 'system', content: '  Usage: unban <user@email.com>' },
          ],
        }
      }

      try {
        const { data: users } = await api.get('/admin/users')
        const user = (users as any[]).find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (!user) {
          return { lines: [{ type: 'stderr', content: `unban: user not found: "${email}"` }] }
        }

        await api.patch(`/admin/users/${user.id}/status`, { status: 'active' })
        return {
          lines: [{ type: 'success', content: `✓ User reactivated: ${email}` }],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `unban: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // ── purge-project ─────────────────────────────────────────────────────────
    // Usage: purge-project <projectId>
    'purge-project': async (parsed, context): Promise<CommandResult> => {
      const authError = checkAdmin(context, 'purge-project')
      if (authError) return authError

      const projectId = parsed.args[0]?.trim()
      if (!projectId) {
        return {
          lines: [
            { type: 'stderr', content: 'purge-project: missing project ID.' },
            { type: 'system', content: '  Usage: purge-project <project-id>' },
            { type: 'system', content: '  ⚠ This permanently deletes the project and all its data.' },
          ],
        }
      }

      // Confirmation prompt
      if (context.promptUser) {
        const answer = await context.promptUser(
          `⚠ This will PERMANENTLY DELETE project "${projectId}" and ALL its data.\n  Type the project ID to confirm: `
        )
        if (answer.trim() !== projectId) {
          return { lines: [{ type: 'system', content: 'purge-project: aborted (confirmation did not match).' }] }
        }
      }

      try {
        await api.delete(`/admin/projects/${projectId}`)
        return {
          lines: [
            { type: 'success', content: `✓ Project purged: ${projectId}` },
            { type: 'system', content: '  All tasks, sprints, members, and messages have been permanently removed.' },
          ],
          invalidations: [['projects'], ['projects-dashboard']],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `purge-project: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },
  }
}
