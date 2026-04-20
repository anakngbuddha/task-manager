/**
 * useTerminalHook — the master React hook that ties the VFS together.
 *
 * Manages:
 *   - Output line history (shared with TerminalContext so it survives mode changes)
 *   - Command history (↑/↓ navigation)
 *   - VirtualFileSystem + CommandRegistry instances (stable refs)
 *   - Async command execution with loading state
 *   - Welcome banner on first mount
 *   - **Active project tracking** — the terminal has its own notion of
 *     "current project" which can differ from the URL route (e.g. after
 *     `cd test` from `/projects`). Props only seed the initial value;
 *     project switches via `cd` are managed internally.
 *
 * When `externalLines` + `onLinesChange` are provided, the hook uses the
 * external state (from TerminalContext) instead of its own — this means
 * history survives floating ↔ pinned ↔ minimized transitions.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { VirtualFileSystem } from '@/lib/vfs/VirtualFileSystem'
import { CommandRegistry, BANNER } from '@/lib/vfs/commandRegistry'
import { parseCommand } from '@/lib/vfs/parser'
import type { OutputLine } from '@/components/terminal/TerminalOutput'
import type { CommandContext } from '@/lib/vfs/commandTypes'

// BUG-08 fix: crypto.randomUUID() is used instead of a module-global counter
// to prevent duplicate IDs across concurrent terminal instances and after HMR.
function nextId() {
  return `line-${crypto.randomUUID()}`
}

interface UseTerminalOptions {
  projectId: string
  projectName: string
  userRole?: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null
  user?: { id: string; name?: string | null; email?: string | null } | null
  /** When provided, the hook reads/writes lines via these instead of local state */
  externalLines?: OutputLine[]
  onLinesChange?: React.Dispatch<React.SetStateAction<OutputLine[]>>
  /** Called when a cd into a project switches the active project context */
  onProjectSwitch?: (id: string, name: string, role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null) => void
}

interface UseTerminalReturn {
  outputLines: OutputLine[]
  cwd: string
  isLoading: boolean
  execute: (input: string) => Promise<void>
  historyUp: () => string | undefined
  historyDown: () => string | undefined
  /** The terminal's active project name (may differ from the prop after a cd switch) */
  activeProjectName: string
}

export function useTerminalHook({
  projectId,
  projectName,
  userRole = null,
  user: userProp,
  externalLines,
  onLinesChange,
  onProjectSwitch,
}: UseTerminalOptions): UseTerminalReturn {
  const { data: session } = useSession()
  // BUG-10 fix: obtain the SPA navigate function so 'open' avoids page reloads
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Internal active project state ──────────────────────────────────────
  // These start from props but become independent after a terminal `cd` switch.
  const [activeProjectId, setActiveProjectId] = useState(projectId)
  const [activeProjectName, setActiveProjectName] = useState(projectName)
  const [activeUserRole, setActiveUserRole] = useState(userRole)

  // Track prop changes: only sync from props when the ROUTE actually changes
  // (i.e. user navigates to a different project page via UI).
  const prevPropProjectIdRef = useRef(projectId)
  useEffect(() => {
    if (prevPropProjectIdRef.current !== projectId) {
      prevPropProjectIdRef.current = projectId
      setActiveProjectId(projectId)
      setActiveProjectName(projectName)
      setActiveUserRole(userRole)
    }
  }, [projectId, projectName, userRole])

  // Sync userRole when it loads asynchronously (members data arrives later)
  // but only if we're still on the same route project (no terminal override).
  const prevPropRoleRef = useRef(userRole)
  useEffect(() => {
    if (prevPropRoleRef.current !== userRole && activeProjectId === projectId) {
      prevPropRoleRef.current = userRole
      setActiveUserRole(userRole)
    }
  }, [userRole, activeProjectId, projectId])

  // ── Stable VFS + Registry refs ─────────────────────────────────────────
  const vfsRef = useRef<VirtualFileSystem | null>(null)
  const registryRef = useRef<CommandRegistry | null>(null)

  // Initialize only on first mount — never during a render cycle.
  // BUG-01 fix: constructing during render caused cwd resets on any re-render
  // that temporarily changed activeProjectId (e.g. async role loading).
  if (!vfsRef.current) {
    vfsRef.current = new VirtualFileSystem(activeProjectId)
    registryRef.current = new CommandRegistry(vfsRef.current, navigate)
  }

  // When the user navigates to a different project page via the URL (not via
  // the terminal `cd` command — that mutates vfs.projectId directly), recreate
  // the VFS so the directory resets to "/". This runs after paint so there is
  // no risk of mid-render side-effects.
  useEffect(() => {
    if (vfsRef.current && vfsRef.current.projectId !== activeProjectId) {
      vfsRef.current = new VirtualFileSystem(activeProjectId)
      registryRef.current = new CommandRegistry(vfsRef.current, navigate)
      setCwd('/')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  // Local output state (used when no external state provided)
  const [localLines, setLocalLines] = useState<OutputLine[]>([])
  const [cwd, setCwd] = useState('/')
  const [isLoading, setIsLoading] = useState(false)

  const outputLines = externalLines ?? localLines
  const setOutputLines = onLinesChange ?? setLocalLines

  // Command history
  const historyRef = useRef<string[]>([])
  const historyPosRef = useRef(-1)

  // Print welcome banner on first mount (only if lines are empty)
  useEffect(() => {
    if (outputLines.length > 0) return // already has content, don't re-banner

    const bannerLines: OutputLine[] = BANNER.split('\n').map((content) => ({
      id: nextId(),
      type: 'banner' as const,
      content,
    }))
    const systemLine: OutputLine = {
      id: nextId(),
      type: 'system',
      content: `Project: ${activeProjectName} | Role: ${activeUserRole ?? 'MEMBER'}`,
    }
    const empty: OutputLine = { id: nextId(), type: 'empty', content: '' }
    setOutputLines([...bannerLines, systemLine, empty])
    setCwd('/')
    if (vfsRef.current) {
      vfsRef.current['_cwd'] = '/'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  // Build context — uses the terminal's INTERNAL active values
  const buildContext = useCallback((): CommandContext => {
    const resolvedUser = userProp ?? (session?.user
      ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
      : null)
    return {
      projectId: activeProjectId,
      projectName: activeProjectName,
      userRole: activeUserRole ?? null,
      user: resolvedUser,
    }
  }, [activeProjectId, activeProjectName, activeUserRole, session, userProp])

  // Execute a command
  const execute = useCallback(async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return

    historyRef.current = [trimmed, ...historyRef.current.slice(0, 49)]
    historyPosRef.current = -1

    const registry = registryRef.current!
    const vfs = vfsRef.current!

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

      if (result.newCwd !== undefined) setCwd(result.newCwd)

      // ── Project switch (cd into /projects/<name>) ────────────────────
      if (result.newProjectId && result.newProjectName) {
        // Update the terminal's internal state — this is the KEY line.
        // It ensures the VFS check on next render sees matching IDs
        // and doesn't recreate the VFS instance.
        setActiveProjectId(result.newProjectId)
        setActiveProjectName(result.newProjectName)
        if (result.newUserRole !== undefined) {
          setActiveUserRole(result.newUserRole)
        }
        // Notify parent for title bar / external UI updates
        onProjectSwitch?.(result.newProjectId, result.newProjectName, result.newUserRole ?? null)
      }

      // ── API Realtime sync (React Query Invalidation) ──────────
      if (result.invalidations?.length) {
        result.invalidations.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }

      const newLines: OutputLine[] = result.lines.map((spec) => ({
        id: nextId(),
        type: spec.type,
        content: spec.content,
      }))

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
  }, [buildContext, setOutputLines, onProjectSwitch])

  // History navigation
  const historyUp = useCallback((): string | undefined => {
    const hist = historyRef.current
    if (hist.length === 0) return undefined
    const newPos = Math.min(historyPosRef.current + 1, hist.length - 1)
    historyPosRef.current = newPos
    return hist[newPos]
  }, [])

  const historyDown = useCallback((): string | undefined => {
    const hist = historyRef.current
    if (historyPosRef.current <= 0) { historyPosRef.current = -1; return '' }
    const newPos = historyPosRef.current - 1
    historyPosRef.current = newPos
    return hist[newPos]
  }, [])

  return { outputLines, cwd, isLoading, execute, historyUp, historyDown, activeProjectName }
}

// Keep old export name for backward compat (DashboardTerminal still uses useTerminal)
export { useTerminalHook as useTerminal }
