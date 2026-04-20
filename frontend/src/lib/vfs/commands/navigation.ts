/**
 * Navigation commands: pwd, cd, ls, cat, whoami, clear, help
 *
 * All handlers receive the shared VirtualFileSystem instance
 * via closure (injected in commandRegistry).
 */
import type { VFSNode } from '../types'
import type { VFSFile } from '../types'
import type { CommandHandler, CommandResult, OutputLineSpec } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'
import { api } from '@/lib/api'

/**
 * Escapes a string for safe insertion into innerHTML.
 * Prevents XSS from user-controlled values (task names, project names, emails, paths).
 */
function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const HELP_TEXT: Record<string, string[]> = {
  // ── Read / Navigation ──────────────────────────────────────────────────────
  pwd:    ['Print the current virtual directory.', '  Usage: pwd'],
  cd:     ['Change the current virtual directory.', '  Usage: cd <path>', '  Example: cd tasks/todo', '         cd ..', '         cd /sprints', '         cd projects'],
  ls:     ['List contents of a directory.', '  Usage: ls [path]', '  Example: ls', '         ls tasks/in_progress'],
  cat:    ['Print the full JSON details of a file.', '  Usage: cat <file>', '  Example: cat tasks/todo/my-task__a1b2c3d4'],
  find:   ['Search for files matching filters.', '  Usage: find <path> [--key=value ...]', '  Example: find tasks/ --priority=HIGH', '         find tasks/todo --title=auth'],
  stat:   ['Show aggregate statistics for a directory.', '  Usage: stat [path]', '  Example: stat tasks/', '         stat sprints/'],
  whoami: ['Show your current user info and project role.', '  Usage: whoami'],
  clear:  ['Clear the terminal output.', '  Usage: clear  (or Ctrl+L)'],
  help:   ['Show this help message.', '  Usage: help [command]', '  Example: help touch'],
  // ── Write — Tasks (MASTER_ADMIN, PROJECT_MANAGER) ─────────────────────────
  touch:  [
    'Create a new entity.',
    '  touch tasks/<status>/<name> --assignee=<email|everyone> --deadline="YYYY-MM-DDTHH:MM" [--priority=MEDIUM] [--description="..."] [--sprint=<name>] [--project=<name>]',
    '    REQUIRED: --assignee  (use an email or "everyone" to assign all members)',
    '    REQUIRED: --deadline  (future date, e.g. "2026-12-31T23:59")',
    '    Optional: --priority  (LOW | MEDIUM | HIGH | URGENT, default: MEDIUM)',
    '    Optional: --description  (task description text)',
    '    Optional: --sprint  (sprint name to include task in)',
    '    Optional: --project  (override current project by name)',
    '  touch sprints/<name> [--goal="..."] [--start=<ISO>] [--end=<ISO>]',
    '  touch schedules/<name> --at=<ISO> [--end=<ISO>] [--type=MEETING] [--attendees=a@b,c@d]',
    '  touch project <name>',
    '',
    '  Example: touch tasks/todo/fix-login.json --assignee=everyone --deadline="2026-05-01T09:00" --priority=HIGH',
  ],

  mkdir: [
    'Create a new directory.',
    '  mkdir profile/files/<folder>         — create a personal file folder',
  ],
  rm: [
    'Delete an entity.',
    '  rm tasks/<status>/<file>          [MASTER_ADMIN, PROJECT_MANAGER]',
    '  rm sprints/<file>                 [MASTER_ADMIN, PROJECT_MANAGER]',
    '  rm members/<email>                [MASTER_ADMIN only]',
  ],
  mv: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Move a task to another status column.',
    '  Usage: mv tasks/<status>/<file> tasks/<new-status>/',
    '  Example: mv tasks/todo/fix-bug__abc tasks/in_progress/',
  ],
  // ── Write — Sprints ────────────────────────────────────────────────────────
  start: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Start a planning sprint.',
    '  Usage: start sprints/<file> --start=<ISO> --end=<ISO>',
  ],
  close: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Complete an active sprint.',
    '  Usage: close sprints/<file> [--move-to=TODO]',
  ],
  // ── Write — Members ────────────────────────────────────────────────────────
  setrole: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Change a member\'s role.',
    '  Usage: setrole members/<email> --role=MEMBER|PROJECT_MANAGER',
  ],
  invite: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Invite a user to the project by email.',
    '  Usage: invite alice@example.com',
  ],
  // ── Write — Communication ──────────────────────────────────────────────────
  msg: [
    '[Any member] Send a message to the project channel.',
    '  Usage: msg "Hello team!"',
  ],
  dm: [
    '[Any member] Send a direct message to a project member.',
    '  Usage: dm alice@example.com "Your message here"',
  ],
  // ── Write — Time ───────────────────────────────────────────────────────────
  log: [
    '[Any member] Log time against a task.',
    '  Usage: log tasks/<status>/<file> --minutes=60 --title="Fix bug" --desc="Details..."',
    '  Alt:   log tasks/todo/my-task__abc --hours=1.5 --title="Review"',
  ],
  // ── Write — GitHub ─────────────────────────────────────────────────────────
  github: [
    'Manage GitHub integration.',
    '  github status                                         — show connection status',
    '  github link                                           — get install URL',
    '  github setmap --pr_merged=DONE --pr_opened=IN_REVIEW  — update status mapping',
    '  Keys: pr_merged, pr_opened, pr_closed, pr_review_approved',
  ],
  // ── Write — Project ────────────────────────────────────────────────────────
  archive: [
    '[MASTER_ADMIN, PROJECT_MANAGER] Mark the current project as completed.',
    '  Usage: archive',
  ],
  // ── Write — Profile & Files ───────────────────────────────────────
  upload: [
    'Upload a file using the native browser file picker.',
    '  upload                    — upload to personal profile files',
    '  upload profile/files      — same as above',
    '  upload projects/<name>    — upload to current project files',
  ],
  open: [
    'Navigate the browser to a page.',
    '  open profile              — go to your profile page',
    '  open profile/settings     — go to settings',
    '  open change-password      — go to change-password page',
    '  open activity             — go to the activity feed',
  ],
}

const ALL_COMMANDS = Object.keys(HELP_TEXT)


/** Build an HTML table string for ls output */
function buildLsTable(nodes: VFSNode[]): string {
  if (nodes.length === 0) return `<span class="term-line--system">(empty directory)</span>`

  const rows = nodes
    .map((n) => {
      const isDir = n.type === 'dir'
      const icon = isDir ? '📁' : '📄'
      const nameClass = isDir ? 'term-dir' : 'term-file'
      const safeName = escapeHtml(n.name)
      const displayName = isDir ? `${safeName}/` : safeName
      return `<span class="${nameClass}">${icon} ${displayName}</span>`
    })
    .join('\n')

  return rows
}

/**
 * Factory: creates navigation command handlers bound to a VFS instance.
 */
export function createNavigationHandlers(vfs: VirtualFileSystem): Record<string, CommandHandler> {
  return {
    // ── pwd ──────────────────────────────────────────────────────────
    pwd: async (): Promise<CommandResult> => {
      return { lines: [{ type: 'stdout', content: vfs.cwd }] }
    },

    // ── cd ───────────────────────────────────────────────────────────
    cd: async (parsed, context): Promise<CommandResult> => {
      const target = parsed.args[0] ?? '/'
      try {
        const newCwd = await vfs.cd(target)

        // Check if a project switch occurred (cd into /projects/<name>)
        const switchInfo = vfs._pendingProjectSwitch
        vfs._pendingProjectSwitch = null   // consume it

        if (switchInfo) {
          // Fetch the user's role in the new project
          let derivedRole: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null = 'MEMBER'
          try {
            const { data: members } = await api.get(`/projects/${switchInfo.id}/members`)
            const me = (members as any[]).find(
              (m: any) => m.userId === context.user?.id
            )
            if (me) {
              derivedRole = me.role as typeof derivedRole
            }
          } catch {
            // If we can't fetch members, fall back to MEMBER
          }

          return {
            lines: [
              { type: 'success', content: `✓ Switched to project: "${switchInfo.name}"` },
              { type: 'system', content: `  Role: ${derivedRole}` },
              { type: 'system', content: '  Type "ls" to explore, "whoami" to confirm.' },
            ],
            newCwd,
            newProjectId: switchInfo.id,
            newProjectName: switchInfo.name,
            newUserRole: derivedRole,
          }
        }

        return { lines: [], newCwd }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: err.message ?? 'cd: unknown error' }] }
      }
    },

    // ── ls ───────────────────────────────────────────────────────────
    ls: async (parsed): Promise<CommandResult> => {
      const target = parsed.args[0]
      try {
        const nodes = await vfs.listDir(target)
        if (nodes.length === 0) {
          return { lines: [{ type: 'system', content: '(empty)' }] }
        }
        const html = buildLsTable(nodes)
        return { lines: [{ type: 'table', content: html }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: err.message ?? 'ls: error' }] }
      }
    },

    // ── cat ──────────────────────────────────────────────────────────
    cat: async (parsed): Promise<CommandResult> => {
      const target = parsed.args[0]
      if (!target) {
        return { lines: [{ type: 'stderr', content: 'cat: missing file operand' }] }
      }
      try {
        const data = await vfs.readFile(target)
        return { lines: [{ type: 'json', content: JSON.stringify(data) }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: err.message ?? 'cat: error' }] }
      }
    },

    // ── whoami ───────────────────────────────────────────────────────
    whoami: async (_parsed, context): Promise<CommandResult> => {
      const { user, userRole, projectName } = context
      if (!user) {
        return { lines: [{ type: 'stderr', content: 'whoami: not authenticated' }] }
      }
      const roleColors: Record<string, string> = {
        MASTER_ADMIN: '#bc8cff',
        PROJECT_MANAGER: '#58a6ff',
        MEMBER: '#3fb950',
      }
      const color = roleColors[userRole ?? 'MEMBER'] ?? '#c9d1d9'
      const html = [
        `<span class="term-json-key">user:</span>     <span class="term-json-str">"${escapeHtml(user.name ?? user.email)}"</span>`,
        `<span class="term-json-key">email:</span>    <span class="term-json-str">"${escapeHtml(user.email)}"</span>`,
        `<span class="term-json-key">project:</span>  <span class="term-json-str">"${escapeHtml(projectName)}"</span>`,
        `<span class="term-json-key">role:</span>     <span style="color:${escapeHtml(color)};font-weight:600">${escapeHtml(userRole ?? 'MEMBER')}</span>`,
        `<span class="term-json-key">cwd:</span>      <span class="term-dir">${escapeHtml(vfs.cwd)}</span>`,
      ].join('\n')
      return { lines: [{ type: 'table', content: html }] }
    },

    // ── find ─────────────────────────────────────────────────────────
    find: async (parsed): Promise<CommandResult> => {
      const searchPath = parsed.args[0] ?? vfs.cwd
      const filters: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed.flags)) {
        if (typeof v === 'string') filters[k] = v
      }

      try {
        const results = await vfs.find(searchPath, filters)
        if (results.length === 0) {
          return { lines: [{ type: 'system', content: 'No results found.' }] }
        }
        const html = results
          .map((r: VFSFile) => `<span class="term-file">📄 ${escapeHtml(r.path)}</span>`)
          .join('\n')
        return {
          lines: [
            { type: 'system', content: `Found ${results.length} result${results.length === 1 ? '' : 's'}:` },
            { type: 'table', content: html },
          ],
        }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: err.message ?? 'find: error' }] }
      }
    },

    // ── stat ─────────────────────────────────────────────────────────
    stat: async (parsed): Promise<CommandResult> => {
      const target = parsed.args[0] ?? vfs.cwd
      try {
        const stats = await vfs.stat(target)
        const html = [
          `<span class="term-json-key">path:</span>        <span class="term-dir">${escapeHtml(stats.path)}</span>`,
          `<span class="term-json-key">directories:</span> <span class="term-json-num">${stats.directories}</span>`,
          `<span class="term-json-key">files:</span>       <span class="term-json-num">${stats.files}</span>`,
          `<span class="term-json-key">total:</span>       <span class="term-json-num">${stats.total}</span>`,
        ].join('\n')
        return { lines: [{ type: 'table', content: html }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: err.message ?? 'stat: error' }] }
      }
    },

    // ── clear ────────────────────────────────────────────────────────
    clear: async (): Promise<CommandResult> => {
      return { lines: [], clear: true }
    },

    // ── help ─────────────────────────────────────────────────────────
    help: async (parsed): Promise<CommandResult> => {
      const target = parsed.args[0]

      if (target) {
        const info = HELP_TEXT[target]
        if (!info) {
          return { lines: [{ type: 'stderr', content: `help: no help for '${target}'` }] }
        }
        return {
          lines: info.map((line): OutputLineSpec => ({ type: 'stdout', content: line })),
        }
      }

      // General help — show all commands in a table
      const html = ALL_COMMANDS.map((cmd) => {
        const first = HELP_TEXT[cmd][0]
        return `<span class="term-dir">${cmd.padEnd(10)}</span>  <span class="term-file">${first}</span>`
      }).join('\n')

      return {
        lines: [
          { type: 'system', content: 'Available commands:' },
          { type: 'empty', content: '' },
          { type: 'table', content: html },
          { type: 'empty', content: '' },
          { type: 'system', content: 'Type "help <command>" for detailed usage.' },
        ],
      }
    },
  }
}
