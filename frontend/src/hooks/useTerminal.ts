/**
 * useTerminal — the master React hook that ties the VFS together.
 *
 * Manages:
 *   - Output line history (what's shown in the terminal)
 *   - Command history (↑/↓ navigation)
 *   - VirtualFileSystem + CommandRegistry instances (stable refs)
 *   - Async command execution with loading state
 *   - Welcome banner on first mount
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { VirtualFileSystem } from '@/lib/vfs/VirtualFileSystem'
import { CommandRegistry, BANNER } from '@/lib/vfs/commandRegistry'
import { parseCommand } from '@/lib/vfs/parser'
import type { OutputLine } from '@/components/terminal/TerminalOutput'
import type { CommandContext } from '@/lib/vfs/commandTypes'

let _lineCounter = 0
function nextId() {
  return `line-${++_lineCounter}`
}

interface UseTerminalOptions {
  projectId: string
  projectName: string
  /** The effective role of the current user in this project */
  userRole?: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null
  /** Optionally pass user directly (used by DashboardTerminal) */
  user?: { id: string; name?: string | null; email?: string | null } | null
}

interface UseTerminalReturn {
  outputLines: OutputLine[]
  cwd: string
  isLoading: boolean
  execute: (input: string) => Promise<void>
  historyUp: () => string | undefined
  historyDown: () => string | undefined
}

export function useTerminal({
  projectId,
  projectName,
  userRole = null,
  user: userProp,
}: UseTerminalOptions): UseTerminalReturn {
  const { data: session } = useSession()

  // -- Stable VFS + Registry refs (recreated only if projectId changes) --
  const vfsRef = useRef<VirtualFileSystem | null>(null)
  const registryRef = useRef<CommandRegistry | null>(null)

  if (!vfsRef.current || vfsRef.current.projectId !== projectId) {
    vfsRef.current = new VirtualFileSystem(projectId)
    registryRef.current = new CommandRegistry(vfsRef.current, projectId)
  }

  // -- Output state --
  const [outputLines, setOutputLines] = useState<OutputLine[]>([])
  const [cwd, setCwd] = useState('/')
  const [isLoading, setIsLoading] = useState(false)

  // -- Command history --
  const historyRef = useRef<string[]>([])
  const historyPosRef = useRef(-1)

  // -- Print welcome banner on mount --
  useEffect(() => {
    const bannerLines: OutputLine[] = BANNER.split('\n').map((content) => ({
      id: nextId(),
      type: 'banner' as const,
      content,
    }))
    const systemLine: OutputLine = {
      id: nextId(),
      type: 'system',
      content: `Project: ${projectName} | Role: ${userRole ?? 'MEMBER'}`,
    }
    const empty: OutputLine = { id: nextId(), type: 'empty', content: '' }
    setOutputLines([...bannerLines, systemLine, empty])
    setCwd('/')
    if (vfsRef.current) {
      // Reset cwd on each open
      vfsRef.current['_cwd'] = '/'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // -- Build context --
  const buildContext = useCallback((): CommandContext => {
    const resolvedUser = userProp ?? (session?.user
      ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
      : null)
    return {
      projectId,
      projectName,
      userRole: userRole ?? null,
      user: resolvedUser,
    }
  }, [projectId, projectName, userRole, session, userProp])

  // -- Execute a command --
  const execute = useCallback(
    async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return

      // Add to history
      historyRef.current = [trimmed, ...historyRef.current.slice(0, 49)]
      historyPosRef.current = -1

      const registry = registryRef.current!
      const vfs = vfsRef.current!

      // Echo the command
      const echoLine: OutputLine = {
        id: nextId(),
        type: 'echo',
        content: `${vfs.cwd}$ ${trimmed}`,
      }

      setOutputLines((prev) => [...prev, echoLine])
      setIsLoading(true)

      try {
        const parsed = parseCommand(trimmed)
        const context = buildContext()
        const result = await registry.execute(parsed, context)

        if (result.clear) {
          setOutputLines([])
          setIsLoading(false)
          return
        }

        // Update cwd if command changed it
        if (result.newCwd !== undefined) {
          setCwd(result.newCwd)
        }

        // Convert OutputLineSpec → OutputLine (add ids)
        const newLines: OutputLine[] = result.lines.map((spec) => ({
          id: nextId(),
          type: spec.type,
          content: spec.content,
        }))

        // Add a blank line after each command for breathing room
        const separator: OutputLine = { id: nextId(), type: 'empty', content: '' }

        setOutputLines((prev) => [...prev, ...newLines, separator])
      } catch (err: any) {
        const errLine: OutputLine = {
          id: nextId(),
          type: 'stderr',
          content: `Error: ${err?.message ?? 'unknown error'}`,
        }
        setOutputLines((prev) => [...prev, errLine])
      } finally {
        setIsLoading(false)
      }
    },
    [buildContext]
  )

  // -- History navigation --
  const historyUp = useCallback((): string | undefined => {
    const hist = historyRef.current
    if (hist.length === 0) return undefined
    const newPos = Math.min(historyPosRef.current + 1, hist.length - 1)
    historyPosRef.current = newPos
    return hist[newPos]
  }, [])

  const historyDown = useCallback((): string | undefined => {
    const hist = historyRef.current
    if (historyPosRef.current <= 0) {
      historyPosRef.current = -1
      return ''
    }
    const newPos = historyPosRef.current - 1
    historyPosRef.current = newPos
    return hist[newPos]
  }, [])

  return {
    outputLines,
    cwd,
    isLoading,
    execute,
    historyUp,
    historyDown,
  }
}
