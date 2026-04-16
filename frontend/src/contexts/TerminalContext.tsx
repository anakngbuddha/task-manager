/**
 * TerminalContext — global state for the VS Code-style terminal.
 *
 * Modes:
 *  'closed'    — not visible, history is cleared when transitioning here
 *  'floating'  — draggable/resizable overlay (free-form)
 *  'pinned'    — docked to the bottom of the viewport (VS Code style)
 *  'minimized' — just a slim title bar at the bottom, history preserved
 *
 * History (outputLines) survives minimize ↔ floating ↔ pinned transitions.
 * History is cleared ONLY when transitioning to 'closed'.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { OutputLine } from '@/components/terminal/TerminalOutput'

export type TerminalMode = 'closed' | 'floating' | 'pinned' | 'minimized'

interface TerminalContextValue {
  mode: TerminalMode
  /** The mode before minimizing — used to restore to floating or pinned */
  lastActiveMode: 'floating' | 'pinned'

  outputLines: OutputLine[]
  setOutputLines: React.Dispatch<React.SetStateAction<OutputLine[]>>

  /** Active project context passed from the current page */
  projectId: string
  projectName: string
  userRole: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null

  setProjectContext: (id: string, name: string, role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null) => void

  open: (preferMode?: 'floating' | 'pinned') => void
  minimize: () => void
  restore: () => void
  close: () => void   // clears history
  setMode: (mode: TerminalMode) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<TerminalMode>('closed')
  const [lastActiveMode, setLastActiveMode] = useState<'floating' | 'pinned'>('floating')
  const [outputLines, setOutputLines] = useState<OutputLine[]>([])
  const [projectId, setProjectId] = useState('__workspace__')
  const [projectName, setProjectName] = useState('Workspace')
  const [userRole, setUserRole] = useState<'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null>(null)

  const setMode = useCallback((m: TerminalMode) => {
    setModeRaw(m)
  }, [])

  const open = useCallback((preferMode: 'floating' | 'pinned' = 'floating') => {
    setModeRaw(preferMode)
    setLastActiveMode(preferMode)
  }, [])

  const minimize = useCallback(() => {
    setModeRaw((prev) => {
      if (prev === 'floating' || prev === 'pinned') {
        setLastActiveMode(prev)
      }
      return 'minimized'
    })
  }, [])

  const restore = useCallback(() => {
    setModeRaw(lastActiveMode)
  }, [lastActiveMode])

  const close = useCallback(() => {
    setOutputLines([])   // clear history on close
    setModeRaw('closed')
  }, [])

  const setProjectContext = useCallback(
    (id: string, name: string, role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null) => {
      setProjectId(id)
      setProjectName(name)
      setUserRole(role)
    },
    []
  )

  const value = useMemo<TerminalContextValue>(
    () => ({
      mode,
      lastActiveMode,
      outputLines,
      setOutputLines,
      projectId,
      projectName,
      userRole,
      setProjectContext,
      open,
      minimize,
      restore,
      close,
      setMode,
    }),
    [mode, lastActiveMode, outputLines, projectId, projectName, userRole, setProjectContext, open, minimize, restore, close, setMode]
  )

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
}

export function useTerminalContext() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error('useTerminalContext must be used within TerminalProvider')
  return ctx
}
