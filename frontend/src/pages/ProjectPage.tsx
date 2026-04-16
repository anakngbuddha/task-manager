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
import StartSprintDialog from '@/components/board/StartSprintDialog'
import CompleteSprintDialog from '@/components/board/CompleteSprintDialog'
import InviteMembersDialog from '@/components/board/InviteMembersDialog'
import { useTasks, useUpdateTask, useCreateTask } from '@/hooks/useTasks'
import { useProject, useUpdateProject } from '@/hooks/useProject'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useCreateSprint, useSprints, useStartSprint, useCompleteSprint } from '@/hooks/useSprints'
import type { Sprint } from '@/hooks/useSprints'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageCircle, MoreHorizontal, Play, CheckCircle2, Tag as TagIcon, X as XIcon } from 'lucide-react'
import { useCreateInvite } from '@/hooks/useInvites'
import { TagPill } from '@/components/board/TagInput'
import type { Tag } from '@/hooks/useTaskTags'
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
  const startSprint = useStartSprint(projectId!)
  const completeSprint = useCompleteSprint(projectId!)
  const createInvite = useCreateInvite(projectId!)
  const updateProject = useUpdateProject()

  const [activeTask, setActiveTask] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [localTasks, setLocalTasks] = useState<any[]>([])
  const dragStartRef = useRef<{ id: string; status: string } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  const [createSprintOpen, setCreateSprintOpen] = useState(false)
  const [startSprintOpen, setStartSprintOpen] = useState(false)
  const [completeSprintOpen, setCompleteSprintOpen] = useState(false)
  const [boardView, setBoardView] = useState<'SPRINT' | 'BACKLOG'>('SPRINT')
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

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

  const activeSprint = useMemo(
    () => (sprints as Sprint[]).find((s) => s.status === 'ACTIVE') ?? null,
    [sprints]
  )

  const currentSprint = useMemo(() => {
    if (!selectedSprintId) return activeSprint
    return (sprints as Sprint[]).find((s) => s.id === selectedSprintId) ?? null
  }, [selectedSprintId, sprints, activeSprint])

  useEffect(() => {
    const allSprints = sprints as Sprint[]
    if (allSprints.length === 0) {
      if (selectedSprintId !== '') setSelectedSprintId('')
      return
    }

    const exists = allSprints.some((s) => s.id === selectedSprintId)
    if (exists) return

    const fallbackSprintId = activeSprint?.id ?? allSprints[0]?.id ?? ''
    if (fallbackSprintId !== selectedSprintId) {
      setSelectedSprintId(fallbackSprintId)
    }
  }, [sprints, activeSprint, selectedSprintId])

  const displayedTasks = useMemo(() => {
    let tasks: any[]
    if (boardView === 'BACKLOG') {
      tasks = localTasks.filter((t: any) => !t.sprintId)
    } else if (!currentSprint) {
      tasks = []
    } else {
      tasks = localTasks.filter((t: any) => String(t.sprintId) === String(currentSprint.id))
    }
    if (selectedTag) {
      tasks = tasks.filter((t: any) =>
        Array.isArray(t.tags) && t.tags.some((tt: any) => tt.tag?.id === selectedTag.id)
      )
    }
    return tasks
  }, [localTasks, currentSprint, boardView, selectedTag])

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
    if (!canMoveTasks) return
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

    setLocalTasks((prev) =>
      prev.map((t) => (String(t.id) === activeId ? { ...t, status: newStatus } : t))
    )
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!canMoveTasks) {
      setActiveTask(null)
      return
    }
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
  const canMoveTasks = canManageRoles

  const sprintRangeText = useMemo(() => {
    if (!currentSprint) return null
    const start = currentSprint.startDate
    const end = currentSprint.endDate
    if (!start || !end) return currentSprint.name
    const fmt = (v: string) =>
      new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${currentSprint.name} · ${fmt(start)} – ${fmt(end)}`
  }, [currentSprint])

  const sprintStatusDotClass = useMemo(() => {
    if (!currentSprint) return null
    if (currentSprint.status === 'ACTIVE') return 'bg-emerald-500'
    if (currentSprint.status === 'PLANNING') return 'bg-amber-500'
    if (currentSprint.status === 'COMPLETED') return 'bg-muted-foreground/50'
    return 'bg-muted-foreground/50'
  }, [currentSprint])

  const sprintForStart = useMemo(() => {
    if (!currentSprint) return null
    if (currentSprint.status !== 'PLANNING') return null
    return currentSprint
  }, [currentSprint])

  return (
    <div className="flex h-dvh">
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
                defaultSprintId={currentSprint?.id ?? 'NONE'}
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
                    <Link to={`/projects/${projectId}/github`}>GitHub Activity</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/dependencies`}>Dependency Diagram</Link>
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
                  Loading tasks...
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

                    {/* Tag filter bar */}
                    {selectedTag && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <TagIcon className="size-3" />
                          Filtered by:
                        </span>
                        <TagPill tag={selectedTag} />
                        <button
                          type="button"
                          onClick={() => setSelectedTag(null)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <XIcon className="size-3" />
                          Clear filter
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      {boardView === 'SPRINT' ? (
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-muted-foreground">Sprint</p>
                          <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                            <SelectTrigger className="h-9 w-[16rem] rounded-none">
                              <SelectValue placeholder="Select sprint" />
                            </SelectTrigger>
                            <SelectContent>
                              {(sprints as Sprint[]).map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                  {s.status === 'ACTIVE' && ' (active)'}
                                  {s.status === 'PLANNING' && ' (planning)'}
                                  {s.status === 'COMPLETED' && ' (completed)'}
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

                          {canManageRoles && sprintForStart && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 ml-2 border-blue-500/30 text-blue-600 hover:bg-blue-50"
                              onClick={() => setStartSprintOpen(true)}
                            >
                              <Play className="size-3.5" />
                              Start Sprint
                            </Button>
                          )}

                          {canManageRoles && currentSprint?.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 ml-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => setCompleteSprintOpen(true)}
                            >
                              <CheckCircle2 className="size-3.5" />
                              Complete Sprint
                            </Button>
                          )}
                        </div>
                      ) : (
                         <div className="text-sm text-muted-foreground flex items-center h-9">
                           Showing tasks not assigned to any sprint.
                         </div>
                      )}
                      
                      {boardView === 'SPRINT' && currentSprint && (
                        <p className="text-xs text-muted-foreground">
                          Showing {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'}
                        </p>
                      )}
                      {boardView === 'SPRINT' && !currentSprint && !activeSprint && (
                        <p className="text-xs text-muted-foreground">
                          No active sprint. Create and start a sprint to begin.
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
                        onAddTask={() => {
                          setCreateOpen(true)
                        }}
                        canAddTask={canCreateTask}
                        onTagClick={(tag) => setSelectedTag(tag)}
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
            className="fixed bottom-24 right-6 z-20 h-11 rounded-full px-4 shadow-lg"
            onClick={() => setChatOpen((prev) => !prev)}
          >
            <MessageCircle className="mr-2 size-4" />
            {chatOpen ? 'Hide' : 'Messages'}
          </Button>

          {chatOpen && (
            <div className="fixed bottom-40 right-6 z-20 w-72 max-w-[92vw] overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-xl backdrop-blur">
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

      {sprintForStart && (
        <StartSprintDialog
          open={startSprintOpen}
          onOpenChange={setStartSprintOpen}
          sprint={sprintForStart}
          isPending={startSprint.isPending}
          onSubmit={async (data) => {
            await startSprint.mutateAsync({
              sprintId: sprintForStart.id,
              ...data,
            })
          }}
        />
      )}

      {currentSprint && currentSprint.status === 'ACTIVE' && (
        <CompleteSprintDialog
          open={completeSprintOpen}
          onOpenChange={setCompleteSprintOpen}
          sprint={currentSprint}
          allSprints={sprints as Sprint[]}
          isPending={completeSprint.isPending}
          onSubmit={async (data) => {
            await completeSprint.mutateAsync({
              sprintId: currentSprint.id,
              ...data,
            })
          }}
        />
      )}

    </div>
  )
}
