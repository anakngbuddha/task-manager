import type { OutputLineType } from '@/components/terminal/TerminalOutput'

/** Used by command handlers to specify output without needing React ids */
export interface OutputLineSpec {
  type: OutputLineType
  content: string
}

export interface ParsedCommand {
  command: string
  /** Positional arguments (non-flag tokens) */
  args: string[]
  /** Flags like --key=value or --flag (boolean) */
  flags: Record<string, string | true>
  /** Raw original input */
  raw: string
}

export interface CommandContext {
  projectId: string
  projectName: string
  /** The caller's effective role within this project */
  userRole: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null
  /** The logged-in user info */
  user: { id: string; name?: string | null; email?: string | null } | null
}

export type CommandHandler = (
  parsed: ParsedCommand,
  context: CommandContext
) => Promise<CommandResult>

export interface CommandResult {
  lines: OutputLineSpec[]
  newCwd?: string
  clear?: boolean
  /** When set, the terminal should switch its active project context */
  newProjectId?: string
  newProjectName?: string
  newUserRole?: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null
  /** React Query keys to invalidate after this command runs */
  invalidations?: any[][]
}
