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
  private projectId: string

  constructor(vfs: VirtualFileSystem, projectId: string) {
    this.vfs = vfs
    this.projectId = projectId
    this._register()
  }

  private _register() {
    // ── Read / navigation handlers ───────────────────────────────────────────
    const navHandlers = createNavigationHandlers(this.vfs)
    for (const [name, handler] of Object.entries(navHandlers)) {
      this.handlers[name] = handler
    }

    // ── Write handlers ────────────────────────────────────────────────────────
    const taskHandlers   = createTaskWriteHandlers(this.vfs, this.projectId)
    const sprintHandlers = createSprintWriteHandlers(this.vfs, this.projectId)
    const memberHandlers = createMemberWriteHandlers(this.vfs, this.projectId)
    const msgHandlers    = createMessageWriteHandlers(this.projectId)
    const schedHandlers  = createScheduleWriteHandlers(this.projectId)
    const logHandlers    = createTimeLogWriteHandlers(this.vfs, this.projectId)
    const ghHandlers     = createGithubHandlers(this.projectId)
    const projHandlers   = createProjectWriteHandlers(this.projectId)

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
      const path = parsed.args[0]?.toLowerCase() ?? ''

      if (!path) {
        return {
          lines: [
            { type: 'stderr', content: 'touch: missing operand.' },
            { type: 'system', content: '  touch tasks/<status>/<name>.json --priority=HIGH' },
            { type: 'system', content: '  touch sprints/<name>.json [--goal="..."]' },
            { type: 'system', content: '  touch schedules/<name>.json --at=<ISO>' },
            { type: 'system', content: '  touch project <name>' },
          ],
        }
      }

      if (path.startsWith('tasks/') || this.vfs.resolve(path).startsWith('/tasks/')) {
        return this.handlers['touch-task'](parsed, context)
      }
      if (path.startsWith('sprints/') || path === 'sprints') {
        return this.handlers['touch-sprint'](parsed, context)
      }
      if (path.startsWith('schedules/') || path === 'schedules') {
        return this.handlers['touch-schedule'](parsed, context)
      }
      if (path === 'project' || path.startsWith('project ')) {
        // Shift arg: "touch project My Name" → args becomes ["My Name"]
        const shifted: ParsedCommand = { ...parsed, args: parsed.args.slice(1) }
        return this.handlers['touch-project'](shifted, context)
      }

      return {
        lines: [
          { type: 'stderr', content: `touch: cannot create '${parsed.args[0]}': unsupported path.` },
          { type: 'system', content: '  Supported: tasks/<status>/..., sprints/..., schedules/..., project <name>' },
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

      return {
        lines: [
          { type: 'stderr', content: `rm: cannot remove '${path}': unsupported path.` },
          { type: 'system', content: '  Supported: tasks/..., sprints/..., members/...' },
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

    // ── Aliases ────────────────────────────────────────────────────────────────
    this.handlers['start'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      if (path.startsWith('sprints/')) return this.handlers['start-sprint'](parsed, context)
      return { lines: [{ type: 'stderr', content: `start: unknown target. Did you mean: start sprints/<name>.json` }] }
    }

    this.handlers['close'] = async (parsed, context): Promise<CommandResult> => {
      const path = parsed.args[0] ?? ''
      if (path.startsWith('sprints/')) return this.handlers['close-sprint'](parsed, context)
      return { lines: [{ type: 'stderr', content: `close: unknown target. Did you mean: close sprints/<name>.json` }] }
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
