import { useMemo, useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Map } from 'lucide-react'

// Render a simple Gantt chart
export default function RoadmapPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: tasks = [], isLoading } = useTasks(projectId!)
  const updateTask = useUpdateTask()

  const containerRef = useRef<HTMLDivElement>(null)

  // Determine timeline span
  const { minDate, totalDays } = useMemo(() => {
    let min = new Date()
    min.setHours(0, 0, 0, 0)
    let max = new Date()
    max.setHours(23, 59, 59, 999)

    tasks.forEach((t: any) => {
      if (t.startDate) {
        const d = new Date(t.startDate)
        if (d < min) min = new Date(d)
      }
      if (t.deadline) {
        const d = new Date(t.deadline)
        if (d > max) max = new Date(d)
      }
    })

    // Add buffers
    min.setDate(min.getDate() - 14) // 2 weeks before
    max.setDate(max.getDate() + 28) // 4 weeks after

    const diffTime = Math.abs(max.getTime() - min.getTime())
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return { minDate: min, maxDate: max, totalDays }
  }, [tasks])

  const daysList = useMemo(() => {
    const list = []
    const cur = new Date(minDate)
    for (let i = 0; i < totalDays; i++) {
      list.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return list
  }, [minDate, totalDays])

  const [dragState, setDragState] = useState<{ taskId: string; type: 'start' | 'end' | 'move'; startX: number; originalStart: Date | null; originalEnd: Date | null } | null>(null)

  const handlePointerDown = (e: React.PointerEvent, taskId: string, type: 'start' | 'end' | 'move', currentStart: Date | null, currentEnd: Date | null) => {
    e.preventDefault()
    setDragState({
      taskId,
      type,
      startX: e.clientX,
      originalStart: currentStart,
      originalEnd: currentEnd,
    })
  }

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragState || !containerRef.current) return
      // Calculate day delta based on px, assume 40px width per day (w-10)
      const dx = e.clientX - dragState.startX
      const dayDelta = Math.round(dx / 40)
      
      const tElement = document.getElementById(`gantt-bar-${dragState.taskId}`)
      if (tElement) {
        // Visual feedback
        tElement.style.transform = `translateX(${dayDelta * 40}px)`
      }
    }

    const onPointerUp = async (e: PointerEvent) => {
      if (!dragState) return
      
      const dx = e.clientX - dragState.startX
      const dayDelta = Math.round(dx / 40)
      
      const tElement = document.getElementById(`gantt-bar-${dragState.taskId}`)
      if (tElement) tElement.style.transform = ''

      if (dayDelta !== 0) {
        const updates: any = { id: dragState.taskId, projectId: projectId! }
        
        if (dragState.type === 'move') {
          if (dragState.originalStart) {
            const nd = new Date(dragState.originalStart)
            nd.setDate(nd.getDate() + dayDelta)
            updates.startDate = nd.toISOString()
          }
          if (dragState.originalEnd) {
            const nd = new Date(dragState.originalEnd)
            nd.setDate(nd.getDate() + dayDelta)
            updates.deadline = nd.toISOString()
          }
        }

        if (Object.keys(updates).length > 2) {
          await updateTask.mutateAsync(updates)
        }
      }
      setDragState(null)
    }

    if (dragState) {
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    }
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, projectId, updateTask])

  // Get tasks that have dates
  const scheduledTasks = tasks.filter((t: any) => t.startDate || t.deadline).sort((a: any, b: any) => {
     const da = a.startDate ? new Date(a.startDate).getTime() : new Date(a.deadline).getTime()
     const db = b.startDate ? new Date(b.startDate).getTime() : new Date(b.deadline).getTime()
     return da - db
  })

  // To draw dependency lines ideally requires SVG. We will just render the bars.
  // Advanced SVG curve drawing is omitted here for simplicity.

  const today = new Date()
  today.setHours(0,0,0,0)

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background flex flex-col">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Roadmap</span>}
          title="Roadmap"
          subtitle="Gantt-style timeline. Drag tasks to adjust their schedule."
          actions={
             <Link to={`/projects/${projectId}`}>
                <Badge variant="outline" className="px-3 py-1 cursor-pointer hover:bg-muted">← Back to Board</Badge>
             </Link>
          }
        />
        
        <div className="flex-1 overflow-hidden flex flex-col relative border-t mt-4" ref={containerRef}>
          {isLoading ? (
             <div className="p-8 text-center text-muted-foreground">Loading timeline...</div>
          ) : (
            <div className="flex-1 overflow-auto bg-sidebar/20 relative">
              {/* Timeline Header */}
              <div className="sticky top-0 z-20 flex bg-card border-b">
                <div className="w-64 shrink-0 border-r bg-muted/30 p-3 font-semibold text-sm flex items-center border-b">
                  <Map className="size-4 mr-2"/> Tasks
                </div>
                <div className="flex bg-card">
                  {daysList.map((d, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-10 shrink-0 border-r text-center py-2 text-[10px] text-muted-foreground flex flex-col justify-center",
                        d.getTime() === today.getTime() && "bg-primary/10 text-primary font-bold"
                      )}
                    >
                      <span className="uppercase">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      <span className="text-xs">{d.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Body */}
              <div className="relative">
                {/* Background grid */}
                <div className="absolute top-0 left-64 bottom-0 flex opacity-20 pointer-events-none">
                  {daysList.map((d, i) => (
                    <div key={i} className={cn("w-10 shrink-0 border-r", d.getTime() === today.getTime() && "bg-primary/30")} />
                  ))}
                </div>

                {scheduledTasks.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm pl-72">
                    No scheduled tasks found. Assign a Start Date or Deadline to tasks to see them on the roadmap.
                  </div>
                )}

                {scheduledTasks.map((t: any) => {
                  const sD = t.startDate ? new Date(t.startDate) : new Date(t.deadline!)
                  const eD = t.deadline ? new Date(t.deadline) : new Date(sD)
                  sD.setHours(0,0,0,0)
                  eD.setHours(23,59,59,999)

                  let startOffsetIdx = daysList.findIndex(d => d.getTime() === sD.getTime())
                  if (startOffsetIdx === -1) startOffsetIdx = 0
                  
                  let endOffsetIdx = daysList.findIndex(d => d.getTime() === eD.getTime())
                  if (endOffsetIdx === -1) endOffsetIdx = totalDays - 1

                  const durationDays = endOffsetIdx - startOffsetIdx + 1

                  return (
                    <div key={t.id} className="flex border-b border-border/40 hover:bg-muted/30 transition-colors group">
                      {/* Task Info Column */}
                      <div className="w-64 shrink-0 border-r bg-card/50 p-3 text-sm flex items-center gap-2 z-10 sticky left-0 truncate">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", 
                          t.status === 'DONE' ? 'bg-emerald-500' : 
                          t.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-muted-foreground'
                        )} />
                        <span className="truncate" title={t.title}>{t.title}</span>
                      </div>
                      
                      {/* Task Bar */}
                      <div className="relative flex-1 py-2">
                        <div 
                           id={`gantt-bar-${t.id}`}
                           className="absolute h-8 bg-primary rounded-full shadow-sm flex items-center px-3 cursor-grab text-primary-foreground text-xs font-semibold overflow-hidden transition-[width,left]"
                           style={{
                             left: `${startOffsetIdx * 40}px`,
                             width: `${durationDays * 40}px`,
                             opacity: t.status === 'DONE' ? 0.6 : 1
                           }}
                           onPointerDown={(e) => handlePointerDown(e, t.id, 'move', t.startDate, t.deadline)}
                        >
                           <span className="truncate">{t.title}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
