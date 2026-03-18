import { Fragment, useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useTaskComments, useAddTaskComment } from '@/hooks/useTaskComments'
import { Pencil, X } from 'lucide-react'

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

export default function TaskDialog({ task, projectId, projectMembers, open, onClose }: {
  task: any
  projectId: string
  projectMembers: any[]
  open: boolean
  onClose: () => void
}) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [deadline, setDeadline] = useState<string>('')
  const [deadlineError, setDeadlineError] = useState('')
  const [newComment, setNewComment] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)

  const { data: comments = [] } = useTaskComments(task?.id)
  const addComment = useAddTaskComment()

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
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '')
      setNewComment('')
      setReplyToId(null)
      setReplyContent({})
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
      deadline: deadline ? new Date(deadline).toISOString() : null,
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
    </Dialog>
  )
}