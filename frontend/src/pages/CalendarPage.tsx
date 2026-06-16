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
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { Avatar, AvatarGroup, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useSchedules, useCreateSchedule, useRespondScheduleInvite, type ScheduleType, type Schedule } from '@/hooks/useSchedules'
import { usePendingDeadlines, type PendingDeadlineItem } from '@/hooks/usePendingDeadlines'
import { useProjects } from '@/hooks/useProjects'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { TASK_TYPE_CONFIG, type TaskType } from '@/lib/taskTypes'
import { LocationMap } from '@/components/calendar/LocationMap'
import { MapModal } from '@/components/calendar/MapModal'
import { Map as MapIcon } from 'lucide-react'

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
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0) // local time
  return dt.toISOString()
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toDateParamKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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

const SCHEDULE_RESPONSE_LABEL: Record<NonNullable<CalendarItem['response']>, string> = {
  PENDING: 'Not yet accepted',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
}

const SCHEDULE_RESPONSE_SHORT_LABEL: Record<NonNullable<CalendarItem['response']>, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
}

const SCHEDULE_RESPONSE_COLOR: Record<NonNullable<CalendarItem['response']>, string> = {
  PENDING: 'bg-amber-500/15 border-amber-500/30 text-amber-700',
  ACCEPTED: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700',
  DECLINED: 'bg-red-500/15 border-red-500/30 text-red-700',
}

type CalendarItem = {
  id: string
  title: string
  kind: 'SCHEDULE' | 'DEADLINE'
  type?: ScheduleType | string
  date: Date
  status?: string
  response?: 'PENDING' | 'ACCEPTED' | 'DECLINED'
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'calendar' | 'invitations' | 'pending'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [createOpen, setCreateOpen] = useState(false)
  const [viewItem, setViewItem] = useState<CalendarItem | null>(null)
  const [participantsOpen, setParticipantsOpen] = useState(false)

  const { data: session } = useSession()
  const respondInvite = useRespondScheduleInvite()

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

  const { data: deadlines = [] } = usePendingDeadlines({ daysAhead: 3650, daysBehind: 3650, limit: 5000, includeCompleted: true })
  const { data: projects = [] } = useProjects()

  const myUserId = session?.user?.id

  const projectMembers = useMemo(() => {
    const map = new Map<string, { email: string; name?: string | null }>()

    for (const p of projects as any[]) {
      for (const m of p?.members ?? []) {
        const u = m?.user
        const email = u?.email
        if (!email) continue
        map.set(email, { email, name: u?.name ?? null })
      }
    }

    return Array.from(map.values()).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
  }, [projects])

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = []
    for (const s of schedules) {
      const myAttendee = s.attendees?.find((a: any) => a.userId === myUserId)
      const myResponse: CalendarItem['response'] =
        myAttendee?.response ??
        (s.creatorId === myUserId ? 'ACCEPTED' : undefined)

      items.push({
        id: s.id,
        title: s.title,
        kind: 'SCHEDULE',
        type: s.type,
        date: new Date(s.scheduledAt),
        response: myResponse,
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
          type: d.type,
        })
      }
    }
    return items
  }, [schedules, deadlines, monthStart, monthEnd, myUserId])

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
    const sched = schedules
      .filter((s: Schedule) => new Date(s.scheduledAt).getTime() > now.getTime())
      .map((s: Schedule) => ({ ...s, kind: 'SCHEDULE' as const, sortDate: new Date(s.scheduledAt) }))
    const dl = deadlines.map((d: PendingDeadlineItem) => ({ ...d, kind: 'DEADLINE' as const, sortDate: new Date(d.deadline) }))
    const combined = [...sched, ...dl]
    combined.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    return combined
  }, [schedules, deadlines])

  const invitationItems = useMemo(() => {
    if (!myUserId) return []
    const items = schedules
      .map((s: any) => {
        const myAttendee = s.attendees?.find((a: any) => a.userId === myUserId)
        return {
          id: s.id,
          title: s.title,
          type: s.type as ScheduleType,
          scheduledAt: s.scheduledAt,
          location: s.location as string | null,
          response: myAttendee?.response as CalendarItem['response'],
        }
      })
      .filter(it => it.response === 'PENDING')

    items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    return items
  }, [schedules, myUserId])

  // Create schedule form state
  const { mutateAsync: createSchedule, isPending: isCreating } = useCreateSchedule()
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<ScheduleType>('MEETING')
  const initialStart = useMemo(() => new Date(Date.now() + 3600_000), [])
  const [formDate, setFormDate] = useState(() => toLocalDateInputValue(initialStart))
  const [formStartTime, setFormStartTime] = useState(() => toLocalTimeInputValue(initialStart))
  const [formEndTime, setFormEndTime] = useState(() => toLocalTimeInputValue(new Date(initialStart.getTime() + 30 * 60_000)))
  const [formDetails, setFormDetails] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formIsVirtual, setFormIsVirtual] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [formProjectId, setFormProjectId] = useState('__none__')
  const [formAttendees, setFormAttendees] = useState<string[]>([])
  const [attendeeInput, setAttendeeInput] = useState('')
  const [formError, setFormError] = useState('')

  const resetForm = () => {
    setParticipantsOpen(false)
    setFormTitle('')
    setFormType('MEETING')
    const nextStart = new Date(Date.now() + 3600_000)
    setFormDate(toLocalDateInputValue(nextStart))
    setFormStartTime(toLocalTimeInputValue(nextStart))
    setFormEndTime(toLocalTimeInputValue(new Date(nextStart.getTime() + 30 * 60_000)))
    setFormDetails('')
    setFormLocation('')
    setFormIsVirtual(false)
    setFormProjectId('__none__')
    setFormAttendees([])
    setAttendeeInput('')
    setFormError('')
  }

  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const emails = attendeeInput.split(',').map(s => s.trim()).filter(Boolean)
      let hasError = false
      const valid: string[] = []
      for (const email of emails) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setFormError('Invalid email format: ' + email)
          hasError = true
          break
        }
        if (!formAttendees.includes(email)) valid.push(email)
      }
      if (!hasError) {
        setFormAttendees([...formAttendees, ...valid])
        setAttendeeInput('')
        setFormError('')
      }
    } else if (e.key === 'Backspace' && attendeeInput === '' && formAttendees.length > 0) {
      setFormAttendees(formAttendees.slice(0, -1))
    }
  }

  const handleEmailBlur = () => {
    if (!attendeeInput.trim()) return
    const emails = attendeeInput.split(',').map(s => s.trim()).filter(Boolean)
    let hasError = false
    const valid: string[] = []
    for (const email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFormError('Invalid email format: ' + email)
        hasError = true
        break
      }
      if (!formAttendees.includes(email)) valid.push(email)
    }
    if (!hasError) {
      setFormAttendees([...formAttendees, ...valid])
      setAttendeeInput('')
      setFormError('')
    }
  }

  const handleCreate = async () => {
    setFormError('')
    const t = formTitle.trim()
    if (!t) { setFormError('Title is required.'); return }
    if (!formDate || !formStartTime || !formEndTime) {
      setFormError('Please pick a valid start/end time.')
      return
    }

    const scheduledAtISO = localDateTimeToISO(formDate, formStartTime)
    const endAtISO = localDateTimeToISO(formDate, formEndTime)

    const scheduledAt = new Date(scheduledAtISO)
    const endAt = new Date(endAtISO)

    if (Number.isNaN(scheduledAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setFormError('Please pick a valid date and time.')
      return
    }
    if (scheduledAt.getTime() <= Date.now()) { setFormError('Start time must be in the future.'); return }
    if (endAt.getTime() <= scheduledAt.getTime()) { setFormError('End time must be after start time.'); return }

    try {
      await createSchedule({
        title: t,
        type: formType,
        scheduledAt: scheduledAt.toISOString(),
        endAt: endAt.toISOString(),
        details: formDetails.trim() || undefined,
        location: formLocation.trim() || undefined,
        isVirtual: formIsVirtual,
        projectId: formProjectId !== '__none__' ? formProjectId : undefined,
        attendees: formAttendees.length ? formAttendees.map(email => ({ email })) : undefined,
      })
      setCreateOpen(false)
      resetForm()
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Failed to create schedule.')
    }
  }

  return (
    <div className="flex h-dvh">
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
                onClick={() => setTab('invitations')}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                  tab === 'invitations'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Invitations
                {invitationItems.length > 0 && (
                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.65rem]">
                    {invitationItems.length}
                  </Badge>
                )}
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
                        onClick={() => {
                          if (!cell.date) return
                          navigate(`/calendar/day/${toDateParamKey(cell.date)}`)
                        }}
                        className={cn(
                          'p-1.5 border-r border-b bg-background hover:bg-muted/10 transition-colors flex flex-col gap-0.5',
                          cell.date && 'cursor-pointer',
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
                        {cell.items.map(it => {
                          const isPastDue = it.kind === 'SCHEDULE' 
                            ? it.date.getTime() < today.getTime()
                            : it.status !== 'DONE' && it.status !== 'READY' && it.date.getTime() < today.getTime()
                          
                          const isCompleted = it.kind === 'DEADLINE' && (it.status === 'DONE' || it.status === 'READY')

                          return (
                          <div
                            key={`${it.kind}:${it.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewItem(it)
                            }}
                            className={cn(
                              'text-[0.65rem] leading-tight px-1.5 py-0.5 rounded border truncate font-medium cursor-pointer transition-opacity hover:opacity-80',
                              isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 opacity-60 line-through' :
                              isPastDue ? 'bg-muted/50 border-muted-foreground/20 text-muted-foreground opacity-60' :
                              it.kind === 'SCHEDULE'
                                ? SCHEDULE_RESPONSE_COLOR[(it.response ?? 'ACCEPTED') as NonNullable<CalendarItem['response']>]
                                : it.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-700'
                                  : 'bg-red-500/10 border-red-500/20 text-red-700',
                            )}
                            title={
                              it.kind === 'SCHEDULE'
                                ? `${SCHEDULE_TYPE_LABEL[it.type as ScheduleType]}: ${it.title} (${SCHEDULE_RESPONSE_LABEL[(it.response ?? 'ACCEPTED') as NonNullable<CalendarItem['response']>]})${isPastDue ? ' (Past Event)' : ''}`
                                : `${TASK_TYPE_CONFIG[it.type as TaskType]?.label} Deadline: ${it.title}${isCompleted ? ' (Completed)' : isPastDue ? ' (Past Due)' : ''}`
                            }
                          >
                            {it.kind === 'DEADLINE' && <span className="mr-0.5">{TASK_TYPE_CONFIG[it.type as TaskType]?.icon}</span>}
                            {it.title}
                            {it.kind === 'SCHEDULE' && (
                              <span className="ml-1 text-[0.55rem] font-semibold opacity-80">
                                {SCHEDULE_RESPONSE_SHORT_LABEL[(it.response ?? 'ACCEPTED') as NonNullable<CalendarItem['response']>]}
                              </span>
                            )}
                          </div>
                        )})}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : tab === 'invitations' ? (
            <div className="p-4 sm:p-6 max-w-3xl">
              {invitationItems.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  No pending invitations.
                </div>
              ) : (
                <div className="space-y-2">
                  {invitationItems.map((it) => {
                    const dateStr = new Date(it.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

                    return (
                      <div key={it.id} className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_TYPE_COLOR[it.type])}>
                              {SCHEDULE_TYPE_LABEL[it.type]}
                            </Badge>
                            <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_RESPONSE_COLOR.PENDING)}>
                              {SCHEDULE_RESPONSE_LABEL.PENDING}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{it.title}</p>
                          {it.location && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{it.location}</p>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-3">
                          <div className="shrink-0 text-xs text-muted-foreground tabular-nums pt-1">
                            {dateStr}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="rounded-none"
                              disabled={respondInvite.isPending}
                              onClick={() => respondInvite.mutate({ scheduleId: it.id, response: 'DECLINED' })}
                            >
                              Decline
                            </Button>
                            <Button
                              className="rounded-none"
                              disabled={respondInvite.isPending}
                              onClick={() => respondInvite.mutate({ scheduleId: it.id, response: 'ACCEPTED' })}
                            >
                              Accept
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
                      <div key={`${it.kind}:${it.id}`} className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setViewItem({ id: it.id, kind: it.kind, title: it.title, date: it.sortDate, type: it.type })}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {it.kind === 'SCHEDULE' ? (
                              <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_TYPE_COLOR[it.type as ScheduleType])}>
                                {SCHEDULE_TYPE_LABEL[it.type as ScheduleType]}
                              </Badge>
                            ) : (
                              <span className={cn('inline-flex items-center gap-1 text-[0.7rem] font-medium px-2 py-0.5 rounded border', TASK_TYPE_CONFIG[it.type as TaskType]?.textColor, TASK_TYPE_CONFIG[it.type as TaskType]?.badgeColor)}>
                                <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.icon}</span>
                                <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.label}</span>
                              </span>
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
          <DialogContent className="sm:max-w-xl rounded-2xl p-6">
            <DialogHeader className="flex flex-row items-center justify-between pb-2">
              <DialogTitle className="text-lg font-semibold">Create Schedule</DialogTitle>
              {/* Radix Dialog close button is rendered automatically */}
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Sprint review" className="rounded-md" />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={v => setFormType(v as ScheduleType)}>
                    <SelectTrigger className="rounded-md">
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
                <div className="space-y-1.5 min-w-0">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="rounded-md"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="rounded-md px-2"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="rounded-md px-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select value={formProjectId} onValueChange={setFormProjectId}>
                    <SelectTrigger className="rounded-md"><SelectValue placeholder="No project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Location</Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" className="rounded border-input focus:ring-primary accent-primary" checked={formIsVirtual} onChange={e => setFormIsVirtual(e.target.checked)} />
                      Virtual Meeting
                    </label>
                  </div>
                  {formIsVirtual ? (
                    <Input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. Zoom link" className="rounded-md" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. 123 Main St" className="rounded-md flex-1" />
                      <Button type="button" variant="secondary" onClick={() => setMapModalOpen(true)} className="shrink-0 rounded-md px-3">
                        <MapIcon className="size-4 mr-1.5" />
                        Map
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={formDetails}
                  onChange={e => setFormDetails(e.target.value)}
                  placeholder="Add any agenda / notes..."
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Attendees</Label>
                <div className="relative flex flex-wrap min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  {formAttendees.map((email, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-normal h-6">
                      {email}
                      <button
                        type="button"
                        onClick={() => setFormAttendees(formAttendees.filter(e => e !== email))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[200px]"
                    placeholder={formAttendees.length === 0 ? "comma separated, e.g. a@x.com, b@x.com" : ""}
                    value={attendeeInput}
                    onChange={e => {
                      setAttendeeInput(e.target.value)
                      setFormError('')
                    }}
                    onKeyDown={handleEmailInputKeyDown}
                    onBlur={handleEmailBlur}
                  />
                  
                  {formAttendees.length === 0 && (
                    <div 
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setParticipantsOpen(true)}
                      title="Add project members"
                    >
                      <AvatarGroup>
                        <Avatar size="sm"><AvatarImage src="https://i.pravatar.cc/100?img=1" /><AvatarFallback>A</AvatarFallback></Avatar>
                        <Avatar size="sm"><AvatarImage src="https://i.pravatar.cc/100?img=2" /><AvatarFallback>B</AvatarFallback></Avatar>
                        <Avatar size="sm"><AvatarImage src="https://i.pravatar.cc/100?img=3" /><AvatarFallback>C</AvatarFallback></Avatar>
                        <Avatar size="sm"><AvatarImage src="https://i.pravatar.cc/100?img=4" /><AvatarFallback>D</AvatarFallback></Avatar>
                      </AvatarGroup>
                    </div>
                  )}
                </div>
                {formAttendees.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setParticipantsOpen(true)}
                    >
                      Browse members
                    </Button>
                  </div>
                )}
              </div>

              {formError && (
                <p className="text-xs text-destructive">{formError}</p>
              )}
              
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-md" onClick={() => { setCreateOpen(false); resetForm() }} disabled={isCreating}>Cancel</Button>
                <Button className="rounded-md bg-teal-600 hover:bg-teal-700 text-primary-foreground" onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Participants modal (schedule create) */}
        <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
          <DialogContent className="sm:max-w-xl rounded-none">
            <DialogHeader>
              <DialogTitle>Add participants</DialogTitle>
              <DialogDescription>
                Pick members from all projects you are part of. They will be added by email.
              </DialogDescription>
            </DialogHeader>

            {projectMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                You are not a member of any projects yet.
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-auto pr-1 space-y-2">
                {projectMembers.map((m) => {
                  const already = formAttendees.includes(m.email)
                  return (
                    <div key={m.email} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name ?? m.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={already ? 'secondary' : 'outline'}
                        className="rounded-none shrink-0"
                        disabled={already}
                        onClick={() => {
                          setFormAttendees((prev) => (prev.includes(m.email) ? prev : [...prev, m.email]))
                        }}
                      >
                        {already ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setParticipantsOpen(false)} className="rounded-none">
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <MapModal 
          open={mapModalOpen} 
          onOpenChange={setMapModalOpen} 
          onConfirm={setFormLocation} 
        />

        {/* View Details Dialog */}
        <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
          <DialogContent className="sm:max-w-md rounded-none">
            {viewItem && (
              <>
                <DialogHeader>
                  <DialogTitle>{viewItem.title}</DialogTitle>
                  <DialogDescription>
                    {viewItem.kind === 'SCHEDULE' ? 'Calendar Schedule Details' : 'Task Deadline Details'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {viewItem.kind === 'SCHEDULE' && (() => {
                    const s = schedules.find((s: any) => s.id === viewItem.id)
                    if (!s) return null
                    const myResponse = (s.attendees?.find((a: any) => a.userId === myUserId)?.response ?? viewItem.response) as
                      | 'PENDING'
                      | 'ACCEPTED'
                      | 'DECLINED'
                      | undefined
                    return (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground font-medium">Type</span>
                          <Badge variant="secondary" className={cn('rounded-none px-2 py-0', SCHEDULE_TYPE_COLOR[s.type as ScheduleType])}>{SCHEDULE_TYPE_LABEL[s.type as ScheduleType]}</Badge>
                        </div>
                        {myResponse && (
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-muted-foreground font-medium">Your response</span>
                            <Badge variant="secondary" className={cn('rounded-none px-2 py-0', SCHEDULE_RESPONSE_COLOR[myResponse])}>
                              {SCHEDULE_RESPONSE_LABEL[myResponse]}
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground font-medium">When</span>
                          <span>{new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</span>
                        </div>
                        {s.location && (
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-muted-foreground font-medium">Location</span>
                            {!s.isVirtual ? (
                              <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.location)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1 text-right"
                              >
                                {s.location}
                                <MapIcon className="size-3 shrink-0" />
                              </a>
                            ) : (
                              <span>{s.location}</span>
                            )}
                          </div>
                        )}
                        {s.details && (
                          <div className="border-b pb-2">
                            <span className="text-muted-foreground font-medium block mb-1">Details</span>
                            <span className="whitespace-pre-wrap">{s.details}</span>
                          </div>
                        )}
                        {s.attendees && s.attendees.length > 0 && (
                          <div className="border-b pb-2">
                            <span className="text-muted-foreground font-medium block mb-1">Attendees</span>
                            <div className="flex flex-wrap gap-1">
                              {s.attendees.map((a: any) => (
                                <Badge key={a.id} variant="outline" className="rounded-sm font-normal text-xs">{a.email}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.location && !s.isVirtual && (
                          <div className="pt-2">
                            <LocationMap location={s.location} />
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {viewItem.kind === 'DEADLINE' && (() => {
                     const d = deadlines.find((dl: any) => dl.id === viewItem.id)
                     if (!d) return null
                     return (
                       <div className="space-y-3 text-sm">
                         <div className="flex justify-between border-b pb-2">
                           <span className="text-muted-foreground font-medium">Project</span>
                           <span>{d.project?.name ?? 'Unknown'}</span>
                         </div>
                         <div className="flex justify-between border-b pb-2">
                           <span className="text-muted-foreground font-medium">Deadline</span>
                           <span className="text-red-500 font-medium">{new Date(d.deadline).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</span>
                         </div>
                         <div className="flex justify-between border-b pb-2">
                           <span className="text-muted-foreground font-medium">Status</span>
                           <Badge variant="outline" className="rounded-sm font-medium">{d.status}</Badge>
                         </div>
                         <div className="pt-2">
                           <Button className="w-full rounded-none" onClick={() => {
                             navigate(`/projects/${d.project?.id}?taskId=${d.id}`)
                             setViewItem(null)
                           }}>
                             Go to Project Board
                           </Button>
                         </div>
                       </div>
                     )
                  })()}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}
