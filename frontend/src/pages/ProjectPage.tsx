import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    DndContext, PointerSensor, useSensor, useSensors, closestCorners,
    DragOverlay,
  } from '@dnd-kit/core'
  import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import Sidebar from '@/components/layout/Sidebar'
import NotificationBell from '@/components/layout/NotificationBell'
import KanbanColumn from '@/components/board/KanbanColumn'
import TaskCard from '@/components/board/TaskCard'
import TaskDialog from '@/components/board/TaskDialog'
import { useTasks, useUpdateTask, useCreateTask } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProject'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useSession } from '@/lib/auth-client'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderPlus, LayoutGrid, MessageCircle, Plus, UserPlus, ChevronRight } from 'lucide-react'
import { useCreateInvite } from '@/hooks/useInvites'
import { Link } from 'react-router-dom'

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

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: notifData } = useNotifications(20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const { data: tasks = [], isLoading } = useTasks(projectId!)
  const { data: project } = useProject(projectId!)
  const { data: members = [] } = useProjectMembers(projectId!)
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const createInvite = useCreateInvite(projectId!)
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
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('')
  const [localTasks, setLocalTasks] = useState<any[]>([])
  const dragStartRef = useRef<{ id: string; status: string } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }))

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  // Chat rendering moved to dedicated messages page

  const tasksById = useMemo(() => {
    const map = new Map<string, any>()
    for (const t of localTasks) map.set(String(t.id), t)
    return map
  }, [localTasks])

  const getColumnTasks = (status: string) =>
    localTasks.filter((t: any) => t.status === status)

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
      deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
    })
    setNewTitle('')
    setNewDescription('')
    setNewPriority('MEDIUM')
    setNewAssigneeId('EVERYONE')
    setNewDeadline('')
    setCreateOpen(false)
  }

  const myId = session?.user?.id
  const effectiveMyRole =
    (project?.members ?? []).find((m: any) => m.userId === myId)?.role
    ?? (members ?? []).find((m: any) => m.userId === myId)?.role
  const canManageRoles = effectiveMyRole === 'MASTER_ADMIN' || effectiveMyRole === 'PROJECT_MANAGER'
  const canCreateTask = canManageRoles
  const canMoveToReady = effectiveMyRole === 'MASTER_ADMIN'

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="h-13 px-4 sm:px-6">
            <div className="flex h-full items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutGrid className="size-3.5" />
                    <span className="font-medium">Project Board</span>
                  </span>
                  <ChevronRight className="size-3.5" />
                  <span className="truncate font-medium text-foreground/90">{project?.name ?? 'Tasks'}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">Tasks</h2>
                  <span className="text-xs text-muted-foreground">· Drag & drop to update status</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell
                  notifData={notifData}
                  markAllRead={markAllRead}
                  markRead={markRead}
                  onNavigate={(to) => (to ? window.location.assign(to) : undefined)}
                />

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

                <Link to={`/projects/${projectId}/members`}>
                  <Button variant="outline" className="h-9">
                    View members
                  </Button>
                </Link>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-9 gap-2" disabled={!canCreateTask}>
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
              </div>
            </div>
          </div>
        </header>

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
                  <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
                    <div className="flex min-w-max gap-3">
                    {COLUMNS.map(status => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        tasks={getColumnTasks(status)}
                        onTaskClick={setSelectedTask}
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