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
import { useSprints, useStartSprint, useCompleteSprint } from '@/hooks/useSprints'
import type { Sprint } from '@/hooks/useSprints'
import StartSprintDialog from '@/components/board/StartSprintDialog'
import CompleteSprintDialog from '@/components/board/CompleteSprintDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar, GripVertical, ListTodo, Play, CheckCircle2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useProjectMembers } from '@/hooks/useProjectMembers'

function DroppableContainer({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'bg-primary/5 inset-ring-2 inset-ring-primary/20')}>
      {children}
    </div>
  )
}

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
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{task.priority}</Badge>
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

function SprintStatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">Active</Badge>
  if (status === 'PLANNING') return <Badge variant="outline" className="border-amber-500/30 text-amber-600 text-[10px]">Planning</Badge>
  if (status === 'COMPLETED') return <Badge variant="secondary" className="text-[10px]">Completed</Badge>
  return null
}

export default function SprintBacklogPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: sprints = [] } = useSprints(projectId!)
  const { data: tasks = [] } = useTasks(projectId!)
  const { data: session } = useSession()
  const { data: members = [] } = useProjectMembers(projectId!)
  const updateTask = useUpdateTask()
  const startSprint = useStartSprint(projectId!)
  const completeSprint = useCompleteSprint(projectId!)

  const [localTasks, setLocalTasks] = useState<any[]>([])
  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [startSprintTarget, setStartSprintTarget] = useState<Sprint | null>(null)
  const [completeSprintTarget, setCompleteSprintTarget] = useState<Sprint | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const myId = session?.user?.id
  const effectiveMyRole =
    (project?.members ?? []).find((m: any) => m.userId === myId)?.role
    ?? (members ?? []).find((m: any) => m.userId === myId)?.role
  const canManage = effectiveMyRole === 'MASTER_ADMIN' || effectiveMyRole === 'PROJECT_MANAGER'

  const backlogTasks = useMemo(() => localTasks.filter(t => !t.sprintId), [localTasks])
  const planningSprints = useMemo(
    () => (sprints as Sprint[]).filter((s) => s.status === 'PLANNING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [sprints]
  )
  const activeSprints = useMemo(
    () => (sprints as Sprint[]).filter((s) => s.status === 'ACTIVE'),
    [sprints]
  )
  const completedSprints = useMemo(
    () => (sprints as Sprint[]).filter((s) => s.status === 'COMPLETED').sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime()),
    [sprints]
  )
  const droppableSprints = useMemo(
    () => [...activeSprints, ...planningSprints],
    [activeSprints, planningSprints]
  )

  const handleDragStart = (e: DragStartEvent) => {
    if (!canManage) return
    setActiveTask(e.active.data.current)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!canManage) {
      setActiveTask(null)
      return
    }
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const taskId = String(active.id)
    const targetId = String(over.id)

    const taskObj = localTasks.find(t => t.id === taskId)
    if (!taskObj) return

    const currentSprintId = taskObj.sprintId ?? 'backlog'
    if (currentSprintId === targetId) return

    const newSprintId = targetId === 'backlog' ? null : targetId

    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, sprintId: newSprintId } : t))
    await updateTask.mutateAsync({ id: taskId, projectId: projectId!, sprintId: newSprintId })
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Backlog Grooming</span>}
          title="Backlog & Sprint Planning"
          subtitle={canManage ? 'Drag tasks between your backlog and sprints. Start sprints when ready.' : 'View sprint planning. Only admins and project managers can move tasks.'}
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

            <div className="w-1/2 flex flex-col h-full gap-4 overflow-y-auto pr-2">
              {droppableSprints.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-sidebar/30 h-40">
                  <span className="text-muted-foreground text-sm">No active or planning sprints. Create one from the board.</span>
                </div>
              )}
              
              {droppableSprints.map((sprint) => {
                const sprintTasks = localTasks.filter(t => t.sprintId === sprint.id)

                return (
                  <div key={sprint.id} className="bg-sidebar/30 rounded-xl border flex flex-col flex-shrink-0" style={{ maxHeight: '60%' }}>
                    <div className="p-4 border-b bg-card rounded-t-xl">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium flex items-center gap-2">
                            {sprint.status === 'ACTIVE' && <span className="size-2 rounded-full bg-emerald-500" />}
                            {sprint.status === 'PLANNING' && <span className="size-2 rounded-full bg-amber-500" />}
                            {sprint.name}
                          </h3>
                          <SprintStatusBadge status={sprint.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{sprintTasks.length} tasks</Badge>
                          
                          {canManage && sprint.status === 'PLANNING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-50"
                              onClick={() => setStartSprintTarget(sprint)}
                              disabled={activeSprints.length > 0}
                              title={activeSprints.length > 0 ? 'Complete the active sprint first' : 'Start this sprint'}
                            >
                              <Play className="size-3" />
                              Start
                            </Button>
                          )}
                          
                          {canManage && sprint.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => setCompleteSprintTarget(sprint)}
                            >
                              <CheckCircle2 className="size-3" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {sprint.startDate && sprint.endDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                          <Calendar className="size-3" />
                          {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                        </p>
                      )}
                      {sprint.goal && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Goal: {sprint.goal}</p>
                      )}
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

              {completedSprints.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completed Sprints</h3>
                  {completedSprints.slice(0, 3).map((sprint) => (
                    <div key={sprint.id} className="bg-sidebar/20 rounded-lg border border-border/50 p-3 mb-2 opacity-70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-muted-foreground/50" />
                          <span className="text-sm font-medium">{sprint.name}</span>
                          <SprintStatusBadge status={sprint.status} />
                        </div>
                        {sprint.completedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Completed {new Date(sprint.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DragOverlay>
            {activeTask ? <DraggableTask task={activeTask} isOverlay={true} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {startSprintTarget && (
        <StartSprintDialog
          open={!!startSprintTarget}
          onOpenChange={(open) => { if (!open) setStartSprintTarget(null) }}
          sprint={startSprintTarget}
          isPending={startSprint.isPending}
          onSubmit={async (data) => {
            await startSprint.mutateAsync({
              sprintId: startSprintTarget.id,
              ...data,
            })
            setStartSprintTarget(null)
          }}
        />
      )}

      {completeSprintTarget && (
        <CompleteSprintDialog
          open={!!completeSprintTarget}
          onOpenChange={(open) => { if (!open) setCompleteSprintTarget(null) }}
          sprint={completeSprintTarget}
          allSprints={sprints as Sprint[]}
          isPending={completeSprint.isPending}
          onSubmit={async (data) => {
            await completeSprint.mutateAsync({
              sprintId: completeSprintTarget.id,
              ...data,
            })
            setCompleteSprintTarget(null)
          }}
        />
      )}
    </div>
  )
}
