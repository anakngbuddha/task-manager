import { useCallback, useEffect, useRef, useState } from 'react'
import './terminal.css'
import TerminalOutput from './TerminalOutput'
import TerminalInput from './TerminalInput'
import { useTerminalHook } from '@/hooks/useTerminal'
import { useTerminalContext } from '@/contexts/TerminalContext'
import type { CommandContext } from '@/lib/vfs/commandTypes'

interface TerminalPanelProps {
  projectId: string
  projectName: string
  userRole?: CommandContext['userRole']
  user?: { id: string; name?: string | null; email?: string | null } | null
}

const STORAGE_KEY = 'vfs-terminal-geometry'

interface TerminalGeometry {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_GEOMETRY: TerminalGeometry = {
  x: 0,
  y: 0,
  width: 720,
  height: 420,
}

const PINNED_HEIGHT_KEY = 'vfs-terminal-pinned-height'
const DEFAULT_PINNED_HEIGHT = 320

function loadGeometry(): TerminalGeometry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as TerminalGeometry
  } catch { /* ignore */ }
  return DEFAULT_GEOMETRY
}

function saveGeometry(g: TerminalGeometry) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(g)) } catch { /* ignore */ }
}

type FloatResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null

export function TerminalPanel({ projectId, projectName, userRole, user }: TerminalPanelProps) {
  const { mode, minimize, close, setMode, setOutputLines, outputLines: ctxLines, setProjectContext } = useTerminalContext()
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Floating geometry ──
  const [geo, setGeo] = useState<TerminalGeometry>(() => loadGeometry())

  // Called when the user does "cd <project>" from /projects
  const handleProjectSwitch = useCallback((id: string, name: string, role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null) => {
    setProjectContext(id, name, role)
  }, [setProjectContext])

  // Center on first mount if x/y are 0
  useEffect(() => {
    if (geo.x === 0 && geo.y === 0) {
      setGeo((prev) => ({
        ...prev,
        x: Math.max(0, (window.innerWidth - prev.width) / 2),
        y: Math.max(0, (window.innerHeight - prev.height) / 2),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { saveGeometry(geo) }, [geo])

  // ── Pinned height ──
  const [pinnedHeight, setPinnedHeight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PINNED_HEIGHT_KEY)
      return raw ? Number(raw) : DEFAULT_PINNED_HEIGHT
    } catch { return DEFAULT_PINNED_HEIGHT }
  })

  useEffect(() => {
    try { localStorage.setItem(PINNED_HEIGHT_KEY, String(pinnedHeight)) } catch { /* ignore */ }
  }, [pinnedHeight])

  // ── Terminal logic ──
  const { outputLines, execute, historyUp, historyDown, cwd, isLoading, activeProjectName } = useTerminalHook({
    projectId,
    projectName,
    userRole,
    user,
    externalLines: ctxLines,
    onLinesChange: setOutputLines,
    onProjectSwitch: handleProjectSwitch,
  })

  // ── Drag (floating only) ──
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'floating') return
    if (e.button !== 0) return
    e.preventDefault()
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: geo.x, originY: geo.y }
  }, [mode, geo.x, geo.y])

  // ── Resize (floating — all edges; pinned — top edge only) ──
  const floatResizeState = useRef<{
    edge: FloatResizeEdge
    startX: number; startY: number
    originX: number; originY: number
    originW: number; originH: number
  } | null>(null)

  const onFloatResizeDown = useCallback((e: React.MouseEvent, edge: FloatResizeEdge) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    floatResizeState.current = {
      edge, startX: e.clientX, startY: e.clientY,
      originX: geo.x, originY: geo.y, originW: geo.width, originH: geo.height,
    }
  }, [geo])

  const pinnedResizeState = useRef<{ startY: number; originH: number } | null>(null)

  const onPinnedResizeDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    pinnedResizeState.current = { startY: e.clientY, originH: pinnedHeight }
  }, [pinnedHeight])

  // ── Global mouse handlers ──
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // Drag (floating)
      if (dragState.current) {
        const dx = e.clientX - dragState.current.startX
        const dy = e.clientY - dragState.current.startY
        const newX = Math.max(0, Math.min(window.innerWidth - geo.width, dragState.current.originX + dx))
        const newY = Math.max(0, Math.min(window.innerHeight - 60, dragState.current.originY + dy))
        setGeo((prev) => ({ ...prev, x: newX, y: newY }))
        return
      }

      // Float resize
      if (floatResizeState.current) {
        const { edge, startX, startY, originX, originY, originW, originH } = floatResizeState.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const minW = 360; const minH = 200
        let x = originX, y = originY, width = originW, height = originH
        if (edge?.includes('e')) width  = Math.max(minW, originW + dx)
        if (edge?.includes('s')) height = Math.max(minH, originH + dy)
        if (edge?.includes('w')) { const nW = Math.max(minW, originW - dx); x = originX + originW - nW; width = nW }
        if (edge?.includes('n')) { const nH = Math.max(minH, originH - dy); y = originY + originH - nH; height = nH }
        setGeo({ x, y, width, height })
        return
      }

      // Pinned resize (drag top edge upward to expand)
      if (pinnedResizeState.current) {
        const dy = pinnedResizeState.current.startY - e.clientY
        const newH = Math.max(120, Math.min(window.innerHeight * 0.9, pinnedResizeState.current.originH + dy))
        setPinnedHeight(newH)
      }
    }

    const onMouseUp = () => {
      dragState.current = null
      floatResizeState.current = null
      pinnedResizeState.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  // BUG-22 fix: added geo.x and geo.y to deps so drag logic never sees stale origins
  }, [geo.width, geo.height, geo.x, geo.y])

  const isPinned = mode === 'pinned'

  useEffect(() => {
    const root = document.documentElement
    if (isPinned) {
      root.style.setProperty('--terminal-pinned-height', `${pinnedHeight}px`)
    } else {
      root.style.setProperty('--terminal-pinned-height', '0px')
    }
    return () => {
      root.style.removeProperty('--terminal-pinned-height')
    }
  }, [isPinned, pinnedHeight])

  // ── Shared content ──
  const titleBarContent = (
    <div className="term-titlebar" onMouseDown={isPinned ? undefined : onDragMouseDown}>
      {/* Traffic lights */}
      <div className="term-traffic-lights" onMouseDown={(e) => e.stopPropagation()}>
        {/* Red — Close (clears history) */}
        <div
          className="term-dot term-dot-red"
          onClick={close}
          title="Close terminal (clears history)"
          role="button"
          aria-label="Close terminal"
        />
        {/* Yellow — Minimize */}
        <div
          className="term-dot term-dot-yellow"
          onClick={minimize}
          title="Minimize terminal"
          role="button"
          aria-label="Minimize terminal"
        />
        {/* Green — Toggle floating/pinned */}
        <div
          className="term-dot term-dot-green"
          onClick={() => setMode(isPinned ? 'floating' : 'pinned')}
          title={isPinned ? 'Switch to floating mode' : 'Pin to bottom (VS Code style)'}
          role="button"
          aria-label={isPinned ? 'Float terminal' : 'Pin terminal to bottom'}
        />
      </div>

      <span className="term-title">
        {isPinned ? '📌 ' : ''}vfs — {activeProjectName} — {cwd}
      </span>

      {/* Mode toggle text button */}
      <button
        className={`term-mode-btn${isPinned ? ' term-mode-btn--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setMode(isPinned ? 'floating' : 'pinned') }}
        title={isPinned ? 'Unpin — switch to floating' : 'Pin to bottom (VS Code)'}
        aria-label="Toggle pin mode"
      >
        {isPinned ? '⊟' : '⊞'}
      </button>

      <span className="term-badge">VFS</span>
    </div>
  )

  // ── PINNED render ──
  if (isPinned) {
    return (
      <div
        ref={panelRef}
        className="term-overlay term-overlay--pinned"
        style={{ height: pinnedHeight }}
        role="dialog"
        aria-modal="false"
        aria-label="VFS Terminal (pinned)"
      >
        {/* Top-edge resize handle */}
        <div
          className="term-resize-handle-pinned-top"
          onMouseDown={onPinnedResizeDown}
        />
        {titleBarContent}
        <TerminalOutput lines={outputLines} />
        <TerminalInput
          cwd={cwd}
          projectName={activeProjectName}
          onSubmit={execute}
          historyUp={historyUp}
          historyDown={historyDown}
          disabled={isLoading}
        />
      </div>
    )
  }

  // ── FLOATING render ──
  return (
    <div
      ref={panelRef}
      className="term-overlay"
      style={{ left: geo.x, top: geo.y, width: geo.width, height: geo.height }}
      role="dialog"
      aria-modal="false"
      aria-label="VFS Terminal (floating)"
    >
      {/* Resize handles */}
      {(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as FloatResizeEdge[]).map((edge) => (
        <div
          key={edge}
          className={`term-resize-handle term-resize-${edge}`}
          onMouseDown={(e) => onFloatResizeDown(e, edge)}
        />
      ))}
      {titleBarContent}
      <TerminalOutput lines={outputLines} />
      <TerminalInput
        cwd={cwd}
        projectName={activeProjectName}
        onSubmit={execute}
        historyUp={historyUp}
        historyDown={historyDown}
        disabled={isLoading}
      />
    </div>
  )
}
