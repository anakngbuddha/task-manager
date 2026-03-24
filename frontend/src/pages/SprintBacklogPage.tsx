import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDraggable,
  useDroppable
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useSprints } from '@/hooks/useSprints'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Calendar, GripVertical, ListTodo } from 'lucide-react'

// Droppable Container Component
function DroppableContainer({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'bg-primary/5 inset-ring-2 inset-ring-primary/20')}>
      {children}
    </div>
  )
}

// Draggable Task Component
function DraggableTask({ task, isOverlay = false }: { task: any, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: task,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-card p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing",
        isDragging && !isOverlay && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
        <div className="text-muted-foreground">
          <GripVertical className="size-4" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-medium">{task.title}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] uppercase font-semibold h-4 px-1">{task.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
      </div>
      {task.assignee && (
        <div className="shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full pointer-events-none">
          {task.assignee.name || task.assignee.email.split('@')[0]}
        </div>
      )}
    </div>
  )
}

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

  const [activeTask, setActiveTask] = useState<any | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const backlogTasks = useMemo(() => localTasks.filter(t => !t.sprintId), [localTasks])
  const activeSprints = useMemo(() => sprints.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PLANNING').sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()), [sprints])

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(e.active.data.current)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const taskId = String(active.id)
    const targetId = String(over.id)

    const taskObj = localTasks.find(t => t.id === taskId)
    if (!taskObj) return

    const currentSprintId = taskObj.sprintId ?? 'backlog'
    if (currentSprintId === targetId) return // No change

    const newSprintId = targetId === 'backlog' ? null : targetId

    // Optimistic UI update
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, sprintId: newSprintId } : t))
    // Server update
    await updateTask.mutateAsync({ id: taskId, projectId: projectId!, sprintId: newSprintId })
  }

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
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="p-6 h-[calc(100vh-5rem)] overflow-hidden flex gap-6">
            {/* Left Side: Backlog */}
            <div className="w-1/2 flex flex-col h-full bg-sidebar/30 rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <ListTodo className="size-4" />
                  Backlog
                </h2>
                <Badge variant="secondary">{backlogTasks.length}</Badge>
              </div>
              
              <DroppableContainer 
                id="backlog"
                className="flex-1 overflow-y-auto pr-2 rounded-lg transition-colors p-2 -mx-2"
              >
                {backlogTasks.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">Backlog is empty</div>
                )}
                {backlogTasks.map(t => (
                  <DraggableTask key={t.id} task={t} />
                ))}
              </DroppableContainer>
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
                    
                    <DroppableContainer 
                      id={sprint.id}
                      className="flex-1 overflow-y-auto p-4 transition-colors relative min-h-[100px]"
                    >
                      {sprintTasks.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">Drag tasks here</div>
                      )}
                      {sprintTasks.map(t => (
                        <DraggableTask key={t.id} task={t} />
                      ))}
                    </DroppableContainer>
                  </div>
                )
              })}
            </div>
          </div>
          
          <DragOverlay>
            {activeTask ? <DraggableTask task={activeTask} isOverlay={true} /> : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  )
}
