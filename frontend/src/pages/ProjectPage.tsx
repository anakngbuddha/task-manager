import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { useTasks, useUpdateTask, useCreateTask } from '@/hooks/useTasks'
import { useProject, useUpdateProject } from '@/hooks/useProject'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useCreateSprint, useSprints } from '@/hooks/useSprints'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarPlus, FolderPlus, MessageCircle, MoreHorizontal, Plus, UserPlus } from 'lucide-react'
import { useCreateInvite } from '@/hooks/useInvites'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getTodayStartLocalForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  local.setHours(0, 0, 0, 0)
  return local.toISOString().slice(0, 16)
}

function isPastToday(value: string) {
  const selected = new Date(value)
  const now = new Date()
  const sameDay =
    selected.getFullYear() === now.getFullYear() &&
    selected.getMonth() === now.getMonth() &&
    selected.getDate() === now.getDate()
  return sameDay && selected.getTime() < now.getTime()
}

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
  // Messages are now in a dedicated page: /projects/:id/messages

  const [activeTask, setActiveTask] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newAssigneeId, setNewAssigneeId] = useState<string>('EVERYONE')
  const [newDeadline, setNewDeadline] = useState('')
  const [deadlineError, setDeadlineError] = useState('')
  const [newStatus, setNewStatus] = useState<string>('TODO')
  const [newSprintId, setNewSprintId] = useState<string>('NONE')
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('')
  const [localTasks, setLocalTasks] = useState<any[]>([])
  const dragStartRef = useRef<{ id: string; status: string } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const [selectedSprintId, setSelectedSprintId] = useState<string>('ALL')
  const [createSprintOpen, setCreateSprintOpen] = useState(false)
  const [sprintName, setSprintName] = useState('')
  const [sprintGoal, setSprintGoal] = useState('')
  const [sprintStart, setSprintStart] = useState('')
  const [sprintEnd, setSprintEnd] = useState('')
  const [sprintError, setSprintError] = useState('')

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

  // Chat rendering moved to dedicated messages page

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

  const displayedTasks = useMemo(() => {
    if (selectedSprintId === 'ALL') return localTasks
    if (selectedSprintId === 'NONE') return localTasks.filter((t: any) => t.sprintId == null)
    return localTasks.filter(
      (t: any) => t.sprintId != null && String(t.sprintId) === String(selectedSprintId),
    )
  }, [localTasks, selectedSprintId])

  const getColumnTasks = (status: string) => displayedTasks.filter((t: any) => t.status === status)

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sprintName.trim() || !sprintStart || !sprintEnd) return

    const start = new Date(sprintStart)
    const end = new Date(sprintEnd)
    if (end <= start) {
      setSprintError('End date must be after start date')
      return
    }

    setSprintError('')
    await createSprint.mutateAsync({
      name: sprintName.trim(),
      goal: sprintGoal.trim() ? sprintGoal.trim() : undefined,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })

    setSprintName('')
    setSprintGoal('')
    setSprintStart('')
    setSprintEnd('')
    setCreateSprintOpen(false)
  }

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

    const newStatus = COLUMNS.includes(overId)
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
    const newStatus = COLUMNS.includes(String(over.id))
      ? String(over.id)
      : tasksById.get(String(over.id))?.status

    const started = dragStartRef.current
    dragStartRef.current = null

    if (!task || !newStatus) return

    const previousStatus = started?.id === String(task.id) ? started.status : task.status
    if (newStatus === previousStatus) return
    if (newStatus === 'READY' && !canMoveToReady) return

    // optimistic state already applied in onDragOver; ensure it's consistent
    setLocalTasks((prev) =>
      prev.map((t) => (String(t.id) === String(task.id) ? { ...t, status: newStatus } : t))
    )

    await updateTask.mutateAsync({
      id: task.id,
      projectId: projectId!,
      status: newStatus,
    })
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    if (newDeadline) {
      const selected = new Date(newDeadline)
      const now = new Date()
      if (selected.getTime() < now.getTime()) {
        setDeadlineError('Deadline cannot be in the past')
        return
      }
    }

    setDeadlineError('')
    await createTask.mutateAsync({
      title: newTitle.trim(),
      description: newDescription.trim() ? newDescription.trim() : undefined,
      projectId: projectId!,
      priority: newPriority,
      assigneeId: newAssigneeId === 'EVERYONE' ? undefined : newAssigneeId,
      status: newStatus,
      sprintId: newSprintId === 'NONE' ? null : newSprintId,
      deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
    })
    setNewTitle('')
    setNewDescription('')
    setNewPriority('MEDIUM')
    setNewAssigneeId('EVERYONE')
    setNewDeadline('')
    setNewStatus('TODO')
    setNewSprintId('NONE')
    setCreateOpen(false)
  }

  const prepareCreateTaskDefaults = (status: string) => {
    setNewStatus(status)
    // If user is already filtering by a specific sprint, default to it.
    setNewSprintId(selectedSprintId === 'ALL' ? 'NONE' : selectedSprintId)
  }

  const handleOpenCreateTask = (status: string) => {
    prepareCreateTaskDefaults(status)
    setCreateOpen(true)
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
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="h-9 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!canCreateTask}
                    onClick={() => prepareCreateTaskDefaults('TODO')}
                  >
                    <Plus className="size-4" />
                    Add task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create new task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <Label>Title</Label>
                        <div className="relative">
                          <FolderPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Task title"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            className="h-10 pl-10"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Description</Label>
                        <Input
                          placeholder="What needs to be done?"
                          value={newDescription}
                          onChange={e => setNewDescription(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Priority</Label>
                        <Select value={newPriority} onValueChange={setNewPriority}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="URGENT">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Assign to</Label>
                        <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EVERYONE">Everyone</SelectItem>
                            {(project?.members ?? [])
                              .map((m: any) => m?.user)
                              .filter(Boolean)
                              .map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name ?? u.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COLUMNS.map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Sprint</Label>
                          <Select value={newSprintId} onValueChange={setNewSprintId}>
                            <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">No sprint</SelectItem>
                              {(sprints as any[]).map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label>Deadline</Label>
                        <Input
                          type="datetime-local"
                          className="h-10"
                          value={newDeadline}
                          min={getTodayStartLocalForInput()}
                          onChange={e => {
                            const v = e.target.value
                            if (!v) {
                              setNewDeadline('')
                              setDeadlineError('')
                              return
                            }
                            if (isPastToday(v)) {
                              setDeadlineError('Time cannot be earlier than now for today')
                              return
                            }
                            setDeadlineError('')
                            setNewDeadline(v)
                          }}
                        />
                        {deadlineError && (
                          <p className="text-xs text-red-500">{deadlineError}</p>
                        )}
                      </div>
                      <Button type="submit" className="h-10 w-full" disabled={createTask.isPending}>
                        {createTask.isPending ? 'Creating...' : 'Create task'}
                      </Button>
                    </form>
                </DialogContent>
              </Dialog>

              <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2" disabled={!canManageRoles}>
                    <CalendarPlus className="size-4" />
                    Create Sprint
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create sprint</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSprint} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        className="h-10"
                        placeholder="Sprint name"
                        value={sprintName}
                        onChange={(e) => setSprintName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Goal</Label>
                      <Input
                        className="h-10"
                        placeholder="What are we aiming to deliver?"
                        value={sprintGoal}
                        onChange={(e) => setSprintGoal(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Start date</Label>
                        <Input
                          type="datetime-local"
                          className="h-10"
                          value={sprintStart}
                          min={getTodayStartLocalForInput()}
                          onChange={(e) => setSprintStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>End date</Label>
                        <Input
                          type="datetime-local"
                          className="h-10"
                          value={sprintEnd}
                          min={sprintStart || getTodayStartLocalForInput()}
                          onChange={(e) => setSprintEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    {sprintError && (
                      <p className="text-xs text-red-500">{sprintError}</p>
                    )}
                    <Button
                      type="submit"
                      className="h-10 w-full"
                      disabled={
                        createSprint.isPending ||
                        !sprintName.trim() ||
                        !sprintStart ||
                        !sprintEnd
                      }
                    >
                      {createSprint.isPending ? 'Creating…' : 'Create sprint'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 gap-2"
                    onClick={async () => {
                      const base = window.location.origin
                      const res = await createInvite.mutateAsync()
                      const url = `${base}/invite/${res.code}`
                      setGeneratedInviteUrl(url)
                      setInviteModalOpen(true)
                    }}
                  >
                    <UserPlus className="size-4" />
                    Invite members
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite members to this project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Share this link with teammates. If they don&apos;t have an account yet,
                      they&apos;ll be asked to register first and can then join this project
                      using the same link.
                    </p>
                    <div className="space-y-1">
                      <Label>Invite link</Label>
                      <Input
                        readOnly
                        value={generatedInviteUrl}
                        className="h-10"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
                    <Link to={`/projects/${projectId}/roadmap`}>Roadmap</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/calendar`}>Calendar</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/sprint-report`}>Sprint report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/dashboard`}>Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/projects/${projectId}/members`}>View members</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canManageRoles && project?.status !== 'COMPLETED' && (
                <Button
                  variant="outline"
                  className="h-9 gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to mark this project as completed?')) {
                      await updateProject.mutateAsync({ id: projectId!, data: { status: 'COMPLETED' } })
                    }
                  }}
                  disabled={updateProject.isPending}
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Sprint</p>
                      <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                        <SelectTrigger className="h-9 w-[16rem] rounded-none">
                          <SelectValue placeholder="All tasks" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All tasks</SelectItem>
                          <SelectItem value="NONE">No sprint</SelectItem>
                          {(sprints as any[]).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sprintRangeText && (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={['h-2 w-2 rounded-full', sprintStatusDotClass ?? 'bg-muted-foreground/50'].join(' ')} />
                          <span>{sprintRangeText}</span>
                        </span>
                      )}
                    </div>
                    {selectedSprintId !== 'ALL' && (
                      <p className="text-xs text-muted-foreground">
                        Showing {displayedTasks.length} task{displayedTasks.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
                    <div className="flex min-w-max gap-3">
                    {COLUMNS.map(status => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        tasks={getColumnTasks(status)}
                        onTaskClick={setSelectedTask}
                        onAddTask={handleOpenCreateTask}
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
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}