import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useSprints } from '@/hooks/useSprints'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Calendar, GripVertical, ListTodo } from 'lucide-react'

// Basic layout: Backlog on the left, Sprints (Active/Future) on the right.
// You can drag a task from Backlog to a Sprint or between Sprints.

export default function SprintBacklogPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: sprints = [] } = useSprints(projectId!)
  const { data: tasks = [] } = useTasks(projectId!)
  const updateTask = useUpdateTask()

  const [localTasks, setLocalTasks] = useState<any[]>([])
  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  // Drag state using pointer events
  const [draggingTask, setDraggingTask] = useState<any | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({
    isDragging: false,
    taskId: '',
    startX: 0,
    startY: 0,
    elem: null as HTMLElement | null,
    clone: null as HTMLElement | null,
  })

  // Group tasks by sprint
  const backlogTasks = useMemo(() => localTasks.filter(t => !t.sprintId), [localTasks])
  const activeSprints = useMemo(() => sprints.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PLANNING').sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()), [sprints])

  const handlePointerDown = (e: React.PointerEvent, task: any) => {
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    const itemElem = target.closest('[data-task-id]') as HTMLElement
    if (!itemElem) return

    const rect = itemElem.getBoundingClientRect()
    dragState.current = {
      isDragging: true,
      taskId: task.id,
      startX: e.clientX,
      startY: e.clientY,
      elem: itemElem,
      clone: null,
    }

    setDraggingTask(task)

    const clone = itemElem.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = `${rect.top}px`
    clone.style.left = `${rect.left}px`
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.opacity = '0.8'
    clone.style.zIndex = '9999'
    clone.style.pointerEvents = 'none'
    clone.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
    clone.classList.add('ring-2', 'ring-primary')
    document.body.appendChild(clone)
    dragState.current.clone = clone

    itemElem.style.opacity = '0.3'

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragState.current.isDragging || !dragState.current.clone) return

    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    dragState.current.clone.style.transform = `translate(${dx}px, ${dy}px)`

    // Hit test target sprint/backlog containers
    // We expect containers to have data-droppable-id="sprintId" or "backlog"
    const elements = document.elementsFromPoint(e.clientX, e.clientY)
    const dropTarget = elements.find(el => el.hasAttribute('data-droppable-id')) as HTMLElement | undefined
    if (dropTarget) {
      setDragOverGroup(dropTarget.getAttribute('data-droppable-id'))
    } else {
      setDragOverGroup(null)
    }
  }

  const onPointerUp = async (e: PointerEvent) => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)

    if (dragState.current.clone) {
      document.body.removeChild(dragState.current.clone)
      dragState.current.clone = null
    }

    if (dragState.current.elem) {
      dragState.current.elem.style.opacity = '1'
    }

    const taskId = dragState.current.taskId
    const elements = document.elementsFromPoint(e.clientX, e.clientY)
    const dropTarget = elements.find(el => el.hasAttribute('data-droppable-id')) as HTMLElement | undefined
    
    dragState.current.isDragging = false
    setDraggingTask(null)
    setDragOverGroup(null)

    if (dropTarget && taskId) {
      const targetGroupId = dropTarget.getAttribute('data-droppable-id')
      
      const taskObj = localTasks.find(t => t.id === taskId)
      if (!taskObj) return

      const currentGroupId = taskObj.sprintId ?? 'backlog'
      if (currentGroupId === targetGroupId) return // No change

      const newSprintId = targetGroupId === 'backlog' ? null : targetGroupId

      // Optimistic update
      setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, sprintId: newSprintId } : t))
      // Backend update
      await updateTask.mutateAsync({ id: taskId, projectId: projectId!, sprintId: newSprintId })
    }
  }

  const renderTask = (t: any) => (
    <div
      key={t.id}
      data-task-id={t.id}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-card p-3 mb-2 shadow-sm",
        draggingTask?.id === t.id && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div 
          className="cursor-grab hover:text-primary"
          onPointerDown={(e) => handlePointerDown(e, t)}
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-medium">{t.title}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] uppercase font-semibold h-4 px-1">{t.status.replace('_', ' ')}</Badge>
          </div>
        </div>
      </div>
      {t.assignee && (
        <div className="shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {t.assignee.name || t.assignee.email.split('@')[0]}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Backlog Grooming</span>}
          title="Backlog & Sprint Planning"
          subtitle="Drag tasks between your backlog and active/upcoming sprints."
          actions={
             <Link to={`/projects/${projectId}`}>
                <Badge variant="outline" className="px-3 py-1 cursor-pointer hover:bg-muted">← Back to Board</Badge>
             </Link>
          }
        />
        
        <div className="p-6 h-[calc(100vh-5rem)] overflow-hidden flex gap-6" ref={containerRef}>
          {/* Left Side: Backlog */}
          <div className="w-1/2 flex flex-col h-full bg-sidebar/30 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <ListTodo className="size-4" />
                Backlog
              </h2>
              <Badge variant="secondary">{backlogTasks.length}</Badge>
            </div>
            
            <div 
              className={cn("flex-1 overflow-y-auto pr-2 rounded-lg transition-colors p-2 -mx-2", dragOverGroup === 'backlog' && 'bg-primary/5 ring-2 ring-primary/20')}
              data-droppable-id="backlog"
            >
              {backlogTasks.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">Backlog is empty</div>
              )}
              {backlogTasks.map(renderTask)}
            </div>
          </div>

          {/* Right Side: Sprints */}
          <div className="w-1/2 flex flex-col h-full gap-4 overflow-y-auto pr-2">
            {activeSprints.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-sidebar/30 h-40">
                <span className="text-muted-foreground text-sm">No active or planning sprints found.</span>
              </div>
            )}
            
            {activeSprints.map((sprint: any) => {
              const sprintTasks = localTasks.filter(t => t.sprintId === sprint.id)
              const isDragOver = dragOverGroup === sprint.id

              return (
                <div key={sprint.id} className="bg-sidebar/30 rounded-xl border flex flex-col flex-shrink-0" style={{ maxHeight: '60%' }}>
                  <div className="p-4 border-b bg-card rounded-t-xl flex justify-between items-center">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                         {sprint.status === 'ACTIVE' && <span className="size-2 rounded-full bg-emerald-500" />}
                         {sprint.name}
                      </h3>
                      {sprint.startDate && sprint.endDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="size-3" />
                          {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">{sprintTasks.length} tasks</Badge>
                  </div>
                  
                  <div 
                    className={cn("flex-1 overflow-y-auto p-4 transition-colors relative min-h-[100px]", isDragOver && 'bg-primary/5 inset-ring-2 inset-ring-primary/20')}
                    data-droppable-id={sprint.id}
                  >
                    {sprintTasks.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">Drag tasks here</div>
                    )}
                    {sprintTasks.map(renderTask)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
