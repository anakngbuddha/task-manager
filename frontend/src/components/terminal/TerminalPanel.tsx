import { useCallback, useEffect, useRef, useState } from 'react'
import './terminal.css'
import TerminalOutput from './TerminalOutput'
import TerminalInput from './TerminalInput'
import { useTerminal } from '@/hooks/useTerminal'
import type { CommandContext } from '@/lib/vfs/commandTypes'

interface TerminalPanelProps {
  projectId: string
  projectName: string
  userRole?: CommandContext['userRole']
  user?: { id: string; name?: string | null; email?: string | null } | null
  storageKey?: string
  onClose: () => void
}

const DEFAULT_STORAGE_KEY = 'vfs-terminal-geometry'

interface TerminalGeometry {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_GEOMETRY: TerminalGeometry = {
  x: 0, // computed on mount to center
  y: 0,
  width: 720,
  height: 420,
}

/** Returns geometry from localStorage or the default. x/y=0 means "center on mount". */
function loadGeometry(key: string): TerminalGeometry {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as TerminalGeometry
  } catch {
    // ignore
  }
  return DEFAULT_GEOMETRY
}

function saveGeometry(key: string, g: TerminalGeometry) {
  try {
    localStorage.setItem(key, JSON.stringify(g))
  } catch {
    // ignore
  }
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null

export function TerminalPanel({ projectId, projectName, userRole, user, storageKey = DEFAULT_STORAGE_KEY, onClose }: TerminalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const geoKey = storageKey

  // ----- geometry state -----
  const [geo, setGeo] = useState<TerminalGeometry>(() => {
    const saved = loadGeometry(geoKey)
    return saved
  })

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

  // Persist geometry whenever it changes
  useEffect(() => {
    saveGeometry(geoKey, geo)
  }, [geoKey, geo])

  // ----- drag logic -----
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from the title bar and only with left mouse button
    if (e.button !== 0) return
    e.preventDefault()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: geo.x,
      originY: geo.y,
    }
  }, [geo])

  // ----- resize logic -----
  const resizeState = useRef<{
    edge: ResizeEdge
    startX: number
    startY: number
    originX: number
    originY: number
    originW: number
    originH: number
  } | null>(null)

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, edge: ResizeEdge) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      resizeState.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        originX: geo.x,
        originY: geo.y,
        originW: geo.width,
        originH: geo.height,
      }
    },
    [geo]
  )

  // Global mouse move / up handlers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // ---- Drag ----
      if (dragState.current) {
        const dx = e.clientX - dragState.current.startX
        const dy = e.clientY - dragState.current.startY
        const newX = Math.max(0, Math.min(window.innerWidth - geo.width, dragState.current.originX + dx))
        const newY = Math.max(0, Math.min(window.innerHeight - 60, dragState.current.originY + dy))
        setGeo((prev) => ({ ...prev, x: newX, y: newY }))
        return
      }

      // ---- Resize ----
      if (resizeState.current) {
        const { edge, startX, startY, originX, originY, originW, originH } = resizeState.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const minW = 360
        const minH = 200

        let x = originX
        let y = originY
        let width = originW
        let height = originH

        if (edge?.includes('e')) width = Math.max(minW, originW + dx)
        if (edge?.includes('s')) height = Math.max(minH, originH + dy)
        if (edge?.includes('w')) {
          const newW = Math.max(minW, originW - dx)
          x = originX + originW - newW
          width = newW
        }
        if (edge?.includes('n')) {
          const newH = Math.max(minH, originH - dy)
          y = originY + originH - newH
          height = newH
        }

        setGeo({ x, y, width, height })
      }
    }

    const onMouseUp = () => {
      dragState.current = null
      resizeState.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // geo.width/height needed for drag boundary calc
  }, [geo.width, geo.height])

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // ----- terminal logic -----
  const { outputLines, execute, historyUp, historyDown, cwd, isLoading } = useTerminal({
    projectId,
    projectName,
    userRole,
    user,
  })

  return (
    <div
      ref={panelRef}
      className="term-overlay"
      style={{
        left: geo.x,
        top: geo.y,
        width: geo.width,
        height: geo.height,
      }}
      role="dialog"
      aria-modal="false"
      aria-label="Virtual File System Terminal"
    >
      {/* ── Resize handles ── */}
      {(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as ResizeEdge[]).map((edge) => (
        <div
          key={edge}
          className={`term-resize-handle term-resize-${edge}`}
          onMouseDown={(e) => onResizeMouseDown(e, edge)}
        />
      ))}

      {/* ── Title bar ── */}
      <div className="term-titlebar" onMouseDown={onDragMouseDown}>
        <div className="term-traffic-lights" onMouseDown={(e) => e.stopPropagation()}>
          <div
            className="term-dot term-dot-red"
            onClick={onClose}
            title="Close terminal"
            role="button"
            aria-label="Close terminal"
          />
          <div className="term-dot term-dot-yellow" title="Minimise (not supported)" />
          <div className="term-dot term-dot-green" title="Maximize (not supported)" />
        </div>
        <span className="term-title">
          vfs — {projectName} — {cwd}
        </span>
        <span className="term-badge">VFS</span>
      </div>

      {/* ── Output ── */}
      <TerminalOutput lines={outputLines} />

      {/* ── Input ── */}
      <TerminalInput
        cwd={cwd}
        projectName={projectName}
        onSubmit={execute}
        historyUp={historyUp}
        historyDown={historyDown}
        disabled={isLoading}
      />
    </div>
  )
}
