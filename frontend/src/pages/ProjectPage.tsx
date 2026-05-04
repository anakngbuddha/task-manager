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
import { MessageCircle, MoreHorizontal, Play, CheckCircle2, Tag as TagIcon, X as XIcon, AlertCircle } from 'lucide-react'
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
import { TASK_TYPE_CONFIG } from '@/lib/taskTypes'

const COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']
const PROJECT_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  COMPLETED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  AXED: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
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
  const [selectedEpicId, setSelectedEpicId] = useState<string>('ALL')

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
    if (selectedEpicId !== 'ALL') {
      tasks = tasks.filter((t: any) =>
        t.id === selectedEpicId ||
        t.parentId === selectedEpicId ||
        (t.parent && t.parent.id === selectedEpicId)
      )
    }
    return tasks
  }, [localTasks, currentSprint, boardView, selectedTag, selectedEpicId])

  const projectColumns = project?.boardColumns || COLUMNS
  const firstProjectColumn = projectColumns[0] ?? 'TODO'
  const epics = useMemo(() => localTasks.filter((t: any) => t.type === 'EPIC'), [localTasks])
  const selectedEpic = useMemo(() => epics.find((e: any) => e.id === selectedEpicId) ?? null, [epics, selectedEpicId])
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
    if (!isProjectActive) return
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeTask = tasksById.get(activeId)
    if (!activeTask) return

    // Members can only drag tasks assigned to them or unassigned (everyone)
    if (!canManageRoles) {
      const isAssignedToMe = activeTask.assigneeId === myId
      const isAssignedToEveryone = !activeTask.assigneeId
      if (!isAssignedToMe && !isAssignedToEveryone) return
    }

    const newStatus = projectColumns.includes(overId)
      ? overId
      : tasksById.get(overId)?.status

    if (!newStatus || newStatus === activeTask.status) return

    // Members cannot move to READY
    if (!canManageRoles && newStatus === 'READY') return

    setLocalTasks((prev) =>
      prev.map((t) => (String(t.id) === activeId ? { ...t, status: newStatus } : t))
    )
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!isProjectActive) {
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

    // Members can only drag tasks assigned to them or unassigned (everyone)
    if (!canManageRoles) {
      const isAssignedToMe = task.assigneeId === myId
      const isAssignedToEveryone = !task.assigneeId
      if (!isAssignedToMe && !isAssignedToEveryone) return
      // Members cannot move to READY
      if (newStatus === 'READY') return
    }

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
  const isProjectActive = project?.status === 'ACTIVE'
  const canCreateTask = canManageRoles && isProjectActive

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
      <main className="flex-1 overflow-hidden bg-muted/30">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Board</span>}
          title="Tasks"
          subtitle={(
            <span className="flex flex-wrap items-center gap-2">
              <span>Drag tasks between columns to update status.</span>
              {project?.status && (
                <Badge variant="secondary" className={`h-6 px-2 text-[0.68rem] ${PROJECT_STATUS_STYLE[project.status] ?? ''}`}>
                  {project.status}
                </Badge>
              )}
            </span>
          )}
          actions={(
            <>
              <div className="flex flex-wrap items-center gap-2">
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
                          type: 'TASK',
                          sprintId: data.sprintId ?? null,
                        })
                      }
                    }
                  }}
                  defaultStatus={firstProjectColumn}
                  allTasks={localTasks}
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-9 gap-2 border-0 bg-muted text-foreground hover:bg-muted/80">
                      <MoreHorizontal className="size-4" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/backlog`}>Backlog & Sprints</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/activity`}>Project Logs</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/files`}>Project Files</Link>
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
                    {canManageRoles && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setCreateSprintOpen(true)}>
                          Create sprint
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setInviteModalOpen(true)}>
                          Invite members
                        </DropdownMenuItem>
                        {project?.status === 'ACTIVE' && (
                          <>
                            <DropdownMenuItem
                              disabled={updateProject.isPending || !isBoardReady}
                              onSelect={async () => {
                                if (window.confirm('Are you sure you want to mark this project as completed?')) {
                                  await updateProject.mutateAsync({ id: projectId!, data: { status: 'COMPLETED' } })
                                }
                              }}
                            >
                              Mark project complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-700 focus:text-rose-700 dark:text-rose-400"
                              disabled={updateProject.isPending}
                              onSelect={async () => {
                                if (window.confirm('Are you sure you want to discontinue (axe) this project?')) {
                                  await updateProject.mutateAsync({ id: projectId!, data: { status: 'AXED' } })
                                }
                              }}
                            >
                              Discontinue project
                            </DropdownMenuItem>
                          </>
                        )}
                        {(project?.status === 'COMPLETED' || project?.status === 'AXED') && (
                          <DropdownMenuItem
                            disabled={updateProject.isPending}
                            onSelect={async () => {
                              await updateProject.mutateAsync({ id: projectId!, data: { status: 'ACTIVE' } })
                            }}
                          >
                            Re-open project
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="hidden">
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
                </div>
              </div>
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
                  <div className="mb-4 space-y-3">
                    <div className="rounded-xl bg-muted/35 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-background/80 p-1 rounded-lg">
                          <button onClick={() => setBoardView('SPRINT')} className={boardView === 'SPRINT' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}>Sprint Tasks</button>
                          <button onClick={() => setBoardView('BACKLOG')} className={boardView === 'BACKLOG' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}>Non-Sprint Tasks</button>
                        </div>

                        <Select value={selectedEpicId} onValueChange={setSelectedEpicId}>
                          <SelectTrigger id="epic-filter-dropdown" className="h-9 w-[220px] border-0 bg-background/80">
                            <SelectValue placeholder="All Epics" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Epics</SelectItem>
                            {epics.map((epic: any) => (
                              <SelectItem key={epic.id} value={epic.id}>
                                <span className="flex items-center gap-1.5">
                                  <span>{TASK_TYPE_CONFIG.EPIC.icon}</span>
                                  <span className="truncate max-w-[145px]">{epic.title}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {boardView === 'SPRINT' && (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background/80 px-2 py-1">
                            <p className="text-xs font-medium text-muted-foreground">Sprint</p>
                            <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                              <SelectTrigger className="h-8 w-[13.5rem] border-0 bg-transparent px-1 shadow-none focus:ring-0">
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
                            {canManageRoles && sprintForStart && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 gap-1.5 border-0 bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400"
                                onClick={() => setStartSprintOpen(true)}
                              >
                                <Play className="size-3.5" />
                                Start Sprint
                              </Button>
                            )}
                            {canManageRoles && currentSprint?.status === 'ACTIVE' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 gap-1.5 border-0 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                                onClick={() => setCompleteSprintOpen(true)}
                              >
                                <CheckCircle2 className="size-3.5" />
                                Complete Sprint
                              </Button>
                            )}
                          </div>
                        )}

                        {boardView === 'SPRINT' && currentSprint && (
                          <p className="text-xs text-muted-foreground ml-auto">
                            Showing {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </div>

                    {boardView === 'SPRINT' && !currentSprint && !activeSprint && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-500/12 px-3 py-2.5 text-amber-800 dark:text-amber-300">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">No active sprint yet.</p>
                          <p className="text-xs opacity-90">Create and start a sprint to begin organizing sprint tasks.</p>
                        </div>
                      </div>
                    )}

                    {/* Epic filter banner */}
                    {selectedEpicId !== 'ALL' && selectedEpic && (
                      <div id="epic-filter-banner" className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${TASK_TYPE_CONFIG.EPIC.badgeColor} ${TASK_TYPE_CONFIG.EPIC.textColor}`}>
                        <span>{TASK_TYPE_CONFIG.EPIC.icon} Filtering by Epic: <strong>{selectedEpic.title}</strong></span>
                        <button
                          type="button"
                          onClick={() => setSelectedEpicId('ALL')}
                          className="ml-auto text-xs opacity-70 hover:opacity-100 transition-opacity"
                          aria-label="Clear epic filter"
                        >
                          ✕
                        </button>
                      </div>
                    )}

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

                    <div className="flex flex-wrap items-center gap-2">
                      {boardView === 'SPRINT' && sprintRangeText && (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={['h-2 w-2 rounded-full', sprintStatusDotClass ?? 'bg-muted-foreground/50'].join(' ')} />
                          <span>{sprintRangeText}</span>
                        </span>
                      )}
                      {boardView === 'BACKLOG' && (
                        <div className="text-sm text-muted-foreground flex items-center h-9">
                          Showing tasks not assigned to any sprint.
                        </div>
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
            className="fixed bottom-24 right-6 z-50 h-11 rounded-full px-4 shadow-lg"
            onClick={() => setChatOpen((prev) => !prev)}
          >
            <MessageCircle className="mr-2 size-4" />
            {chatOpen ? 'Hide' : 'Messages'}
          </Button>

          {chatOpen && (
            <div className="fixed bottom-40 right-6 z-50 w-72 max-w-[92vw] overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-xl backdrop-blur">
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
