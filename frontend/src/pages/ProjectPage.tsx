import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import KanbanColumn from '@/components/board/KanbanColumn'
import TaskCard from '@/components/board/TaskCard'
import TaskDialog from '@/components/board/TaskDialog'
import CreateTaskDialog from '@/components/board/CreateTaskDialog'
import CreateSprintDialog from '@/components/board/CreateSprintDialog'
import InviteMembersDialog from '@/components/board/InviteMembersDialog'
import { useTasks, useUpdateTask, useCreateTask } from '@/hooks/useTasks'
import { useProject, useUpdateProject } from '@/hooks/useProject'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useCreateSprint, useSprints } from '@/hooks/useSprints'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageCircle, MoreHorizontal } from 'lucide-react'
import { useCreateInvite } from '@/hooks/useInvites'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']
const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  READY: 'Ready',
}

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: session } = useSession()
  const { data: tasks = [], isLoading } = useTasks(projectId!)
  const { data: project } = useProject(projectId!)
  const { data: members = [] } = useProjectMembers(projectId!)
  const { data: sprints = [] } = useSprints(projectId!)
  const { data: timeReport } = useProjectTimeReport(projectId!)
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const createSprint = useCreateSprint(projectId!)
  const createInvite = useCreateInvite(projectId!)
  const updateProject = useUpdateProject()

  const [activeTask, setActiveTask] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [localTasks, setLocalTasks] = useState<any[]>([])
  const dragStartRef = useRef<{ id: string; status: string } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const [selectedSprintId, setSelectedSprintId] = useState<string>('ALL')
  const [createSprintOpen, setCreateSprintOpen] = useState(false)
  const [boardView, setBoardView] = useState<'SPRINT' | 'BACKLOG'>('SPRINT')

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }))

  useEffect(() => {
    setLocalTasks(
      tasks.map((t: any) => ({
        ...t,
        timeTotalHours: (timeReport?.byTask ?? []).find((row: any) => String(row.taskId) === String(t.id))?.totalHours ?? 0,
      })),
    )
  }, [tasks])

  const taskTimeTotalHours = useMemo(() => {
    return new Map<string, number>((timeReport?.byTask ?? []).map((r: any) => [String(r.taskId), r.totalHours]))
  }, [timeReport])

  useEffect(() => {
    setLocalTasks((prev) =>
      prev.map((t: any) => ({
        ...t,
        timeTotalHours: taskTimeTotalHours.get(String(t.id)) ?? 0,
      })),
    )
  }, [taskTimeTotalHours])

  const tasksById = useMemo(() => {
    const map = new Map<string, any>()
    for (const t of localTasks) map.set(String(t.id), t)
    return map
  }, [localTasks])

  useEffect(() => {
    if (!selectedTask) return
    const next = tasksById.get(String(selectedTask.id))
    if (next) setSelectedTask(next)
  }, [tasksById, selectedTask])

  useEffect(() => {
    const tid = searchParams.get('taskId')
    if (tid && tasksById.size > 0 && !selectedTask) {
      const task = tasksById.get(tid)
      if (task) {
        setSelectedTask(task)
      }
    }
  }, [searchParams, tasksById, selectedTask])

  const displayedTasks = useMemo(() => {
    if (boardView === 'BACKLOG') {
      return localTasks.filter((t: any) => !t.sprintId)
    }
    const activeSprint = sprints.find((s: any) => s.status === 'ACTIVE' || s.status === 'PLANNING')
    const sid = selectedSprintId === 'ALL' ? activeSprint?.id : selectedSprintId
    if (!sid || sid === 'NONE') return []
    return localTasks.filter((t: any) => String(t.sprintId) === String(sid))
  }, [localTasks, selectedSprintId, boardView, sprints])

  const projectColumns = project?.boardColumns || COLUMNS
  const firstProjectColumn = projectColumns[0] ?? 'TODO'
  const isBoardReady = useMemo(() => {
    if (!localTasks.length) return false
    const lastCol = projectColumns[projectColumns.length - 1]
    return localTasks.every((t: any) => t.status === lastCol)
  }, [localTasks, projectColumns])

  const getColumnTasks = (status: string) => displayedTasks.filter((t: any) => t.status === status)

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasksById.get(String(e.active.id)) ?? null
    setActiveTask(t)
    dragStartRef.current = t ? { id: String(t.id), status: t.status } : null
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeTask = tasksById.get(activeId)
    if (!activeTask) return

    const newStatus = projectColumns.includes(overId)
      ? overId
      : tasksById.get(overId)?.status

    if (!newStatus || newStatus === activeTask.status) return
    if (newStatus === 'READY' && !canMoveToReady) return

    setLocalTasks((prev) =>
      prev.map((t) => (String(t.id) === activeId ? { ...t, status: newStatus } : t))
    )
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const task = tasksById.get(String(active.id))
    const newStatus = projectColumns.includes(String(over.id))
      ? String(over.id)
      : tasksById.get(String(over.id))?.status

    const started = dragStartRef.current
    dragStartRef.current = null

    if (!task || !newStatus) return

    const previousStatus = started?.id === String(task.id) ? started.status : task.status
    if (newStatus === previousStatus) return
    if (newStatus === 'READY' && !canMoveToReady) return

    setLocalTasks((prev) =>
      prev.map((t) => (String(t.id) === String(task.id) ? { ...t, status: newStatus } : t))
    )

    await updateTask.mutateAsync({
      id: task.id,
      projectId: projectId!,
      status: newStatus,
    })
  }

  const myId = session?.user?.id
  const effectiveMyRole =
    (project?.members ?? []).find((m: any) => m.userId === myId)?.role
    ?? (members ?? []).find((m: any) => m.userId === myId)?.role
  const canManageRoles = effectiveMyRole === 'MASTER_ADMIN' || effectiveMyRole === 'PROJECT_MANAGER'
  const canCreateTask = canManageRoles
  const canMoveToReady = effectiveMyRole === 'MASTER_ADMIN'

  const selectedSprint = useMemo(() => {
    if (selectedSprintId === 'ALL' || selectedSprintId === 'NONE') return null
    return (sprints as any[]).find((s) => String(s.id) === String(selectedSprintId)) ?? null
  }, [sprints, selectedSprintId])

  const sprintRangeText = useMemo(() => {
    if (!selectedSprint) return null
    const start = selectedSprint.startDate ?? selectedSprint.start ?? selectedSprint.startsAt
    const end = selectedSprint.endDate ?? selectedSprint.end ?? selectedSprint.endsAt
    if (!start || !end) return selectedSprint.name
    const fmt = (v: any) =>
      new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${selectedSprint.name} · ${fmt(start)} – ${fmt(end)}`
  }, [selectedSprint])

  const sprintStatusDotClass = useMemo(() => {
    if (!selectedSprint) return null
    const status = String(selectedSprint.status ?? '').toUpperCase()
    if (status === 'ACTIVE') return 'bg-emerald-500'
    if (status === 'PLANNING') return 'bg-amber-500'
    if (status === 'COMPLETED') return 'bg-muted-foreground/50'
    return 'bg-muted-foreground/50'
  }, [selectedSprint])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Board</span>}
          title="Tasks"
          subtitle="Drag tasks between columns to update status."
          actions={(
            <>
              <CreateTaskDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onTriggerClick={() => {
                  setCreateOpen(true)
                }}
                canCreateTask={canCreateTask}
                projectColumns={projectColumns}
                members={project?.members ?? []}
                sprints={sprints as any[]}
                isPending={createTask.isPending}
                onSubmit={async (data, subtasks) => {
                  const created = await createTask.mutateAsync({
                    ...data,
                    projectId: projectId!,
                  })
                  if (subtasks && subtasks.length > 0 && created?.id) {
                    for (const st of subtasks) {
                      await createTask.mutateAsync({
                        title: st,
                        description: 'Subtask belonging to ' + data.title,
                        priority: data.priority,
                        status: firstProjectColumn,
                        projectId: projectId!,
                        parentId: created.id,
                      })
                    }
                  }
                }}
                defaultStatus={firstProjectColumn}
                defaultSprintId={selectedSprintId === 'ALL' ? 'NONE' : selectedSprintId}
              />

              <CreateSprintDialog
                open={createSprintOpen}
                onOpenChange={setCreateSprintOpen}
                canManageRoles={canManageRoles}
                isPending={createSprint.isPending}
                onSubmit={async (data) => {
                  await createSprint.mutateAsync(data)
                }}
              />

              <InviteMembersDialog
                open={inviteModalOpen}
                onOpenChange={setInviteModalOpen}
                onGenerateInvite={async () => {
                  const base = import.meta.env.VITE_FRONTEND_URL || window.location.origin
                  const res = await createInvite.mutateAsync()
                  return `${base}/invite/${res.code}`
                }}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-9">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/backlog`}>Backlog & Sprints</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/activity`}>Project Logs</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/roadmap`}>Roadmap</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/sprint-report`}>Sprint report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/members`}>View members</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/settings`}>Settings</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canManageRoles && project?.status !== 'COMPLETED' && (
                <Button
                  title={isBoardReady ? '' : `All tasks must be marked as ${STATUS_LABELS[projectColumns[projectColumns.length - 1]] || projectColumns[projectColumns.length - 1]} to complete the project.`}
                  variant="outline"
                  className="h-9 gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to mark this project as completed?')) {
                      await updateProject.mutateAsync({ id: projectId!, data: { status: 'COMPLETED' } })
                    }
                  }}
                  disabled={updateProject.isPending || !isBoardReady}
                >
                  Project Complete
                </Button>
              )}
              {project?.status === 'COMPLETED' && (
                <Badge variant="secondary" className="h-9 px-3 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  Completed
                </Badge>
              )}
            </>
          )}
        />

        <div className="relative h-[calc(100vh-5rem)]">
          <div className="h-full overflow-auto pr-0 md:pr-0">
            {isLoading ? (
              <div className="px-6 py-7 sm:px-8">
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Loading tasks…
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <section className="px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex flex-col gap-4 mb-4">
                    <div className="flex bg-muted/50 p-1 rounded-lg w-fit border border-border/50">
                      <button onClick={() => setBoardView('SPRINT')} className={boardView === 'SPRINT' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}>Sprint Tasks</button>
                      <button onClick={() => setBoardView('BACKLOG')} className={boardView === 'BACKLOG' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}>Non-Sprint Tasks</button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {boardView === 'SPRINT' ? (
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-muted-foreground">Sprint Filter</p>
                          <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                            <SelectTrigger className="h-9 w-[16rem] rounded-none">
                              <SelectValue placeholder="All active sprints" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">Current Active Sprint</SelectItem>
                              <SelectItem value="NONE">No sprint</SelectItem>
                              {(sprints as any[]).map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {sprintRangeText && (
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground ml-2">
                              <span className={['h-2 w-2 rounded-full', sprintStatusDotClass ?? 'bg-muted-foreground/50'].join(' ')} />
                              <span>{sprintRangeText}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                         <div className="text-sm text-muted-foreground flex items-center h-9">
                           Showing tasks not assigned to any sprint.
                         </div>
                      )}
                      
                      {selectedSprintId !== 'ALL' && boardView === 'SPRINT' && (
                        <p className="text-xs text-muted-foreground">
                          Showing {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
                    <div className="flex min-w-max gap-3">
                    {projectColumns.map((status: string) => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        tasks={getColumnTasks(status)}
                        onTaskClick={setSelectedTask}
                        onAddTask={(status: string) => {
                          setCreateOpen(true)
                        }}
                        canAddTask={canCreateTask}
                      />
                    ))}
                    </div>
                  </div>
                </section>
                <DragOverlay>
                  {activeTask && (
                    <TaskCard task={activeTask} onClick={() => {}} />
                  )}
                </DragOverlay>
              </DndContext>
            )}

          </div>
          <Button
            type="button"
            size="sm"
            className="fixed bottom-6 right-6 z-20 h-11 rounded-full px-4 shadow-lg md:bottom-8 md:right-8"
            onClick={() => setChatOpen((prev) => !prev)}
          >
            <MessageCircle className="mr-2 size-4" />
            {chatOpen ? 'Hide' : 'Messages'}
          </Button>

          {chatOpen && (
            <div className="fixed bottom-20 right-6 z-20 w-72 max-w-[92vw] overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-xl backdrop-blur md:bottom-24 md:right-8">
              <div className="px-4 py-3">
                <p className="text-sm font-medium">Messages moved</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the full messages page for project chat and direct messages.
                </p>
                <Link to={`/projects/${projectId}/messages`} className="mt-3 inline-block">
                  <Button size="sm" className="w-full">Open messages</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          projectId={projectId!}
          projectMembers={project?.members ?? []}
          open={!!selectedTask}
          onClose={() => {
            setSelectedTask(null)
            if (searchParams.has('taskId')) {
              setSearchParams(prev => {
                prev.delete('taskId')
                return prev
              })
            }
          }}
        />
      )}
    </div>
  )
}
