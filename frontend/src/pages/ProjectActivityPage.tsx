import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useProjectActivity } from '@/hooks/useProjectActivity'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Clock, Activity } from 'lucide-react'

function formatUserLogTime(value: string) {
  const date = new Date(value)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return { time, day }
}

function formatDurationMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function replaceUnderscores(input: string) {
  return input.replace(/_/g, ' ')
}

function renderTimeLogDetails(event: any) {
  const md = event?.metadata ?? {}

  if (event?.type === 'TIME_LOG_CREATED') {
    const loggedAtIso = md?.loggedAt ?? event?.createdAt
    const loggedAt = loggedAtIso ? formatUserLogTime(String(loggedAtIso)) : null
    const minutes = Number(md?.durationMinutes ?? 0)
    const note = typeof md?.note === 'string' ? md.note : null

    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground/90">Logged work</p>
            <p className="text-sm text-foreground">
              Task: <span className="font-medium">{md?.taskTitle ?? 'Untitled task'}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold text-foreground/90">Duration</p>
            <p className="text-sm font-medium">{formatDurationMinutes(minutes)}</p>
          </div>
        </div>

        {loggedAt && (
          <p className="mt-2 text-muted-foreground">
            {loggedAt.day} · {loggedAt.time} <span className="text-[10px]">(local)</span>
          </p>
        )}

        {note && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{note}</p>}
      </div>
    )
  }

  if (event?.type === 'TIME_LOG_DELETED') {
    const loggedAtIso = md?.loggedAt ?? event?.createdAt
    const loggedAt = loggedAtIso ? formatUserLogTime(String(loggedAtIso)) : null
    const deletedAtIso = md?.deletedAt
    const deletedAt = deletedAtIso ? formatUserLogTime(String(deletedAtIso)) : null
    const minutes = Number(md?.durationMinutes ?? 0)
    const note = typeof md?.note === 'string' ? md.note : null

    return (
      <div className="mt-2 rounded-md bg-destructive/10 p-3 text-xs">
        <p className="text-[11px] font-semibold text-destructive">Time log removed</p>
        <p className="mt-1 text-sm text-foreground">
          Task: <span className="font-medium">{md?.taskTitle ?? 'Untitled task'}</span>
        </p>
        <p className="text-muted-foreground">Duration: {formatDurationMinutes(minutes)}</p>
        {loggedAt && (
          <p className="mt-1 text-muted-foreground">
            Logged: {loggedAt.day} · {loggedAt.time}
          </p>
        )}
        {deletedAt && (
          <p className="text-muted-foreground">
            Deleted: {deletedAt.day} · {deletedAt.time}
          </p>
        )}
        {note && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{note}</p>}
      </div>
    )
  }

  return null
}

function prettyFieldName(field: string) {
  const map: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    status: 'Status',
    priority: 'Priority',
    assigneeId: 'Assignee',
    sprintId: 'Sprint',
    startDate: 'Start date',
    deadline: 'Deadline',
    githubPrUrl: 'GitHub PR URL',
    fields: 'Fields',
  }
  return map[field] ?? replaceUnderscores(field)
}

function renderNonTimeLogDetails(event: any) {
  const md = event?.metadata ?? {}
  const type = event?.type

  if (type === 'TASK_CREATED') {
    const title = md?.title ?? 'Untitled task'
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Task created</p>
        <p className="mt-1 text-sm text-foreground">
          <span className="font-medium">{String(title)}</span>
        </p>
      </div>
    )
  }

  if (type === 'TASK_UPDATED') {
    const fields: unknown = md?.fields
    const list = Array.isArray(fields) ? fields.map((f) => String(f)) : []
    const readable = list.length ? list.map(prettyFieldName).join(', ') : 'Some fields'
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Task updated</p>
        <p className="mt-1 text-sm text-foreground">{readable}</p>
      </div>
    )
  }

  if (type === 'TASK_COMMENT_ADDED') {
    const taskTitle = md?.taskTitle ?? 'a task'
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Comment added</p>
        <p className="mt-1 text-sm text-foreground">On: {String(taskTitle)}</p>
      </div>
    )
  }

  if (type === 'TASK_COMMENT_REPLIED') {
    const taskTitle = md?.taskTitle ?? 'a task'
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Reply added</p>
        <p className="mt-1 text-sm text-foreground">In: {String(taskTitle)}</p>
      </div>
    )
  }

  if (type === 'PROJECT_MESSAGE_SENT') {
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Message sent</p>
        <p className="mt-1 text-sm text-foreground">Project chat</p>
      </div>
    )
  }

  if (type === 'DIRECT_MESSAGE_SENT') {
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Direct message sent</p>
        <p className="mt-1 text-sm text-foreground">Inbox</p>
      </div>
    )
  }

  if (type === 'PR_OPENED' || type === 'PR_MERGED' || type === 'PR_CLOSED') {
    const prTitle = md?.prTitle ? String(md.prTitle) : md?.prUrl ? String(md.prUrl) : null
    const newStatus = md?.newStatus ? prettyFieldName(String(md.newStatus)) : null
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Pull request update</p>
        <p className="mt-1 text-sm text-foreground">{prTitle ?? 'A pull request'}</p>
        {newStatus && <p className="mt-1 text-sm text-muted-foreground">Status: {newStatus}</p>}
      </div>
    )
  }

  if (type === 'PUSH_TO_REPO') {
    const ref = md?.ref ? String(md.ref) : null
    const commits = Number(md?.commits ?? 0)
    const pusher = md?.pusher ? String(md.pusher) : null
    return (
      <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
        <p className="text-[11px] font-semibold text-foreground/90">Repository push</p>
        <p className="mt-1 text-sm text-foreground">
          {ref ? `Ref: ${ref}` : 'Changes pushed'} {pusher ? `· by ${pusher}` : ''}
        </p>
        {commits > 0 && <p className="mt-1 text-sm text-muted-foreground">{commits} commit(s)</p>}
      </div>
    )
  }

  return null
}

function renderMetadataFallback(event: any) {
  const md = event?.metadata ?? {}
  if (!md || typeof md !== 'object') return null
  const keys = Object.keys(md).filter((k) => md[k] != null)
  if (keys.length === 0) return null

  const top = keys.slice(0, 4)
  return (
    <div className="mt-2 rounded-md bg-muted/30 p-3 text-xs">
      <p className="text-[11px] font-semibold text-foreground/90">Details</p>
      <div className="mt-2 space-y-1">
        {top.map((k) => (
          <div key={k} className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground pr-2">{prettyFieldName(String(k))}</span>
            <span className="text-foreground font-medium text-right break-all">
              {typeof md[k] === 'string' ? md[k] : Array.isArray(md[k]) ? md[k].join(', ') : String(md[k])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function getEventHeadline(type: string) {
  const map: Record<string, string> = {
    TASK_CREATED: 'created a task',
    TASK_UPDATED: 'updated a task',
    TASK_COMMENT_ADDED: 'added a comment',
    TASK_COMMENT_REPLIED: 'replied in a comment thread',
    PROJECT_MESSAGE_SENT: 'sent a project message',
    DIRECT_MESSAGE_SENT: 'sent a direct message',
    TIME_LOG_CREATED: 'logged time for a task',
    TIME_LOG_DELETED: 'removed a time log',
    PR_OPENED: 'opened a pull request',
    PR_MERGED: 'merged a pull request',
    PR_CLOSED: 'closed a pull request',
    PUSH_TO_REPO: 'pushed to repository',
  }
  return map[type] ?? type.replace(/_/g, ' ').toLowerCase()
}

function shouldShowEntityType(type: string, entityType: any) {
  if (typeof entityType !== 'string') return false
  const t = type ?? ''
  if (t === 'PUSH_TO_REPO') return false
  if (entityType === 'TASK') return false
  if (entityType === 'TIME_LOG') return false
  if (entityType === 'PROJECT') return false
  // For most events the headline already includes the context.
  if (t.startsWith('TASK_')) return false
  return true
}

export default function ProjectActivityPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: activities = [], isLoading } = useProjectActivity(projectId!)
  const todayKey = new Date().toDateString()
  const timeLogEvents = (activities as any[])
    .filter((e) => e?.type === 'TIME_LOG_CREATED')
    .filter((e) => {
      const md = e?.metadata ?? {}
      const iso = md?.createdAt ?? e?.createdAt
      return iso ? new Date(String(iso)).toDateString() === todayKey : false
    })

  const [visibleLimit, setVisibleLimit] = useState(10)
  const [activeLogEvent, setActiveLogEvent] = useState<any | null>(null)
  const visibleTimeLogEvents = timeLogEvents.slice(0, visibleLimit)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Logs</span>}
          title="Project Logs"
          subtitle="Time logs recorded for this project."
          actions={
            <Button variant="outline" className="h-9 gap-2" asChild>
              <Link to={`/projects/${projectId}`}>
                <ArrowLeft className="size-4" />
                Back to Board
              </Link>
            </Button>
          }
        />
        <div className="h-[calc(100vh-5rem)] overflow-auto px-6 py-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : timeLogEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                <Activity className="mb-4 size-8 opacity-20" />
                <p>No time logs recorded today.</p>
              </div>
            ) : (
              <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-5 before:w-0.5 before:bg-border/60">
                {visibleTimeLogEvents.map((event: any) => {
                  const md = event?.metadata ?? {}
                  const createdAtSource = md?.createdAt ?? event.createdAt
                  const createdAt = createdAtSource ? formatUserLogTime(String(createdAtSource)) : null
                  const minutes = Number(md?.durationMinutes ?? 0)
                  const title =
                    typeof md?.title === 'string' && md.title.trim()
                      ? md.title.trim()
                      : typeof md?.taskTitle === 'string' && md.taskTitle.trim()
                        ? md.taskTitle.trim()
                        : 'Time log'

                  return (
                  <div key={event.id} className="relative flex gap-4 pl-12">
                    <Avatar className="absolute left-0 top-0 size-10 ring-4 ring-background">
                      <AvatarImage src={event.actor.avatar || ''} />
                      <AvatarFallback>{event.actor.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => setActiveLogEvent(event)}
                    >
                    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-2 shadow-sm w-full hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">{event.actor.name}</span>
                        </p>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {createdAt?.time ?? ''}
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Local</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{createdAt?.day ?? ''}</p>
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{formatDurationMinutes(minutes)}</span>{' '}
                        <span className="text-muted-foreground">logged</span>
                      </p>
                      <p className="text-sm font-medium text-foreground/90 truncate">{title}</p>
                    </div>
                    </button>
                  </div>
                )})}
              </div>
            )}

            {timeLogEvents.length > visibleLimit && !isLoading && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setVisibleLimit((v) => v + 10)}
                >
                  Show more
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog
        open={!!activeLogEvent}
        onOpenChange={(open) => {
          if (!open) setActiveLogEvent(null)
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-none max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeLogEvent
                ? (typeof activeLogEvent?.metadata?.title === 'string' && activeLogEvent.metadata.title.trim()
                  ? activeLogEvent.metadata.title.trim()
                  : 'Time log')
                : 'Time log'}
            </DialogTitle>
          </DialogHeader>

          {activeLogEvent && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <p>
                  <span className="text-muted-foreground">Task: </span>
                  <span className="font-medium">
                    {typeof activeLogEvent.metadata?.taskTitle === 'string' && activeLogEvent.metadata.taskTitle.trim()
                      ? activeLogEvent.metadata.taskTitle
                      : 'Untitled task'}
                  </span>
                </p>
                    {typeof activeLogEvent.metadata?.taskId === 'string' && (
                      <p className="text-xs text-muted-foreground break-all">
                        Task ID: {activeLogEvent.metadata.taskId}
                      </p>
                    )}
                <p>
                  <span className="text-muted-foreground">Logged duration: </span>
                  <span className="font-medium">{formatDurationMinutes(Number(activeLogEvent.metadata?.durationMinutes ?? 0))}</span>
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  Time log ID: {typeof activeLogEvent.entityId === 'string' ? activeLogEvent.entityId : activeLogEvent.id}
                </p>
              </div>

              <div className="rounded-md border bg-muted/10 p-3 space-y-2">
                <p>
                  <span className="text-muted-foreground">Created (local): </span>
                  <span className="font-medium">
                    {(() => {
                      const createdIso = activeLogEvent.metadata?.createdAt ?? activeLogEvent.createdAt
                      const t = createdIso ? formatUserLogTime(String(createdIso)) : null
                      return t ? `${t.day} · ${t.time}` : ''
                    })()}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Logged for (local): </span>
                  <span className="font-medium">
                    {(() => {
                      const loggedIso = activeLogEvent.metadata?.loggedAt
                      const t = loggedIso ? formatUserLogTime(String(loggedIso)) : null
                      return t ? `${t.day} · ${t.time}` : ''
                    })()}
                  </span>
                </p>
              </div>

              {typeof activeLogEvent.metadata?.title === 'string' && activeLogEvent.metadata.title.trim() && (
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Title</p>
                  <p className="mt-1 whitespace-pre-wrap">{activeLogEvent.metadata.title}</p>
                </div>
              )}
              {typeof activeLogEvent.metadata?.description === 'string' && activeLogEvent.metadata.description.trim() && (
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{activeLogEvent.metadata.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
