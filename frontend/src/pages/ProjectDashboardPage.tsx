import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDashboardLayout, useUpdateDashboardLayout, DASHBOARD_WIDGET_TYPES, type DashboardWidgetConfig, type DashboardWidgetType } from '@/hooks/useDashboardLayout'
import { GripVertical, Plus, Trash2 } from 'lucide-react'

import { TaskStatsWidget } from '@/components/dashboard/widgets/TaskStatsWidget'
import { RecentActivityWidget } from '@/components/dashboard/widgets/RecentActivityWidget'
import { WorkloadSummaryWidget } from '@/components/dashboard/widgets/WorkloadSummaryWidget'
import { TimeSummaryWidget } from '@/components/dashboard/widgets/TimeSummaryWidget'
import { VelocityChartWidget } from '@/components/dashboard/widgets/VelocityChartWidget'
import { BurndownChartWidget } from '@/components/dashboard/widgets/BurndownChartWidget'
import { WidgetTitle } from '@/components/dashboard/widgets/WidgetTitle'

const GRID_COLS = 2
const ROW_UNIT_PX = 140
const MAX_H = 8

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeWidget(w: DashboardWidgetConfig): DashboardWidgetConfig {
  const wClamped = clamp(w.size.w, 1, GRID_COLS)
  const xClamped = wClamped === GRID_COLS ? 0 : clamp(w.position.x, 0, GRID_COLS - 1)
  const yClamped = Math.max(0, w.position.y)
  const hClamped = clamp(w.size.h, 1, MAX_H)
  return {
    ...w,
    position: { x: xClamped, y: yClamped },
    size: { w: wClamped, h: hClamped },
  }
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function findFirstFreeSlot(widgets: DashboardWidgetConfig[], size: { w: number; h: number }) {
  const wClamped = clamp(size.w, 1, GRID_COLS)
  const maxY = 24

  for (let y = 0; y < maxY; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const normalizedX = wClamped === GRID_COLS ? 0 : x
      if (normalizedX + wClamped > GRID_COLS) continue
      const candidate = { x: normalizedX, y, w: wClamped, h: size.h }
      const collides = widgets.some((w) => rectsOverlap(candidate, { x: w.position.x, y: w.position.y, w: w.size.w, h: w.size.h }))
      if (!collides) return { x: normalizedX, y }
    }
  }

  // Fallback: place at the end.
  const lastY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.size.h), 0)
  return { x: wClamped === GRID_COLS ? 0 : 0, y: lastY + 1 }
}

function getDefaultWidgetSize(type: DashboardWidgetType) {
  switch (type) {
    case 'task_stats':
      return { w: 1, h: 3 }
    case 'recent_activity':
      return { w: 1, h: 3 }
    case 'workload_summary':
      return { w: 1, h: 3 }
    case 'time_summary':
      return { w: 1, h: 2 }
    case 'velocity_chart':
      return { w: 2, h: 3 }
    case 'burndown_chart':
      return { w: 2, h: 3 }
    default:
      return { w: 1, h: 2 }
  }
}

function widgetComponent(type: DashboardWidgetType) {
  switch (type) {
    case 'task_stats':
      return TaskStatsWidget
    case 'recent_activity':
      return RecentActivityWidget
    case 'workload_summary':
      return WorkloadSummaryWidget
    case 'time_summary':
      return TimeSummaryWidget
    case 'velocity_chart':
      return VelocityChartWidget
    case 'burndown_chart':
      return BurndownChartWidget
    default:
      return TaskStatsWidget
  }
}

export default function ProjectDashboardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const {
    data: layoutFromServer,
    isLoading: isLoadingLayout,
    error: layoutError,
  } = useDashboardLayout(projectId!)
  const updateLayout = useUpdateDashboardLayout(projectId!)

  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>([])
  const widgetsRef = useRef<DashboardWidgetConfig[]>([])

  const saveLayoutTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!layoutFromServer) return
    const next = layoutFromServer.map(normalizeWidget)
    setWidgets(next)
    widgetsRef.current = next
  }, [layoutFromServer])

  // If the layout API fails (e.g. table not migrated yet), still render a default layout locally.
  useEffect(() => {
    if (!layoutError) return
    if (widgetsRef.current.length > 0) return
    const fallback: DashboardWidgetConfig[] = ([
      {
        id: crypto.randomUUID(),
        type: 'task_stats' as const,
        position: { x: 0, y: 0 },
        size: { w: 1, h: 2 },
      },
      {
        id: crypto.randomUUID(),
        type: 'recent_activity' as const,
        position: { x: 1, y: 0 },
        size: { w: 1, h: 1 },
      },
      {
        id: crypto.randomUUID(),
        type: 'workload_summary' as const,
        position: { x: 1, y: 1 },
        size: { w: 1, h: 2 },
      },
    ] as DashboardWidgetConfig[]).map(normalizeWidget)

    setWidgets(fallback)
    widgetsRef.current = fallback
  }, [layoutError])

  const activeWidgetTypes = useMemo(() => new Set(widgets.map((w) => w.type)), [widgets])

  const saveLayout = (next: DashboardWidgetConfig[]) => {
    if (!projectId) return
    // debounce a bit to avoid bursty updates on drag handle / resize.
    if (saveLayoutTimer.current) window.clearTimeout(saveLayoutTimer.current)
    saveLayoutTimer.current = window.setTimeout(() => {
      updateLayout.mutate(next)
    }, 80)
  }

  const swapWidgets = useCallback((aId: string, bId: string) => {
    setWidgets((curr) => {
      const a = curr.find((w) => w.id === aId)
      const b = curr.find((w) => w.id === bId)
      if (!a || !b) return curr
      const next = curr.map((w) => {
        if (w.id === aId) return normalizeWidget({ ...w, position: { ...b.position } })
        if (w.id === bId) return normalizeWidget({ ...w, position: { ...a.position } })
        return w
      })
      widgetsRef.current = next
      saveLayout(next)
      return next
    })
  }, [])

  // Pointer-based drag state
  const [dragState, setDragState] = useState<{ widgetId: string } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragRef = useRef<{ widgetId: string; startX: number; startY: number } | null>(null)
  const widgetElemsRef = useRef<Map<string, HTMLElement>>(new Map())

  const handleDragHandle = useCallback((widgetId: string, e: React.PointerEvent) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { widgetId, startX: e.clientX, startY: e.clientY }
    setDragState({ widgetId })
    setDragOverId(null)

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      // Determine which widget the pointer is currently over
      let foundId: string | null = null
      for (const [id, el] of widgetElemsRef.current.entries()) {
        if (id === dragRef.current.widgetId) continue
        const rect = el.getBoundingClientRect()
        if (ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top  && ev.clientY <= rect.bottom) {
          foundId = id
          break
        }
      }
      setDragOverId(foundId)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const current = dragRef.current
      setDragOverId((overId) => {
        if (current && overId && overId !== current.widgetId) {
          swapWidgets(current.widgetId, overId)
        }
        return null
      })
      dragRef.current = null
      setDragState(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [editMode, swapWidgets])

  const removeWidget = (id: string) => {
    const next = widgets.filter((w) => w.id !== id)
    setWidgets(next)
    widgetsRef.current = next
    saveLayout(next)
  }

  const addWidget = (type: DashboardWidgetType) => {
    const size = getDefaultWidgetSize(type)
    const id = crypto.randomUUID()
    const slot = findFirstFreeSlot(widgets, size)

    const nextWidget: DashboardWidgetConfig = normalizeWidget({
      id,
      type,
      position: { x: slot.x, y: slot.y },
      size,
    })

    const next = [...widgets, nextWidget]
    setWidgets(next)
    widgetsRef.current = next
    saveLayout(next)
    setAddOpen(false)
  }

  const resizeLive = (widgetId: string, nextW: number, nextH: number) => {
    const next = widgetsRef.current.map((w) => {
      if (w.id !== widgetId) return w
      return normalizeWidget({
        ...w,
        size: { w: nextW, h: nextH },
      })
    })
    widgetsRef.current = next
    setWidgets(next)
  }

  const resizeCommit = () => {
    saveLayout(widgetsRef.current)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / Dashboard</span>}
          title="Dashboard"
          subtitle="Arrange widgets for this project."
          actions={(
            <>
              <Link to={`/projects/${projectId}`}>
                <Button variant="outline" className="h-10 rounded-none">
                  Back to tasks
                </Button>
              </Link>

              <Button
                variant={editMode ? 'secondary' : 'outline'}
                className="h-10 rounded-none"
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? 'Done' : 'Edit dashboard'}
              </Button>

              <Button
                variant="outline"
                className="h-10 gap-2 rounded-none"
                disabled={!editMode}
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4" />
                Add widget
              </Button>
            </>
          )}
        />

        {layoutError && (
          <div className="px-6 pt-4 sm:px-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Dashboard layout storage isn’t ready yet (missing DB table). Widgets will still show, but layout changes won’t be saved until migrations are applied.
            </div>
          </div>
        )}

        <section className="p-6 sm:px-8">
          {isLoadingLayout ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Loading dashboard…</div>
          ) : (
            <>
              <div
                className="grid grid-cols-2 gap-4"
                style={{ gridAutoRows: `${ROW_UNIT_PX}px` }}
              >
                {widgets.map((w) => (
                  <DashboardWidgetShell
                    key={w.id}
                    widget={w}
                    projectId={projectId!}
                    editMode={editMode}
                    isDragging={dragState?.widgetId === w.id}
                    isDragOver={dragOverId === w.id}
                    onRemove={() => removeWidget(w.id)}
                    onResizeLive={resizeLive}
                    onResizeCommit={resizeCommit}
                    onDragHandle={handleDragHandle}
                    registerRef={(el) => {
                      if (el) widgetElemsRef.current.set(w.id, el)
                      else widgetElemsRef.current.delete(w.id)
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-lg rounded-none">
            <DialogHeader>
              <DialogTitle>Add a widget</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {DASHBOARD_WIDGET_TYPES.filter((t) => !activeWidgetTypes.has(t)).map((t) => {
                const title = t === 'burndown_chart' ? 'Burndown chart' : t.replace(/_/g, ' ')
                return (
                  <Button
                    key={t}
                    variant="outline"
                    className="w-full justify-start rounded-none"
                    onClick={() => addWidget(t)}
                  >
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                      <span className="text-xs font-semibold">{t[0].toUpperCase()}</span>
                    </span>
                    {title}
                  </Button>
                )
              })}

              {DASHBOARD_WIDGET_TYPES.filter((t) => !activeWidgetTypes.has(t)).length === 0 && (
                <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
                  All widgets are already added.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

function DashboardWidgetShell({
  widget,
  projectId,
  editMode,
  isDragging,
  isDragOver,
  onRemove,
  onResizeLive,
  onResizeCommit,
  onDragHandle,
  registerRef,
}: {
  widget: DashboardWidgetConfig
  projectId: string
  editMode: boolean
  isDragging: boolean
  isDragOver: boolean
  onRemove: () => void
  onResizeLive: (widgetId: string, nextW: number, nextH: number) => void
  onResizeCommit: () => void
  onDragHandle: (widgetId: string, e: React.PointerEvent) => void
  registerRef: (el: HTMLElement | null) => void
}) {

  const resizeRef = useRef<{
    startY: number
    startH: number
    startX: number
    startW: number
    mode: 'h' | 'w'
    widgetId: string
  } | null>(null)

  const content = useMemo(() => {
    const Comp = widgetComponent(widget.type)
    return <Comp projectId={projectId} />
  }, [projectId, widget.type])

  const style = {
    gridColumn: `${widget.position.x + 1} / span ${widget.size.w}`,
    gridRow: `${widget.position.y + 1} / span ${widget.size.h}`,
    zIndex: isDragging ? 5 : 1,
  }

  const handleResize = (mode: 'h' | 'w', e: React.PointerEvent) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()

    resizeRef.current = {
      startY: e.clientY,
      startX: e.clientX,
      startH: widget.size.h,
      startW: widget.size.w,
      mode,
      widgetId: widget.id,
    }

    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      // IMPORTANT: only use resizeRef.current values — never close over widget.size
      // which would be stale after the first resize step triggers a React re-render.
      const dY = ev.clientY - resizeRef.current.startY
      const dX = ev.clientX - resizeRef.current.startX

      let nextH = resizeRef.current.startH
      let nextW = resizeRef.current.startW
      if (mode === 'h') {
        const deltaUnits = Math.round(dY / ROW_UNIT_PX)
        nextH = clamp(resizeRef.current.startH + deltaUnits, 1, MAX_H)
      } else {
        // With 2 columns, allow toggling between w=1 and w=2.
        if (resizeRef.current.startW === 1 && dX > 24) nextW = 2
        if (resizeRef.current.startW === 2 && dX < -24) nextW = 1
      }

      onResizeLive(resizeRef.current.widgetId, nextW, nextH)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      resizeRef.current = null
      onResizeCommit()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={registerRef}
      style={style}
      className={[
        'relative transition-[box-shadow,opacity] duration-150',
        isDragging ? 'opacity-60 scale-[0.97]' : '',
        isDragOver ? 'ring-2 ring-primary rounded-xl' : '',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background/60 backdrop-blur',
          isDragging ? 'shadow-lg' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/40 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Drag widget"
              className={[
                'inline-flex items-center justify-center rounded-md p-1',
                editMode
                  ? 'text-muted-foreground hover:bg-accent/40 cursor-grab active:cursor-grabbing'
                  : 'text-muted-foreground/30 cursor-default',
              ].join(' ')}
              onPointerDown={editMode ? (e) => onDragHandle(widget.id, e) : undefined}
            >
              <GripVertical className="size-3.5" />
            </button>

            <div className="min-w-0 truncate">
              <WidgetTitle type={widget.type} />
            </div>
          </div>

          {editMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Remove widget"
                onClick={onRemove}
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {content}
        </div>

        {editMode && (
          <>
            {/* Resize height handle */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 h-3 w-12 cursor-row-resize flex items-center justify-center"
              onPointerDown={(e) => handleResize('h', e)}
              aria-label="Resize height"
            >
              <div className="h-1 w-8 rounded-full bg-primary/40 hover:bg-primary/70 transition-colors" />
            </div>
            {/* Resize width handle */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-3 h-12 cursor-col-resize flex items-center justify-center"
              onPointerDown={(e) => handleResize('w', e)}
              aria-label="Resize width"
            >
              <div className="w-1 h-8 rounded-full bg-primary/40 hover:bg-primary/70 transition-colors" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

