export function formatUserLogTime(value: string) {
  const date = new Date(value)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return { time, day }
}

export function formatDurationMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function replaceUnderscores(input: string) {
  return input.replace(/_/g, ' ')
}

export function prettyFieldName(field: string) {
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

export function renderTimeLogDetails(event: any) {
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

export function renderNonTimeLogDetails(event: any) {
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

export function renderMetadataFallback(event: any) {
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

export function getEventHeadline(type: string) {
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

export function shouldShowEntityType(type: string, entityType: any) {
  if (typeof entityType !== 'string') return false
  const t = type ?? ''
  if (t === 'PUSH_TO_REPO') return false
  if (entityType === 'TASK') return false
  if (entityType === 'TIME_LOG') return false
  if (entityType === 'PROJECT') return false
  if (t.startsWith('TASK_')) return false
  return true
}
