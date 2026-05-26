/**
 * Command Registry — maps command names to handler functions.
 *
 * Central dispatch table. The VirtualFileSystem instance is injected
 * here for shared state (cwd, etc.). All write handlers are wired here.
 */
import { VirtualFileSystem } from './VirtualFileSystem'
import type { CommandHandler, CommandContext, CommandResult, ParsedCommand } from './commandTypes'
import { createNavigationHandlers } from './commands/navigation'
import { createTaskWriteHandlers } from './commands/writeTasks'
import { createSprintWriteHandlers } from './commands/writeSprints'
import { createMemberWriteHandlers } from './commands/writeMembers'
import { createMessageWriteHandlers } from './commands/writeMessages'
import { createScheduleWriteHandlers } from './commands/writeSchedules'
import { createTimeLogWriteHandlers } from './commands/writeTimeLogs'
import { createGithubHandlers } from './commands/writeGithub'
import { createProjectWriteHandlers } from './commands/writeProjects'
import { createProfileWriteHandlers } from './commands/writeProfile'
import { createAdminHandlers } from './commands/writeAdmin'
import { createAutomationHandlers } from './commands/writeAutomations'

const BANNER = `
 __   _______ ____
 \\ \\ / /  ___/ ___|
  \\ V /| |_  \\___ \\
   | | |  _|  ___) |
   |_| |_|   |____/   Virtual File System v2.0

 Type "help" for available commands.
 Type "ls" to explore the project tree.
`.trim()

export { BANNER }

export class CommandRegistry {
  private vfs: VirtualFileSystem
  private handlers: Record<string, CommandHandler> = {}
  /** Optional SPA navigate function — used by 'open' command to avoid hard reloads */
  private navigate?: (path: string) => void

  constructor(vfs: VirtualFileSystem, navigate?: (path: string) => void) {
    this.vfs = vfs
    this.navigate = navigate
    this._register()
  }

  private _register() {
    // ── Read / navigation handlers ───────────────────────────────────────────
    const navHandlers = createNavigationHandlers(this.vfs)
    for (const [name, handler] of Object.entries(navHandlers)) {
      this.handlers[name] = handler
    }

    // ── Write handlers ────────────────────────────────────────────────────────
    // Each factory receives only the VFS instance; handlers read vfs.projectId
    // at call time so they always target the correct project after a cd switch.
    const taskHandlers    = createTaskWriteHandlers(this.vfs)
    const sprintHandlers  = createSprintWriteHandlers(this.vfs)
    const memberHandlers  = createMemberWriteHandlers(this.vfs)
    const msgHandlers     = createMessageWriteHandlers(this.vfs)
    const schedHandlers   = createScheduleWriteHandlers(this.vfs)
    const logHandlers     = createTimeLogWriteHandlers(this.vfs)
    const ghHandlers      = createGithubHandlers(this.vfs)
    const projHandlers    = createProjectWriteHandlers(this.vfs)
    const profileHandlers = createProfileWriteHandlers(this.vfs, this.navigate)
    const adminHandlers   = createAdminHandlers(this.vfs)
    const autoHandlers    = createAutomationHandlers(this.vfs)

    // Register all flat write handlers
    for (const handlers of [
      taskHandlers,
      sprintHandlers,
      memberHandlers,
      msgHandlers,
      schedHandlers,
      logHandlers,
      ghHandlers,
      projHandlers,
      profileHandlers,
      adminHandlers,
      autoHandlers,
    ]) {
      for (const [name, handler] of Object.entries(handlers)) {
        this.handlers[name] = handler
      }
    }
    // ── Dispatch: touch ───────────────────────────────────────────────────────
    // "touch tasks/todo/name.json"  → touch-task
    // "touch sprints/name.json"     → touch-sprint
    // "touch schedules/name.json"   → touch-schedule
    // "touch project ..."           → touch-project
    this.handlers['touch'] = async (parsed, context): Promise<CommandResult> => {
      const rawArg = parsed.args[0] ?? ''

      if (!rawArg) {
        return {
          lines: [
            { type: 'stderr', content: 'touch: missing operand.' },
            { type: 'system', content: '  touch tasks/<status>/<name>.json --assignee=<email|everyone> --deadline="YYYY-MM-DDTHH:MM" [--priority=MEDIUM]' },
            { type: 'system', content: '  touch sprints/<name>.json [--goal="..."]' },
            { type: 'system', content: '  touch schedules/<name>.json --at=<ISO>' },
            { type: 'system', content: '  touch project <name>' },
            { type: 'system', content: '' },
            { type: 'system', content: '  Type "help touch" for full details.' },
          ],
        }
      }

      // BUG-05 fix: use resolved absolute path for routing — do NOT lowercase
      // the raw arg since path parts like status slugs are case-sensitive.
      const argLower = rawArg.toLowerCase()
      const resolved = this.vfs.resolve(rawArg)

      if (resolved.startsWith('/tasks/') || argLower.startsWith('tasks/')) {
        return this.handlers['touch-task'](parsed, context)
      }
      if (resolved.startsWith('/sprints/') || argLower.startsWith('sprints/')) {
        return this.handlers['touch-sprint'](parsed, context)
      }
      if (resolved.startsWith('/schedules/') || argLower.startsWith('schedules/')) {
        return this.handlers['touch-schedule'](parsed, context)
      }
      if (argLower === 'project') {
        // Shift arg: "touch project My Name" → args becomes ["My Name"]
        const shifted: ParsedCommand = { ...parsed, args: parsed.args.slice(1) }
        return this.handlers['touch-project'](shifted, context)
      }
      if (
        resolved.startsWith('/profile/files/') ||
        argLower.startsWith('profile/files/')
      ) {
        return { lines: [{ type: 'stderr', content: `touch: cannot create '${rawArg}': use 'mkdir' to create profile folders.` }] }
      }

      return {
        lines: [
          { type: 'stderr', content: `touch: cannot create '${rawArg}': unsupported path.` },
          { type: 'system', content: '  Supported: tasks/<status>/..., sprints/..., schedules/..., project <name>' },
        ],
      }
    }

    // ── Dispatch: mkdir ───────────────────────────────────────────────────────
    // "mkdir profile/files/..."     → mkdir-profile-file
    this.handlers['mkdir'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      
      if (!path) {
        return { lines: [{ type: 'stderr', content: 'mkdir: missing operand.' }] }
      }

      const resolved = this.vfs.resolve(path)
      
      if (resolved.startsWith('/profile/files/')) {
        return this.handlers['mkdir-profile-file'](parsed, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `mkdir: cannot create '${parsed.args[0]}': unsupported path.` },
          { type: 'system', content: '  Supported: profile/files/<folder>' },
        ],
      }
    }

    // ── Dispatch: rm ──────────────────────────────────────────────────────────
    // "rm tasks/..."     → rm-task
    // "rm sprints/..."   → rm-sprint
    // "rm members/..."   → rm-member
    this.handlers['rm'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)

      if (!path) {
        return { lines: [{ type: 'stderr', content: 'rm: missing operand.' }] }
      }

      if (resolved.startsWith('/tasks/')) {
        return this.handlers['rm-task'](parsed, context)
      }
      if (resolved.startsWith('/sprints/')) {
        return this.handlers['rm-sprint'](parsed, context)
      }
      if (resolved.startsWith('/members/')) {
        return this.handlers['rm-member'](parsed, context)
      }
      if (resolved.startsWith('/automations/')) {
        return this.handlers['rm-automation'](parsed, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `rm: cannot remove '${path}': unsupported path.` },
          { type: 'system', content: '  Supported: tasks/..., sprints/..., members/..., automations/...' },
        ],
      }
    }

    // ── Dispatch: mv ──────────────────────────────────────────────────────────
    // "mv tasks/..." → mv-task
    this.handlers['mv'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)

      if (!path) {
        return { lines: [{ type: 'stderr', content: 'mv: missing operand.' }] }
      }

      if (resolved.startsWith('/tasks/')) {
        return this.handlers['mv-task'](parsed, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `mv: cannot move '${path}': unsupported. Only tasks are moveable via CLI.` },
        ],
      }
    }

    // ── Dispatch: edit ────────────────────────────────────────────────────────────
    // "edit tasks/..." → edit-task
    this.handlers['edit'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)

      if (!path) {
        return { lines: [{ type: 'stderr', content: 'edit: missing operand.' }] }
      }

      if (resolved.startsWith('/tasks/')) {
        return this.handlers['edit-task'](parsed, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `edit: cannot edit '${path}'. Supported: tasks/<status>/...` },
        ],
      }
    }

    // ── Dispatch: toggle ───────────────────────────────────────────────────────────
    // "toggle automations/..." → toggle-automation
    this.handlers['toggle'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)

      if (!path) {
        return { lines: [{ type: 'stderr', content: 'toggle: missing operand.' }] }
      }

      if (resolved.startsWith('/automations/')) {
        return this.handlers['toggle-automation'](parsed, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `toggle: cannot toggle '${path}'. Supported: automations/<name>` },
        ],
      }
    }

    // ── Aliases ─────────────────────────────────────────────────────────────────────────────
    // BUG-06 fix: use vfs.resolve() so relative filenames work when cwd is
    // already inside /sprints (user types: start my-sprint__abc.json)
    this.handlers['start'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)
      if (resolved.startsWith('/sprints/')) return this.handlers['start-sprint'](parsed, context)
      return { lines: [{ type: 'stderr', content: `start: unknown target. Did you mean: start sprints/<file>.json` }] }
    }

    this.handlers['close'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      const resolved = this.vfs.resolve(path)
      if (resolved.startsWith('/sprints/')) return this.handlers['close-sprint'](parsed, context)
      return { lines: [{ type: 'stderr', content: `close: unknown target. Did you mean: close sprints/<file>.json` }] }
    }

    // ── upload ────────────────────────────────────────────────────────────────
    // "upload"                → upload to personal profile files
    // "upload profile/files" → upload to personal profile files
    // "upload projects/..."  → upload to current project files
    this.handlers['upload'] = async (parsed, context): Promise<CommandResult> => {
      return this.handlers['upload-file'](parsed, context)
    }

    // ── open ─────────────────────────────────────────────────────────────────
    // "open profile"          → navigate to /profile
    // "open profile/settings" → navigate to /settings
    // "open change-password"  → navigate to /change-password
    // "open activity"         → navigate to /activity
    this.handlers['open'] = async (parsed, context): Promise<CommandResult> => {
      return this.handlers['open-route'](parsed, context)
    }
  }

  /**
   * Execute a parsed command with the given context.
   */
  async execute(parsed: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    const { command } = parsed

    if (!command) return { lines: [] }

    const handler = this.handlers[command]

    if (!handler) {
      return {
        lines: [
          {
            type: 'stderr',
            content: `vfs: command not found: ${command}. Type "help" for available commands.`,
          },
        ],
      }
    }

    try {
      return await handler(parsed, context)
    } catch (err: any) {
      return {
        lines: [
          { type: 'stderr', content: `${command}: unexpected error — ${err?.message ?? String(err)}` },
        ],
      }
    }
  }

  get vfsInstance(): VirtualFileSystem {
    return this.vfs
  }
}
