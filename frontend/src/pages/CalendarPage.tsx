import { useMemo, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import { useSchedules, useCreateSchedule, type ScheduleType, type Schedule } from '@/hooks/useSchedules'
import { usePendingDeadlines, type PendingDeadlineItem } from '@/hooks/usePendingDeadlines'
import { useProjects } from '@/hooks/useProjects'

function toLocalInput(d: Date) {
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  MEETING: 'Meeting', TRAINING: 'Training', REVIEW: 'Review', REMINDER: 'Reminder', OTHER: 'Event',
}

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  MEETING: 'bg-blue-500/15 border-blue-500/25 text-blue-700',
  TRAINING: 'bg-violet-500/15 border-violet-500/25 text-violet-700',
  REVIEW: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
  REMINDER: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-700',
  OTHER: 'bg-slate-500/15 border-slate-500/25 text-slate-700',
}

type CalendarItem = {
  id: string
  title: string
  kind: 'SCHEDULE' | 'DEADLINE'
  type?: ScheduleType
  date: Date
  status?: string
}

type PendingCombinedItem =
  | (Schedule & { kind: 'SCHEDULE'; sortDate: Date })
  | (PendingDeadlineItem & { kind: 'DEADLINE'; sortDate: Date })

export default function CalendarPage() {
  const [tab, setTab] = useState<'calendar' | 'pending'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [createOpen, setCreateOpen] = useState(false)

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

  const { daysInMonth, firstDayOfMonth, monthName, year } = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    return {
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      firstDayOfMonth: new Date(y, m, 1).getDay(),
      monthName: currentDate.toLocaleDateString(undefined, { month: 'long' }),
      year: y,
    }
  }, [currentDate])

  const monthStart = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate])
  const monthEnd = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59), [currentDate])

  const { data: schedules = [] } = useSchedules({
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
  })

  const { data: deadlines = [] } = usePendingDeadlines({ daysAhead: 60, limit: 100 })
  const { data: projects = [] } = useProjects()

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = []
    for (const s of schedules) {
      items.push({
        id: s.id,
        title: s.title,
        kind: 'SCHEDULE',
        type: s.type,
        date: new Date(s.scheduledAt),
      })
    }
    for (const d of deadlines) {
      const date = new Date(d.deadline)
      if (date >= monthStart && date <= monthEnd) {
        items.push({
          id: d.id,
          title: d.title,
          kind: 'DEADLINE',
          date,
          status: d.status,
        })
      }
    }
    return items
  }, [schedules, deadlines, monthStart, monthEnd])

  const calendarDays = useMemo(() => {
    const days: { date: Date | null; items: CalendarItem[] }[] = []
    for (let i = 0; i < firstDayOfMonth; i++) days.push({ date: null, items: [] })
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, currentDate.getMonth(), i)
      const dayItems = calendarItems.filter(it => isSameDay(it.date, d))
      days.push({ date: d, items: dayItems })
    }
    while (days.length % 7 !== 0) days.push({ date: null, items: [] })
    return days
  }, [daysInMonth, firstDayOfMonth, year, currentDate, calendarItems])

  const today = new Date()

  const pendingItems = useMemo(() => {
    const now = new Date()
    const sched: PendingCombinedItem[] = schedules
      .filter((s: Schedule) => new Date(s.scheduledAt).getTime() > now.getTime())
      .map((s: Schedule) => ({ ...s, kind: 'SCHEDULE' as const, sortDate: new Date(s.scheduledAt) }))
    const dl: PendingCombinedItem[] = deadlines.map((d) => ({
      ...d,
      kind: 'DEADLINE' as const,
      sortDate: new Date(d.deadline),
    }))
    const combined = [...sched, ...dl]
    combined.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    return combined
  }, [schedules, deadlines])

  // Create schedule form state
  const { mutateAsync: createSchedule, isPending: isCreating } = useCreateSchedule()
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<ScheduleType>('MEETING')
  const [formWhen, setFormWhen] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)))
  const [formDetails, setFormDetails] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formProjectId, setFormProjectId] = useState('__none__')
  const [formAttendees, setFormAttendees] = useState('')
  const [formError, setFormError] = useState('')

  const resetForm = () => {
    setFormTitle('')
    setFormType('MEETING')
    setFormWhen(toLocalInput(new Date(Date.now() + 3600_000)))
    setFormDetails('')
    setFormLocation('')
    setFormProjectId('__none__')
    setFormAttendees('')
    setFormError('')
  }

  const handleCreate = async () => {
    setFormError('')
    const t = formTitle.trim()
    if (!t) { setFormError('Title is required.'); return }
    const scheduledAt = new Date(formWhen)
    if (Number.isNaN(scheduledAt.getTime())) { setFormError('Please pick a valid date and time.'); return }
    if (scheduledAt.getTime() <= Date.now()) { setFormError('Date must be in the future.'); return }

    try {
      const emails = formAttendees.split(',').map(e => e.trim()).filter(Boolean)
      await createSchedule({
        title: t,
        type: formType,
        scheduledAt: scheduledAt.toISOString(),
        details: formDetails.trim() || undefined,
        location: formLocation.trim() || undefined,
        projectId: formProjectId !== '__none__' ? formProjectId : undefined,
        attendees: emails.length ? emails.map(email => ({ email })) : undefined,
      })
      setCreateOpen(false)
      resetForm()
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Failed to create schedule.')
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background flex flex-col">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Calendar</span>}
          title="Calendar"
          subtitle="Schedules and upcoming task deadlines."
          actions={
            <div className="flex items-center gap-3">
              {tab === 'calendar' && (
                <div className="flex items-center bg-card rounded-md border shadow-sm">
                  <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 p-0"><ChevronLeft className="size-4" /></Button>
                  <span className="text-sm font-semibold w-36 text-center">{monthName} {year}</span>
                  <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 p-0"><ChevronRight className="size-4" /></Button>
                </div>
              )}
              <Button className="h-9 gap-2 rounded-none" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Schedule
              </Button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="border-b px-6 sm:px-8">
          <div className="flex gap-0">
            <button
              onClick={() => setTab('calendar')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === 'calendar'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Calendar
            </button>
            <button
              onClick={() => setTab('pending')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                tab === 'pending'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Pending
              {pendingItems.length > 0 && (
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.65rem]">
                  {pendingItems.length}
                </Badge>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {tab === 'calendar' ? (
            <div className="flex-1 flex flex-col h-full p-4 sm:p-6">
              <div className="flex-1 bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-7 border-b bg-muted/30">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r last:border-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7 overflow-y-auto auto-rows-[minmax(110px,1fr)]">
                  {calendarDays.map((cell, idx) => {
                    const isToday = cell.date && isSameDay(cell.date, today)
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'p-1.5 border-r border-b bg-background hover:bg-muted/10 transition-colors flex flex-col gap-0.5',
                          !cell.date && 'bg-muted/5',
                        )}
                      >
                        {cell.date && (
                          <div className="flex justify-between items-start mb-0.5">
                            <span className={cn(
                              'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                              isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                            )}>
                              {cell.date.getDate()}
                            </span>
                          </div>
                        )}
                        {cell.items.map(it => (
                          <div
                            key={`${it.kind}:${it.id}`}
                            className={cn(
                              'text-[0.65rem] leading-tight px-1.5 py-0.5 rounded border truncate font-medium',
                              it.kind === 'SCHEDULE'
                                ? SCHEDULE_TYPE_COLOR[it.type!]
                                : it.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-700'
                                  : 'bg-red-500/10 border-red-500/20 text-red-700',
                            )}
                            title={`${it.kind === 'SCHEDULE' ? SCHEDULE_TYPE_LABEL[it.type!] : 'Deadline'}: ${it.title}`}
                          >
                            {it.kind === 'DEADLINE' && '⏰ '}{it.title}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Pending tab */
            <div className="p-4 sm:p-6 max-w-3xl">
              {pendingItems.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  No upcoming schedules or task deadlines.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingItems.map((it: any) => {
                    const dateStr = it.kind === 'SCHEDULE'
                      ? new Date(it.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                      : new Date(it.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

                    return (
                      <div key={`${it.kind}:${it.id}`} className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {it.kind === 'SCHEDULE' ? (
                              <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_TYPE_COLOR[it.type as ScheduleType])}>
                                {SCHEDULE_TYPE_LABEL[it.type as ScheduleType]}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.7rem] gap-1">
                                <Clock className="size-3" />
                                Deadline
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{it.title}</p>
                          {it.kind === 'SCHEDULE' && it.location && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{it.location}</p>
                          )}
                          {it.kind === 'DEADLINE' && it.project && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{it.project.name}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground tabular-nums pt-1">
                          {dateStr}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create schedule dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-xl rounded-none">
            <DialogHeader>
              <DialogTitle>Create schedule</DialogTitle>
              <DialogDescription>Add a new meeting, reminder, or event to your calendar.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Sprint review" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={v => setFormType(v as ScheduleType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                      <SelectItem value="TRAINING">Training</SelectItem>
                      <SelectItem value="REVIEW">Review</SelectItem>
                      <SelectItem value="REMINDER">Reminder</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>When</Label>
                  <Input type="datetime-local" value={formWhen} onChange={e => setFormWhen(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Project (optional)</Label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger><SelectValue placeholder="Personal / no project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location (optional)</Label>
                <Input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. Zoom link / Room 3B" />
              </div>
              <div className="space-y-1.5">
                <Label>Details (optional)</Label>
                <textarea
                  value={formDetails}
                  onChange={e => setFormDetails(e.target.value)}
                  placeholder="Add any agenda / notes..."
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Attendees emails (optional)</Label>
                <Input
                  value={formAttendees}
                  onChange={e => setFormAttendees(e.target.value)}
                  placeholder="comma separated, e.g. a@x.com, b@x.com"
                />
              </div>
              {formError && (
                <p className="text-xs text-destructive -mt-1">{formError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setCreateOpen(false); resetForm() }} disabled={isCreating}>Cancel</Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create schedule'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
