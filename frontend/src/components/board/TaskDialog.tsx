import { Fragment, useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTasks, useUpdateTask, useDeleteTask, useCreateTaskDependency, useDeleteTaskDependency } from '@/hooks/useTasks'
import { useSprints } from '@/hooks/useSprints'
import { useTaskComments, useAddTaskComment } from '@/hooks/useTaskComments'
import { Pencil, X, Clock, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { useCreateTaskTimeLog } from '@/hooks/useTimeLogs'

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

function getTodayLocalDateForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
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
  const createTimeLog = useCreateTaskTimeLog(projectId)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
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
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState(getTodayLocalDateForInput())
  const [logError, setLogError] = useState('')
  const [githubPrUrl, setGithubPrUrl] = useState('')

  const { data: comments = [] } = useTaskComments(task?.id)
  const addComment = useAddTaskComment()
  const { data: sprints = [] } = useSprints(projectId)
  const { data: allTasks = [] } = useTasks(projectId)
  const createDependency = useCreateTaskDependency()
  const deleteDependency = useDeleteTaskDependency()

  const [depType, setDepType] = useState<'BLOCKS' | 'IS_BLOCKED_BY'>('IS_BLOCKED_BY')
  const [depTargetId, setDepTargetId] = useState<string>('')

  const selectedSprintName = useMemo(() => {
    const id = task?.sprintId ? String(task.sprintId) : null
    if (!id) return null
    const sprint = (sprints as any[]).find((s) => String(s.id) === id)
    return sprint?.name ?? null
  }, [task?.sprintId, sprints])

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
      setSprintId(task?.sprintId ? String(task.sprintId) : 'NONE')
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '')
      setNewComment('')
      setReplyToId(null)
      setReplyContent({})
      setLogHours('0')
      setLogMinutes('30')
      setLogNote('')
      setLogDate(getTodayLocalDateForInput())
      setLogError('')
      setGithubPrUrl(task.githubPrUrl ?? '')
    }
  }, [task])

  const handleSave = async () => {
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
      status,
      sprintId: sprintId === 'NONE' ? null : sprintId,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      githubPrUrl: githubPrUrl.trim() || null,
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteTask.mutateAsync({ id: task.id, projectId })
    onClose()
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
      <DialogContent className="sm:max-w-2xl rounded-none p-0" showCloseButton={false}>
        <DialogHeader>
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base">
                  {mode === 'edit' ? 'Edit task' : 'Task details'}
                </DialogTitle>
                {mode === 'view' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-none border-border/60 px-2 py-0.5 text-xs ${statusBadge[status] ?? ''}`}
                    >
                      {statusLabel[status] ?? status}
                    </Badge>
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
                )}
              </div>

              <div className="flex items-center gap-2">
                {mode === 'view' && (
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => setMode('edit')}>
                    <Pencil className="size-4" />
                    Edit
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
          <div className="min-h-[28rem] max-h-[72vh] overflow-auto px-5 py-6 space-y-4">
            <div className="grid gap-4">
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
                    href={task.githubPrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {task.githubPrUrl}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              )}

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
                         await createDependency.mutateAsync({ taskId: task.id, targetTaskId: depTargetId, type: depType, projectId })
                         setDepTargetId('')
                      }}
                    >
                      {createDependency.isPending ? '...' : 'Add'}
                    </Button>
                  </div>
                </div>
              </div>
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
          <div className="min-h-[28rem] max-h-[72vh] overflow-auto space-y-4 px-5 py-6">
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
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="READY">Ready</SelectItem>
                  </SelectContent>
                </Select>
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
                min={getTodayStartLocalForInput()}
                onChange={e => {
                  const v = e.target.value
                  if (!v) {
                    setDeadline('')
                    setDeadlineError('')
                    return
                  }
                  if (isPastToday(v)) {
                    setDeadlineError('Time cannot be earlier than now for today')
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
            <div className="flex gap-2 pt-2">
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
              <Button variant="destructive" className="rounded-none" onClick={handleDelete} disabled={deleteTask.isPending}>
                Delete
              </Button>
            </div>
          </div>
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
                const note = logNote.trim() ? logNote.trim() : undefined
                const loggedAt = new Date(`${logDate}T00:00:00`).toISOString()

                await createTimeLog.mutateAsync({
                  taskId: task.id,
                  durationMinutes: totalMinutes,
                  note,
                  loggedAt,
                })

                setLogHours('0')
                setLogMinutes('30')
                setLogNote('')
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
                <Label>Note (optional)</Label>
                <Input
                  className="h-10 rounded-none"
                  placeholder="What did you work on?"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
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