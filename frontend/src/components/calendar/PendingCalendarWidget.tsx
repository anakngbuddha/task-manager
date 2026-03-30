import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Plus, CalendarDays, Clock } from 'lucide-react'
import { useCreateSchedule, useSchedules, type ScheduleType } from '@/hooks/useSchedules'
import { usePendingDeadlines, type PendingDeadlineItem } from '@/hooks/usePendingDeadlines'
import { useProjects } from '@/hooks/useProjects'

type PendingScheduleItem = {
  kind: 'SCHEDULE'
  id: string
  title: string
  type: ScheduleType
  scheduledAt: string
  location?: string | null
  creator?: { name?: string | null; email: string } | null
  attendeesCount: number
}

function toLocalDateInputValue(d: Date) {
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function toLocalTimeInputValue(d: Date) {
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(11, 16)
}

function localDateTimeToISO(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split('-').map((n) => Number(n))
  const [hh, mm] = timeStr.split(':').map((n) => Number(n))
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0)
  return dt.toISOString()
}

function formatDateTime(s: string) {
  const d = new Date(s)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function scheduleTypeLabel(t: ScheduleType) {
  switch (t) {
    case 'MEETING': return 'Meeting'
    case 'TRAINING': return 'Training'
    case 'REVIEW': return 'Review'
    case 'REMINDER': return 'Reminder'
    case 'OTHER': return 'Event'
  }
}

function scheduleTypeBadgeClass(t: ScheduleType) {
  switch (t) {
    case 'MEETING': return 'bg-blue-500/10 border-blue-500/20 text-blue-700'
    case 'TRAINING': return 'bg-violet-500/10 border-violet-500/20 text-violet-700'
    case 'REVIEW': return 'bg-amber-500/10 border-amber-500/20 text-amber-700'
    case 'REMINDER': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
    case 'OTHER': return 'bg-slate-500/10 border-slate-500/20 text-slate-700'
  }
}

export function PendingCalendarWidget({ variant = 'sidebar' }: { variant?: 'sidebar' | 'page' }) {
  const now = useMemo(() => new Date(), [])
  const schedulesFrom = useMemo(() => now.toISOString(), [now])
  const schedulesTo = useMemo(() => new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), [now])

  const { data: schedules, isLoading: isSchedulesLoading } = useSchedules({ from: schedulesFrom, to: schedulesTo })
  const { data: deadlines, isLoading: isDeadlinesLoading } = usePendingDeadlines({ daysAhead: 14, limit: 12 })
  const { data: projects = [] } = useProjects()

  const items = useMemo(() => {
    const sched: PendingScheduleItem[] = (schedules ?? []).map((s: any) => ({
      kind: 'SCHEDULE',
      id: s.id,
      title: s.title,
      type: s.type,
      scheduledAt: s.scheduledAt,
      location: s.location,
      creator: s.creator ?? null,
      attendeesCount: Array.isArray(s.attendees) ? s.attendees.length : 0,
    }))

    const dl = (deadlines ?? []) as PendingDeadlineItem[]

    const combined: Array<PendingScheduleItem | PendingDeadlineItem> = [...sched, ...dl]
    combined.sort((a: any, b: any) => new Date(a.scheduledAt ?? a.deadline).getTime() - new Date(b.scheduledAt ?? b.deadline).getTime())

    return combined.slice(0, 12)
  }, [schedules, deadlines])

  const { mutateAsync: createSchedule, isPending: isCreating } = useCreateSchedule()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ScheduleType>('MEETING')
  const initialStart = useMemo(() => new Date(Date.now() + 60 * 60 * 1000), [])
  const [formDate, setFormDate] = useState(() => toLocalDateInputValue(initialStart))
  const [formStartTime, setFormStartTime] = useState(() => toLocalTimeInputValue(initialStart))
  const [formEndTime, setFormEndTime] = useState(() => toLocalTimeInputValue(new Date(initialStart.getTime() + 30 * 60 * 1000)))
  const [details, setDetails] = useState('')
  const [location, setLocation] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [attendeeEmails, setAttendeeEmails] = useState('')

  const dialogTitle = variant === 'page' ? 'Create schedule' : 'Add to calendar'

  const maxHeightCls = variant === 'sidebar' ? 'max-h-[360px]' : 'max-h-[650px]'

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    if (!formDate || !formStartTime || !formEndTime) return
    const scheduledAtISO = localDateTimeToISO(formDate, formStartTime)
    const endAtISO = localDateTimeToISO(formDate, formEndTime)
    const scheduledAt = new Date(scheduledAtISO)
    const endAt = new Date(endAtISO)
    if (Number.isNaN(scheduledAt.getTime()) || Number.isNaN(endAt.getTime())) return
    if (scheduledAt.getTime() <= Date.now()) return
    if (endAt.getTime() <= scheduledAt.getTime()) return

    const emails = attendeeEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)

    const payload = {
      title: trimmedTitle,
      type,
      scheduledAt: scheduledAt.toISOString(),
      endAt: endAt.toISOString(),
      details: details.trim() || undefined,
      location: location.trim() || undefined,
      projectId: projectId || undefined,
      attendees: emails.length ? emails.map((email) => ({ email })) : undefined,
    }

    await createSchedule(payload as any)
    setOpen(false)
    setTitle('')
    setDetails('')
    setLocation('')
    setAttendeeEmails('')
    setProjectId('')
  }

  return (
    <div className={cn('space-y-3', variant === 'sidebar' ? '' : 'w-full')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Pending</p>
          <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
            {items.length}
          </Badge>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-none"
              disabled={isCreating}
            >
              <Plus className="size-4" />
              <span className="ml-1">{variant === 'sidebar' ? 'Add' : 'Schedule'}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className={cn('sm:max-w-xl', 'rounded-none')}>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 gap-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint review" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid grid-cols-1 gap-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ScheduleType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                      <SelectItem value="TRAINING">Training</SelectItem>
                      <SelectItem value="REVIEW">Review</SelectItem>
                      <SelectItem value="REMINDER">Reminder</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  <Label>When</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="rounded-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Start</Label>
                        <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="rounded-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">End</Label>
                        <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="rounded-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <Label>Project (optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Personal / no project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <Label>Location (optional)</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Zoom link / Room 3B" />
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <Label>Details (optional)</Label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add any agenda / notes..."
                  className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <Label>Attendees emails (optional)</Label>
                <Input
                  value={attendeeEmails}
                  onChange={(e) => setAttendeeEmails(e.target.value)}
                  placeholder="comma separated, e.g. a@x.com, b@x.com"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={isCreating}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isCreating}>
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className={cn(
        'rounded-lg border border-border/60 bg-background/50 px-3 py-3',
        maxHeightCls,
        variant === 'sidebar' ? 'overflow-auto' : 'overflow-auto',
      )}>
        {(isSchedulesLoading || isDeadlinesLoading) ? (
          <div className="text-sm text-muted-foreground flex items-center justify-center py-6">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground flex items-center justify-center py-6">
            No upcoming pending items.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it: any) => {
              const scheduledAt = it.kind === 'SCHEDULE' ? it.scheduledAt : it.deadline

              return (
                <div key={`${it.kind}:${it.id}`} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {it.kind === 'SCHEDULE' ? (
                        <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', scheduleTypeBadgeClass(it.type))}>
                          {scheduleTypeLabel(it.type)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.7rem]">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            Deadline
                          </span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-medium truncate">{it.title}</div>
                    {it.kind === 'SCHEDULE' && it.location ? (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{it.location}</div>
                    ) : null}
                    {it.kind === 'SCHEDULE' && typeof it.creator?.name === 'string' ? (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">By {it.creator.name}</div>
                    ) : null}
                    {it.kind === 'SCHEDULE' ? (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {it.attendeesCount} attendee{it.attendeesCount === 1 ? '' : 's'}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{it.project.name}</div>
                    )}
                  </div>

                  <div className="shrink-0 text-[0.75rem] text-muted-foreground tabular-nums">
                    {formatDateTime(String(scheduledAt))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

