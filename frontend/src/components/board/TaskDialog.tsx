import { Fragment, useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTasks, useUpdateTask, useDeleteTask, useCreateTaskDependency, useDeleteTaskDependency, useCreateTask } from '@/hooks/useTasks'
import { useSprints } from '@/hooks/useSprints'
import { useProject } from '@/hooks/useProject'
import { useTaskComments, useAddTaskComment } from '@/hooks/useTaskComments'
import { Pencil, X, Clock, Link as LinkIcon, ExternalLink, GitBranch, Loader2, GitCommit, GitPullRequest, GitMerge, Plus, AlertCircle } from 'lucide-react'
import { useCreateTaskTimeLog } from '@/hooks/useTimeLogs'
import { useSession } from '@/lib/auth-client'
import {
  useTaskGithubLinks,
  useAddTaskGithubLink,
  useRemoveTaskGithubLink,
  type TaskGithubLink,
} from '@/hooks/useTaskGithubLinks'
import TagInput from '@/components/board/TagInput'
import { useTaskTags } from '@/hooks/useTaskTags'
import { FileExplorerDialog } from '@/components/files/FileExplorerDialog'
import { useTaskAttachments, useLinkTaskAttachment, useUnlinkTaskAttachment, type FileNode } from '@/hooks/useFiles'
import { TASK_TYPE_CONFIG, VALID_PARENT_TYPES } from '@/lib/taskTypes'
import type { TaskType } from '@/lib/taskTypes'
import { useOfflineToast } from '@/components/ui/OfflineToast'

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url
  } catch { /* invalid URL */ }
  return '#'
}

const statusLabel: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  READY: 'Ready',
}

const statusBadge: Record<string, string> = {
  TODO: 'bg-[oklch(0.96_0.01_245)] text-[oklch(0.22_0.04_250)]',
  IN_PROGRESS: 'bg-[oklch(0.94_0.03_192)] text-[oklch(0.22_0.04_250)]',
  IN_REVIEW: 'bg-[oklch(0.96_0.02_95)] text-[oklch(0.22_0.04_250)]',
  DONE: 'bg-[oklch(0.95_0.03_150)] text-[oklch(0.22_0.04_250)]',
  READY: 'bg-[oklch(0.95_0.02_40)] text-[oklch(0.22_0.04_250)]',
}

const priorityBadge: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

function getCurrentStartLocalForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function isPastTime(value: string) {
  const selected = new Date(value)
  const now = new Date()
  return selected.getTime() < now.getTime()
}

function getTodayLocalDateForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

function normalizeStatus(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '_')
}

export default function TaskDialog({ task, projectId, projectMembers, open, onClose }: {
  task: any
  projectId: string
  projectMembers: any[]
  open: boolean
  onClose: () => void
}) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createTask = useCreateTask()
  const createTimeLog = useCreateTaskTimeLog(projectId)
  const { data: session } = useSession()
  const { showToast } = useOfflineToast()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [customStatus, setCustomStatus] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('')
  const [sprintId, setSprintId] = useState<string>('NONE')
  const [deadline, setDeadline] = useState<string>('')
  const [deadlineError, setDeadlineError] = useState('')
  const [newComment, setNewComment] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)

  const [logOpen, setLogOpen] = useState(false)
  const [logHours, setLogHours] = useState<string>('0')
  const [logMinutes, setLogMinutes] = useState<string>('30')
  const [logTitle, setLogTitle] = useState('')
  const [logDescription, setLogDescription] = useState('')
  const [logDate, setLogDate] = useState(getTodayLocalDateForInput())
  const [logError, setLogError] = useState('')
  const [githubPrUrl, setGithubPrUrl] = useState('')
  const [taskTypeEdit, setTaskTypeEdit] = useState<TaskType>('TASK')
  const [openChildTask, setOpenChildTask] = useState<any>(null)
  const typeConfig = TASK_TYPE_CONFIG[((task?.type as TaskType) ?? 'TASK')]

  const { data: comments = [] } = useTaskComments(task?.id)
  const addComment = useAddTaskComment()
  const { data: sprints = [] } = useSprints(projectId)
  const { data: allTasks = [] } = useTasks(projectId)
  const { data: project } = useProject(projectId)
  const createDependency = useCreateTaskDependency()
  const deleteDependency = useDeleteTaskDependency()
  const { data: taskTags = [] } = useTaskTags(task?.id)

  const [depType, setDepType] = useState<'BLOCKS' | 'IS_BLOCKED_BY'>('IS_BLOCKED_BY')
  const [depTargetId, setDepTargetId] = useState<string>('')

  // File System Attachments
  const { data: attachments = [] } = useTaskAttachments(task?.id)
  const linkAttachment = useLinkTaskAttachment()
  const unlinkAttachment = useUnlinkTaskAttachment()
  const [explorerOpen, setExplorerOpen] = useState(false)

  const handlePickFile = async (node: FileNode) => {
    if (!task?.id) return;
    if (node.type === 'FOLDER') {
      alert("Cannot attach a folder directly to a task.");
      return;
    }
    try {
      await linkAttachment.mutateAsync({
        taskId: task.id,
        fileNodeId: node.id,
      });
      setExplorerOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to attach file');
    }
  };

  const selectedSprintName = useMemo(() => {
    const id = task?.sprintId ? String(task.sprintId) : null
    if (!id) return null
    const sprint = (sprints as any[]).find((s) => String(s.id) === id)
    return sprint?.name ?? null
  }, [task?.sprintId, sprints])

  const myProjectRole = useMemo(() => {
    const myId = session?.user?.id
    if (!myId) return null
    const member = (projectMembers ?? []).find((m: any) => {
      const userId = m?.userId ?? m?.user?.id
      return userId === myId
    })
    return member?.role ?? null
  }, [projectMembers, session?.user?.id])
  const canManageTasks = myProjectRole === 'MASTER_ADMIN' || myProjectRole === 'PROJECT_MANAGER'
  const isAssigneeOrEveryone = task?.assignee?.id === session?.user?.id || task?.assigneeId === session?.user?.id || !task?.assigneeId
  const canChangeStatus = canManageTasks || (myProjectRole === 'MEMBER' && isAssigneeOrEveryone)

  const renderWithMentions = (text: string) => {
    if (!text) return null
    const parts = text.split(/(\s+)/)
    return parts.map((part, idx) => {
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span key={idx} className="text-purple-600 font-medium">
            {part}
          </span>
        )
      }
      return <Fragment key={idx}>{part}</Fragment>
    })
  }

  useEffect(() => {
    if (task) {
      setMode('view')
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setStatus(task.status)
      setCustomStatus('')
      setSprintId(task?.sprintId ? String(task.sprintId) : 'NONE')
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '')
      setNewComment('')
      setReplyToId(null)
      setReplyContent({})
      setLogHours('0')
      setLogMinutes('30')
      setLogTitle('')
      setLogDescription('')
      setLogDate(getTodayLocalDateForInput())
      setLogError('')
      setGithubPrUrl(task.githubPrUrl ?? '')
      setTaskTypeEdit((task.type as TaskType) ?? 'TASK')
    }
  }, [task])

  const handleSave = async () => {
    const resolvedStatus = status === '__CUSTOM__' ? normalizeStatus(customStatus) : status
    if (!resolvedStatus) return
    if (deadline) {
      const selected = new Date(deadline)
      const now = new Date()
      if (selected.getTime() < now.getTime()) {
        setDeadlineError('Deadline cannot be in the past')
        return
      }
    }

    setDeadlineError('')

    await updateTask.mutateAsync({
      id: task.id,
      projectId,
      title,
      description,
      priority,
      status: resolvedStatus,
      sprintId: sprintId === 'NONE' ? null : sprintId,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      githubPrUrl: githubPrUrl.trim() || null,
      type: taskTypeEdit,
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteTask.mutateAsync({ id: task.id, projectId })
    onClose()
  }

  const handleInlineTypeChange = async (nextType: TaskType) => {
    if (!task?.id || !projectId || nextType === ((task?.type as TaskType) ?? 'TASK')) return
    const hasChildren = (task?.children?.length ?? 0) > 0
    if (hasChildren && !window.confirm('Changing type may affect child tasks. Are you sure?')) return
    await updateTask.mutateAsync({
      id: task.id,
      projectId,
      type: nextType,
    })
    setTaskTypeEdit(nextType)
  }

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return projectMembers ?? []
    const q = mentionQuery.toLowerCase()
    return (projectMembers ?? []).filter((m: any) => {
      const u = m?.user ?? m
      const label = (u?.name ?? u?.email ?? '').toLowerCase()
      return label.includes(q)
    })
  }, [mentionQuery, projectMembers])

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !task?.id) return
    await addComment.mutateAsync({ taskId: task.id, content: newComment.trim() })
    setNewComment('')
  }

  const handleReplySubmit = async (parentId: string) => {
    const content = replyContent[parentId]?.trim()
    if (!content || !task?.id) return
    await addComment.mutateAsync({ taskId: task.id, content, parentId })
    setReplyContent(prev => ({ ...prev, [parentId]: '' }))
    setReplyToId(null)
  }

  const handleMentionInput = (value: string, isReply?: boolean, parentId?: string) => {
    const atIndex = value.lastIndexOf('@')
    if (atIndex >= 0) {
      const q = value.slice(atIndex + 1)
      setMentionQuery(q)
      setShowMentions(true)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
    if (isReply && parentId) {
      setReplyContent(prev => ({ ...prev, [parentId]: value }))
    } else {
      setNewComment(value)
    }
  }

  const insertMention = (user: any, isReply?: boolean, parentId?: string) => {
    const label = user.name ?? user.email
    if (isReply && parentId) {
      const current = replyContent[parentId] ?? ''
      const atIndex = current.lastIndexOf('@')
      const next =
        atIndex >= 0
          ? `${current.slice(0, atIndex + 1)}${label} `
          : `${current}${label} `
      setReplyContent(prev => ({ ...prev, [parentId]: next }))
    } else {
      const current = newComment
      const atIndex = current.lastIndexOf('@')
      const next =
        atIndex >= 0
          ? `${current.slice(0, atIndex + 1)}${label} `
          : `${current}${label} `
      setNewComment(next)
    }
    setShowMentions(false)
    setMentionQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col rounded-none p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader>
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base">
                  {mode === 'edit' ? 'Edit task' : 'Task details'}
                </DialogTitle>
                {mode === 'view' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${typeConfig.badgeColor} ${typeConfig.textColor}`}>
                        {typeConfig.icon} {typeConfig.label}
                      </span>
                      <h2 className="text-base font-semibold">{task?.title}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    {canChangeStatus ? (
                      <Select
                        value={status}
                        onValueChange={async (newStatus) => {
                          if (newStatus === 'READY' && !canManageTasks) return;
                          setStatus(newStatus);
                          await updateTask.mutateAsync({
                            id: task.id,
                            projectId,
                            status: newStatus,
                          });
                        }}
                      >
                        <SelectTrigger className={`h-6 rounded-none border border-border/60 px-2 py-0.5 text-xs w-auto focus:ring-0 ${statusBadge[status] ?? 'bg-background text-foreground'}`}>
                          <SelectValue>{statusLabel[status] ?? status}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(project?.boardColumns || ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']).map((s: string) => {
                            if (s === 'READY' && !canManageTasks) return null;
                            return <SelectItem key={s} value={s}>{statusLabel[s] ?? s.replace(/_/g, ' ')}</SelectItem>
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`rounded-none border-border/60 px-2 py-0.5 text-xs ${statusBadge[status] ?? ''}`}
                      >
                        {statusLabel[status] ?? status}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`rounded-none border-border/60 px-2 py-0.5 text-xs ${priorityBadge[priority] ?? ''}`}
                    >
                      {priority}
                    </Badge>
                    {selectedSprintName && (
                      <Badge
                        variant="outline"
                        className="rounded-none border-border/60 px-2 py-0.5 text-xs"
                      >
                        Sprint: {selectedSprintName}
                      </Badge>
                    )}
                    {task?.assignee && (
                      <span className="text-xs text-muted-foreground">
                        Assigned to <span className="text-foreground">{task.assignee.name ?? task.assignee.email}</span>
                      </span>
                    )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {mode === 'view' && canManageTasks && (
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => setMode('edit')}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
                {mode === 'view' && canManageTasks && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-none"
                    onClick={handleDelete}
                    disabled={deleteTask.isPending}
                  >
                    {deleteTask.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                )}
                {mode === 'view' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    onClick={() => setLogOpen(true)}
                    disabled={createTimeLog.isPending}
                  >
                    <Clock className="size-4" />
                    Log Time
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-none"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
        {mode === 'view' ? (
          <div className="min-h-0 flex-1 overflow-auto px-5 py-6 space-y-4">
            <div className="grid gap-4">
              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Properties</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Select
                      value={((task?.type as TaskType) ?? 'TASK')}
                      onValueChange={(v) => handleInlineTypeChange(v as TaskType)}
                    >
                      <SelectTrigger className="h-8 w-[220px] rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['EPIC', 'STORY', 'TASK'] as TaskType[]).map((t) => {
                          const cfg = TASK_TYPE_CONFIG[t]
                          return (
                            <SelectItem key={t} value={t}>
                              <span className="flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {task?.parentId && task?.parent && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Parent</span>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline truncate"
                        onClick={() => setOpenChildTask(task.parent)}
                      >
                        {TASK_TYPE_CONFIG[(task.parent.type as TaskType) ?? 'TASK']?.icon} {task.parent.title}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">Title</p>
                <p className="mt-2 text-base font-medium leading-snug">{title}</p>
              </div>

              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {description || 'No description'}
                </p>
              </div>

              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Tags</p>
                <TagInput
                  taskId={task?.id}
                  projectId={projectId}
                  currentTags={taskTags}
                />
              </div>
              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">Deadline</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {task?.deadline ? new Date(task.deadline).toLocaleString() : 'No deadline'}
                </p>
              </div>

              {task?.githubPrUrl && (
                <div className="border border-border/60 bg-card p-5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <svg viewBox="0 0 16 16" className="size-3 fill-current" aria-hidden="true">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    Linked Pull Request
                  </p>
                  <a
                    href={sanitizeUrl(task.githubPrUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {task.githubPrUrl}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              )}

              <TaskGithubLinks taskId={task?.id} projectId={projectId} />

              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1"><LinkIcon className="size-3" /> Dependencies</p>
                <div className="space-y-3">
                  {task?.blockedByTasks?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Blocked By</p>
                      {task.blockedByTasks.map((dep: any) => (
                         <div key={dep.id} className="flex items-center justify-between text-sm bg-muted/30 p-2 border border-border/40">
                           <span className="truncate pr-2">{dep.blockingTask?.title ?? 'Unknown task'}</span>
                           <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => deleteDependency.mutate({ taskId: task.id, depId: dep.id, projectId })}>
                             <X className="size-3" />
                           </Button>
                         </div>
                      ))}
                    </div>
                  )}

                  {task?.blockingTasks?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Blocks</p>
                      {task.blockingTasks.map((dep: any) => (
                         <div key={dep.id} className="flex items-center justify-between text-sm bg-muted/30 p-2 border border-border/40">
                           <span className="truncate pr-2">{dep.blockedTask?.title ?? 'Unknown task'}</span>
                           <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => deleteDependency.mutate({ taskId: task.id, depId: dep.id, projectId })}>
                             <X className="size-3" />
                           </Button>
                         </div>
                      ))}
                    </div>
                  )}

                  {(!task?.blockedByTasks?.length && !task?.blockingTasks?.length) && (
                     <p className="text-xs text-muted-foreground italic mb-2">No dependencies set.</p>
                  )}

                  <div className="flex gap-2 items-center mt-3 pt-3 border-t border-border/40">
                    <Select value={depType} onValueChange={(v: any) => setDepType(v)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs rounded-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IS_BLOCKED_BY">Is blocked by</SelectItem>
                        <SelectItem value="BLOCKS">Blocks</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={depTargetId} onValueChange={setDepTargetId}>
                      <SelectTrigger className="flex-1 h-8 text-xs rounded-none"><SelectValue placeholder="Select task..." /></SelectTrigger>
                      <SelectContent>
                        {allTasks.filter((t: any) => t.id !== task?.id).map((t: any) => (
                           <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      className="h-8 rounded-none px-3 text-xs" 
                      disabled={!depTargetId || createDependency.isPending}
                      onClick={async () => {
                         const result = await createDependency.mutateAsync({ taskId: task.id, targetTaskId: depTargetId, type: depType, projectId })
                         if (result?._queued) {
                           showToast('Dependency added — will sync when you\'re online', 'offline')
                         }
                         setDepTargetId('')
                      }}
                    >
                      {createDependency.isPending ? '...' : 'Add'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3 opacity-70"/>
                  Attachments
                </p>
                <div className="space-y-3">
                  {attachments.length > 0 ? (
                    <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {attachments.map((att: any) => (
                           <div key={att.id} className="flex items-center justify-between text-sm bg-muted/10 p-2.5 border border-border/40 hover:bg-muted/30 transition-colors">
                             <a href={att.fileNode?.fileUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col flex-1 min-w-0">
                                <div className="flex flex-row items-center gap-2">
                                  <span className="font-medium text-blue-600 hover:underline truncate">{att.fileNode?.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-start">Added by {att.fileNode?.user?.name || 'Unknown'}</span>
                             </a>
                             <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 shrink-0" onClick={() => unlinkAttachment.mutate({ attachmentId: att.id, taskId: task?.id })}>
                               <X className="size-3" />
                             </Button>
                           </div>
                       ))}
                    </div>
                  ) : (
                     <p className="text-xs text-muted-foreground italic mb-2">No attachments.</p>
                  )}

                  <div className="mt-3 pt-3 border-t border-border/40">
                    <Button variant="outline" size="sm" className="w-full gap-2 rounded-none" onClick={() => setExplorerOpen(true)}>
                      <Plus className="size-4" />
                      Add Attachment
                    </Button>
                    <FileExplorerDialog 
                      open={explorerOpen} 
                      onClose={() => setExplorerOpen(false)} 
                      onPick={handlePickFile} 
                      projectId={projectId}
                    />
                  </div>
                </div>
              </div>

              {task?.children?.length > 0 && (
              <div className="border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">Child tasks ({task.children.length})</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    {task.children.map((st: any) => {
                      const childType = (st.type as TaskType) ?? 'TASK'
                      const childConfig = TASK_TYPE_CONFIG[childType]
                      return (
                        <button
                          key={st.id}
                          type="button"
                          className="w-full flex items-center justify-between text-sm bg-muted/10 p-2 border border-border/40 hover:bg-muted/20"
                          onClick={() => setOpenChildTask(st)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${childConfig.badgeColor} ${childConfig.textColor}`}>
                              {childConfig.icon} {childConfig.label}
                            </span>
                            <span className="truncate text-left">{st.title}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase rounded-sm px-1.5">
                            {st.status}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>

                  {canManageTasks && (
                    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border/40">
                      <Input 
                        placeholder="What needs to be done?" 
                        className="h-8 text-xs rounded-none" 
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={async (e) => {
                           if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                             e.preventDefault()
                             await createTask.mutateAsync({
                               title: newSubtaskTitle.trim(),
                               description: newSubtaskDescription.trim(),
                               projectId: projectId,
                               status: 'TODO',
                               priority: 'MEDIUM',
                               parentId: task.id,
                               type: 'TASK',
                               sprintId: task?.sprintId ?? null,
                             })
                             setNewSubtaskTitle('')
                             setNewSubtaskDescription('')
                           }
                        }}
                      />
                      <div className="flex gap-2 items-center">
                        <Input 
                          placeholder="Description (optional)" 
                          className="h-8 text-xs rounded-none flex-1" 
                          value={newSubtaskDescription}
                          onChange={(e) => setNewSubtaskDescription(e.target.value)}
                          onKeyDown={async (e) => {
                             if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                               e.preventDefault()
                               const result = await createTask.mutateAsync({
                                 title: newSubtaskTitle.trim(),
                                 description: newSubtaskDescription.trim(),
                                 projectId: projectId,
                                 status: 'TODO',
                                 priority: 'MEDIUM',
                                 parentId: task.id,
                                 type: 'TASK',
                                 sprintId: task?.sprintId ?? null,
                               })
                               if (result?._queued) {
                                 showToast('Subtask created — will sync when you\'re online', 'offline')
                               }
                               setNewSubtaskTitle('')
                               setNewSubtaskDescription('')
                             }
                          }}
                        />
                        <Button 
                          size="sm" 
                          className="h-8 rounded-none px-3 text-xs shrink-0" 
                          disabled={!newSubtaskTitle.trim() || createTask.isPending}
                          onClick={async () => {
                             const result = await createTask.mutateAsync({
                               title: newSubtaskTitle.trim(),
                               description: newSubtaskDescription.trim(),
                               projectId: projectId,
                               status: 'TODO',
                               priority: 'MEDIUM',
                               parentId: task.id,
                               type: 'TASK',
                               sprintId: task?.sprintId ?? null,
                             })
                             if (result?._queued) {
                               showToast('Subtask created — will sync when you\'re online', 'offline')
                             }
                             setNewSubtaskTitle('')
                             setNewSubtaskDescription('')
                          }}
                        >
                          {createTask.isPending ? '...' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            <div className="border border-border/60 bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground mb-3">Comments</p>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Add a comment... Use @ to mention project members."
                    className="h-10 rounded-none"
                    value={newComment}
                    onChange={(e) => handleMentionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleCommentSubmit()
                      }
                    }}
                  />
                  {showMentions && filteredMembers.length > 0 && (
                    <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-auto border bg-background text-sm shadow">
                      {filteredMembers.map((m: any) => {
                        const u = m?.user ?? m
                        return (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center justify-start px-3 py-1.5 text-left hover:bg-accent"
                            onClick={() => insertMention(u)}
                          >
                            {u.name ?? u.email}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="rounded-none"
                  onClick={handleCommentSubmit}
                  disabled={addComment.isPending || !newComment.trim()}
                >
                  {addComment.isPending ? 'Posting...' : 'Post comment'}
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className="text-sm space-y-1 border-t border-border/40 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {c.author?.name ?? c.author?.email ?? 'Unknown'}
                        </span>
                        <span className="text-[0.7rem] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {renderWithMentions(c.content)}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setReplyToId(c.id)
                          setShowMentions(false)
                          setMentionQuery('')
                        }}
                      >
                        Reply
                      </button>

                      {c.replies?.length > 0 && (
                        <div className="mt-2 space-y-2 border-l border-border/40 pl-3">
                          {c.replies.map((r: any) => (
                            <div key={r.id} className="space-y-1 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground">
                                  {r.author?.name ?? r.author?.email ?? 'Unknown'}
                                </span>
                                <span className="text-[0.7rem] text-muted-foreground">
                                  {new Date(r.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-muted-foreground">
                                {renderWithMentions(r.content)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {replyToId === c.id && (
                        <div className="mt-2 space-y-2 pl-3">
                          <div className="relative">
                            <Input
                              placeholder="Write a reply..."
                              className="h-9 rounded-none text-sm"
                              value={replyContent[c.id] ?? ''}
                              onChange={(e) => handleMentionInput(e.target.value, true, c.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  handleReplySubmit(c.id)
                                }
                              }}
                            />
                            {showMentions && filteredMembers.length > 0 && (
                              <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-auto border bg-background text-sm shadow">
                                {filteredMembers.map((m: any) => {
                                  const u = m?.user ?? m
                                  return (
                                    <button
                                      key={u.id}
                                      type="button"
                                      className="flex w-full items-center justify-start px-3 py-1.5 text-left hover:bg-accent"
                                      onClick={() => insertMention(u, true, c.id)}
                                    >
                                      {u.name ?? u.email}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="rounded-none"
                              onClick={() => handleReplySubmit(c.id)}
                              disabled={addComment.isPending || !(replyContent[c.id] ?? '').trim()}
                            >
                              {addComment.isPending ? 'Replying...' : 'Reply'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-none"
                              onClick={() => {
                                setReplyToId(null)
                                setReplyContent(prev => ({ ...prev, [c.id]: '' }))
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-6">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input className="h-10 rounded-none" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input className="h-10 rounded-none" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={taskTypeEdit}
                  onValueChange={(v) => {
                    const hasChildren = task?.children?.length > 0
                    if (hasChildren && !window.confirm('Changing type may affect child tasks. Are you sure?')) return
                    setTaskTypeEdit(v as TaskType)
                  }}
                >
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['EPIC', 'STORY', 'TASK'] as TaskType[]).map((t) => {
                      const cfg = TASK_TYPE_CONFIG[t]
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {VALID_PARENT_TYPES[taskTypeEdit].length === 0 && (
                  <p className="text-[11px] text-muted-foreground">⚡ Epics span multiple sprints</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(project?.boardColumns || ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']).map((s: string) => (
                      <SelectItem key={s} value={s}>{statusLabel[s] ?? s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                    <SelectItem value="__CUSTOM__">Custom status...</SelectItem>
                  </SelectContent>
                </Select>
                {status === '__CUSTOM__' && (
                  <Input
                    className="mt-2 h-10 rounded-none"
                    placeholder="e.g. QA_TESTING"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Sprint</Label>
              <Select value={sprintId} onValueChange={setSprintId}>
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
            <div className="space-y-1">
              <Label>Deadline</Label>
              <Input
                type="datetime-local"
                className="h-10 rounded-none"
                value={deadline}
                min={getCurrentStartLocalForInput()}
                onChange={e => {
                  const v = e.target.value
                  if (!v) {
                    setDeadline('')
                    setDeadlineError('')
                    return
                  }
                  if (isPastTime(v)) {
                    setDeadlineError('Time cannot be earlier than now')
                    return
                  }
                  setDeadlineError('')
                  setDeadline(v)
                }}
              />
              {deadlineError && (
                <p className="text-xs text-red-500">{deadlineError}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>GitHub PR URL</Label>
              <Input
                className="h-10 rounded-none"
                placeholder="https://github.com/owner/repo/pull/123"
                value={githubPrUrl}
                onChange={e => setGithubPrUrl(e.target.value)}
              />
            </div>
            </div>
            <div className="sticky bottom-0 shrink-0 border-t bg-background px-5 py-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => setMode('view')}
                  variant="outline"
                  className="flex-1 rounded-none"
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} className="flex-1 rounded-none" disabled={updateTask.isPending}>
                  {updateTask.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-none"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending || !canManageTasks}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Nested child-task dialog */}
        {openChildTask && (
          <TaskDialog
            task={allTasks.find((t: any) => t.id === openChildTask.id) ?? openChildTask}
            projectId={projectId}
            projectMembers={projectMembers}
            open={!!openChildTask}
            onClose={() => setOpenChildTask(null)}
          />
        )}
      </DialogContent>

      {/* Log time modal */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-md rounded-none p-0" showCloseButton={false}>
          <DialogHeader>
            <div className="border-b px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-base">Log time</DialogTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task?.title ? `for: ${task.title}` : 'for this task'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-none"
                  onClick={() => setLogOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-[20rem] max-h-[70vh] overflow-auto px-5 py-6 space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!task?.id) return

                const h = Number(logHours)
                const m = Number(logMinutes)
                const totalMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)

                if (totalMinutes <= 0) {
                  setLogError('Enter a duration greater than 0')
                  return
                }

                setLogError('')
                const resolvedTitle = logTitle.trim()
                const resolvedDescription = logDescription.trim()
                if (!resolvedTitle) {
                  setLogError('Title is required')
                  return
                }
                if (!resolvedDescription) {
                  setLogError('Description is required')
                  return
                }
                const loggedAt = new Date(`${logDate}T00:00:00`).toISOString()

                await createTimeLog.mutateAsync({
                  taskId: task.id,
                  durationMinutes: totalMinutes,
                  title: resolvedTitle,
                  description: resolvedDescription,
                  loggedAt,
                })

                setLogHours('0')
                setLogMinutes('30')
                setLogTitle('')
                setLogDescription('')
                setLogDate(getTodayLocalDateForInput())
                setLogOpen(false)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-10 rounded-none"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    className="h-10 rounded-none"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  className="h-10 rounded-none"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  className="h-10 rounded-none"
                  placeholder="e.g. API bugfix, Testing, Code review"
                  value={logTitle}
                  onChange={(e) => setLogTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  className="h-10 rounded-none"
                  placeholder="What did you do? (required)"
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                />
              </div>

              {logError && <p className="text-xs text-red-500">{logError}</p>}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-none"
                  onClick={() => setLogOpen(false)}
                  disabled={createTimeLog.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-none"
                  disabled={createTimeLog.isPending}
                >
                  {createTimeLog.isPending ? 'Logging…' : 'Log time'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// ─── GitHub Links (PRs, Commits, Branches) ────────────────────────────────────

const linkTypeIcon: Record<string, typeof GitCommit> = {
  PULL_REQUEST: GitPullRequest,
  COMMIT: GitCommit,
  BRANCH: GitBranch,
  ISSUE: AlertCircle,
}

const linkStatusBadge: Record<string, string> = {
  open: 'bg-green-500/15 text-green-700 border-green-500/30',
  closed: 'bg-red-500/15 text-red-700 border-red-500/30',
  merged: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
}

function TaskGithubLinks({ taskId, projectId: _projectId }: { taskId?: string; projectId: string }) {
  const { data: links = [], isLoading } = useTaskGithubLinks(taskId)
  const addLink = useAddTaskGithubLink()
  const removeLink = useRemoveTaskGithubLink()

  const [showInput, setShowInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!taskId || !urlInput.trim()) return
    setError('')
    try {
      const result = await addLink.mutateAsync({ taskId, url: urlInput.trim() })
      setUrlInput('')
      setShowInput(false)
      if (result.autoTransitionStatus) {
        setError('')
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to add link')
    }
  }

  if (!taskId) return null

  return (
    <div className="border border-border/60 bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
        <svg viewBox="0 0 16 16" className="size-3 fill-current" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        GitHub Links
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : links.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {links.map((link: TaskGithubLink) => {
            const Icon = linkTypeIcon[link.type] ?? LinkIcon
            const statusCls = link.status ? linkStatusBadge[link.status] : ''
            return (
              <div
                key={link.id}
                className="flex items-center justify-between text-sm bg-muted/30 p-2.5 border border-border/40"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {link.type === 'PULL_REQUEST' && link.status === 'merged' ? (
                    <GitMerge className="size-3.5 text-purple-600 shrink-0" />
                  ) : (
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {link.title ? (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium truncate hover:underline text-foreground"
                        >
                          {link.number ? `#${link.number} ` : ''}
                          {link.title}
                        </a>
                      ) : (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs truncate hover:underline text-primary"
                        >
                          {link.url}
                        </a>
                      )}
                      {link.status && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 rounded-sm shrink-0 border ${statusCls}`}
                        >
                          {link.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {link.repoFullName && (
                        <span className="text-[10px] text-muted-foreground">{link.repoFullName}</span>
                      )}
                      {link.author && (
                        <span className="text-[10px] text-muted-foreground">by {link.author}</span>
                      )}
                      {link.sha && (
                        <code className="text-[10px] text-muted-foreground font-mono">{link.sha}</code>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => removeLink.mutate({ taskId: taskId!, linkId: link.id })}
                  disabled={removeLink.isPending}
                >
                  <X className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic mb-3">
          No GitHub links. Link a PR, commit, or branch to track it.
        </p>
      )}

      {showInput ? (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <Input
            placeholder="https://github.com/owner/repo/pull/123"
            className="h-8 text-xs rounded-none font-mono"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setError('') }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { setShowInput(false); setUrlInput(''); setError('') }
            }}
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">
            Paste a GitHub URL — pull request, commit, branch, or issue. PRs are auto-detected and can move the task status.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 rounded-none px-3 text-xs"
              disabled={!urlInput.trim() || addLink.isPending}
              onClick={handleAdd}
            >
              {addLink.isPending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Plus className="size-3 mr-1" />
              )}
              Add Link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-none px-3 text-xs"
              onClick={() => { setShowInput(false); setUrlInput(''); setError('') }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-none text-xs gap-1.5"
          onClick={() => setShowInput(true)}
        >
          <Plus className="size-3" />
          Link GitHub URL
        </Button>
      )}
    </div>
  )
}