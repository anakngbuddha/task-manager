import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { useRespondScheduleInvite, useScheduleById, useSchedules, type Schedule, type ScheduleType } from '@/hooks/useSchedules'
import { usePendingDeadlines } from '@/hooks/usePendingDeadlines'
import { ArrowLeft, ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react'
import { TASK_TYPE_CONFIG, type TaskType } from '@/lib/taskTypes'
import { LocationMap } from '@/components/calendar/LocationMap'

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function parseDateParamKey(key: string) {
  // Expect YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const yyyy = Number(m[1])
  const mm = Number(m[2])
  const dd = Number(m[3])
  if (!yyyy || !mm || !dd) return null
  return new Date(yyyy, mm - 1, dd)
}

function toDateParamKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function scheduleTypeLabel(t: ScheduleType) {
  switch (t) {
    case 'MEETING':
      return 'Meeting'
    case 'TRAINING':
      return 'Training'
    case 'REVIEW':
      return 'Review'
    case 'REMINDER':
      return 'Reminder'
    case 'OTHER':
      return 'Event'
  }
}

function scheduleTypeBadgeClass(t: ScheduleType) {
  switch (t) {
    case 'MEETING':
      return 'bg-blue-500/10 border-blue-500/20 text-blue-700'
    case 'TRAINING':
      return 'bg-violet-500/10 border-violet-500/20 text-violet-700'
    case 'REVIEW':
      return 'bg-amber-500/10 border-amber-500/20 text-amber-700'
    case 'REMINDER':
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
    case 'OTHER':
      return 'bg-slate-500/10 border-slate-500/20 text-slate-700'
  }
}

const SCHEDULE_RESPONSE_LABEL = {
  PENDING: 'Not yet accepted',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
} as const

const SCHEDULE_RESPONSE_SHORT = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
} as const

const SCHEDULE_RESPONSE_COLOR: Record<keyof typeof SCHEDULE_RESPONSE_LABEL, string> = {
  PENDING: 'bg-amber-500/15 border-amber-500/30 text-amber-700',
  ACCEPTED: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700',
  DECLINED: 'bg-red-500/15 border-red-500/30 text-red-700',
}

type DayViewItem = 
  | (Schedule & { kind: 'SCHEDULE'; sortDate: Date; myResponse?: keyof typeof SCHEDULE_RESPONSE_LABEL })
  | { kind: 'DEADLINE'; sortDate: Date; id: string; title: string; deadline: string; status: string; type: string; project: { id: string; name: string } }

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function DayViewPage() {
  const navigate = useNavigate()
  const { date: dateParam } = useParams() as { date?: string }
  const [searchParams] = useSearchParams()
  const scheduleIdFromQuery = searchParams.get('scheduleId') ?? undefined
  const { data: session } = useSession()
  const myUserId = session?.user?.id
  const respondInvite = useRespondScheduleInvite()

  const paramDayDate = useMemo(() => {
    if (!dateParam) return null
    return parseDateParamKey(dateParam)
  }, [dateParam])

  const { data: scheduleById } = useScheduleById(scheduleIdFromQuery)

  const effectiveDayDate = useMemo(() => {
    if (scheduleById?.scheduledAt) return new Date(scheduleById.scheduledAt)
    return paramDayDate
  }, [scheduleById, paramDayDate])

  const dayRange = useMemo(() => {
    if (!effectiveDayDate) return null
    const start = new Date(effectiveDayDate.getFullYear(), effectiveDayDate.getMonth(), effectiveDayDate.getDate(), 0, 0, 0, 0)
    const end = new Date(effectiveDayDate.getFullYear(), effectiveDayDate.getMonth(), effectiveDayDate.getDate(), 23, 59, 59, 999)
    return { startISO: start.toISOString(), endISO: end.toISOString(), start, end }
  }, [effectiveDayDate])

  const [overviewMonth, setOverviewMonth] = useState<Date>(() => new Date())

  useEffect(() => {
    if (!effectiveDayDate) return
    setOverviewMonth(new Date(effectiveDayDate.getFullYear(), effectiveDayDate.getMonth(), 1))
  }, [effectiveDayDate])

  const { miniDaysInMonth, miniFirstDayOfMonth, miniMonthName, miniYear } = useMemo(() => {
    const d = overviewMonth
    const y = d.getFullYear()
    const m = d.getMonth()
    return {
      miniDaysInMonth: new Date(y, m + 1, 0).getDate(),
      miniFirstDayOfMonth: new Date(y, m, 1).getDay(),
      miniMonthName: d.toLocaleDateString(undefined, { month: 'long' }),
      miniYear: y,
    }
  }, [overviewMonth])

  const miniCalendarCells = useMemo(() => {
    const cells: Array<Date | null> = []
    for (let i = 0; i < miniFirstDayOfMonth; i += 1) cells.push(null)
    for (let day = 1; day <= miniDaysInMonth; day += 1) {
      cells.push(new Date(miniYear, overviewMonth.getMonth(), day))
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [miniDaysInMonth, miniFirstDayOfMonth, miniYear, overviewMonth])

  const { data: schedules = [], isLoading: isLoadingSchedules } = useSchedules(
    dayRange
      ? {
          from: dayRange.startISO,
          to: dayRange.endISO,
        }
      : undefined,
  )
  
  const { data: deadlines = [], isLoading: isLoadingDeadlines } = usePendingDeadlines({ daysAhead: 3650, daysBehind: 3650, limit: 5000, includeCompleted: true })
  
  const isLoading = isLoadingSchedules || isLoadingDeadlines

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const dayItems = useMemo(() => {
    if (!effectiveDayDate) return []
    const scheds = schedules
      .filter((s) => isSameDay(new Date(s.scheduledAt), effectiveDayDate))
      .map((s) => {
        const myAtt = s.attendees?.find((a) => a.userId === myUserId)
        const myResponse =
          (myAtt?.response as keyof typeof SCHEDULE_RESPONSE_LABEL | undefined) ??
          (s.creatorId === myUserId ? 'ACCEPTED' : undefined)
        return { ...s, kind: 'SCHEDULE' as const, sortDate: new Date(s.scheduledAt), myResponse }
      })
      
    const deads = deadlines
      .filter((d) => isSameDay(new Date(d.deadline), effectiveDayDate))
      .map((d) => {
        return { ...d, kind: 'DEADLINE' as const, sortDate: new Date(d.deadline) }
      })

    const combined: DayViewItem[] = [...scheds, ...deads]
    combined.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    return combined
  }, [schedules, deadlines, effectiveDayDate, myUserId])

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null
    return dayItems.find((s) => s.id === selectedItemId) ?? null
  }, [selectedItemId, dayItems])

  // If nothing selected yet, select the first event (nice UX on first load).
  useEffect(() => {
    if (!isLoading && !selectedItemId && dayItems.length > 0) {
      setSelectedItemId(dayItems[0].id)
    }
  }, [isLoading, selectedItemId, dayItems])

  useEffect(() => {
    if (scheduleIdFromQuery) setSelectedItemId(scheduleIdFromQuery)
  }, [scheduleIdFromQuery])

  const prevDay = effectiveDayDate
    ? new Date(effectiveDayDate.getFullYear(), effectiveDayDate.getMonth(), effectiveDayDate.getDate() - 1)
    : null
  const nextDay = effectiveDayDate
    ? new Date(effectiveDayDate.getFullYear(), effectiveDayDate.getMonth(), effectiveDayDate.getDate() + 1)
    : null

  const timelineEventsByHour = useMemo(() => {
    const byHour: Record<number, DayViewItem[]> = {}
    for (let h = 0; h < 24; h += 1) byHour[h] = []
    for (const it of dayItems) {
      const hour = it.sortDate.getHours()
      byHour[hour].push(it)
    }
    for (let h = 0; h < 24; h += 1) {
      byHour[h].sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    }
    return byHour
  }, [dayItems])

  const myResponseForSelected = useMemo(() => {
    if (!selectedItem || selectedItem.kind === 'DEADLINE' || !myUserId) return undefined
    const myAtt = selectedItem.attendees?.find((a) => a.userId === myUserId)
    return (myAtt?.response ?? (selectedItem.creatorId === myUserId ? 'ACCEPTED' : undefined)) as
      | keyof typeof SCHEDULE_RESPONSE_LABEL
      | undefined
  }, [selectedItem, myUserId])

  const selectedAttendees = selectedItem?.kind === 'SCHEDULE' ? (selectedItem.attendees ?? []) : []

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background flex flex-col bg-[radial-gradient(ellipse_at_top,_rgba(148,163,184,0.08),transparent_55%)]">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Calendar / Day</span>}
          title={effectiveDayDate ? effectiveDayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Day'}
          subtitle="Per-hour timeline with full attendee status."
          actions={
            <div className="flex items-center gap-2">
              {prevDay && (
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => navigate(`/calendar/day/${toDateParamKey(prevDay)}`)}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
              )}
              {nextDay && (
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => navigate(`/calendar/day/${toDateParamKey(nextDay)}`)}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              )}
              <Button variant="secondary" className="rounded-none" onClick={() => navigate('/calendar')}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {!effectiveDayDate || !dayRange ? (
            <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">Invalid date.</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 items-start">
              {/* Timeline */}
              <div className="rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold">Timeline</p>
                    <p className="text-xs text-muted-foreground">
                      {isLoading ? 'Loading...' : `${dayItems.length} item${dayItems.length === 1 ? '' : 's'} (${dayItems.filter(i => i.kind === 'SCHEDULE').length} meetings, ${dayItems.filter(i => i.kind === 'DEADLINE').length} tasks)`}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.65rem] border', SCHEDULE_RESPONSE_COLOR.PENDING)}>
                        Pending
                      </Badge>
                      <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.65rem] border', SCHEDULE_RESPONSE_COLOR.ACCEPTED)}>
                        Accepted
                      </Badge>
                      <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.65rem] border', SCHEDULE_RESPONSE_COLOR.DECLINED)}>
                        Declined
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="max-h-[72vh] overflow-auto">
                  <div className="flex flex-col">
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const events = timelineEventsByHour[hour] ?? []
                      const timeLabel = `${String(hour).padStart(2, '0')}:00`

                      return (
                        <div key={hour} className="grid grid-cols-[90px_1fr] border-b last:border-b-0">
                          <div className="px-3 py-2 text-xs text-muted-foreground tabular-nums border-r bg-muted/10">
                            {timeLabel}
                          </div>
                          <div className="px-3 py-2">
                            {events.length === 0 ? (
                              <div className="text-xs text-muted-foreground">&nbsp;</div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {events.map((it) => {
                                  const isSelected = selectedItemId === it.id
                                  
                                  if (it.kind === 'DEADLINE') {
                                    const isCompleted = it.status === 'DONE' || it.status === 'READY'
                                    const isPastDue = !isCompleted && it.sortDate.getTime() < Date.now()
                                    return (
                                      <button
                                        key={`dl:${it.id}`}
                                        type="button"
                                        onClick={() => setSelectedItemId(it.id)}
                                        className={cn(
                                          'text-left rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                                          'hover:opacity-90',
                                          isSelected ? 'ring-2 ring-primary/30' : '',
                                          isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 opacity-60' :
                                          isPastDue ? 'bg-muted/50 border-muted-foreground/20 text-muted-foreground opacity-60' :
                                          it.status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700' :
                                          'bg-card border-border/60 text-foreground'
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="text-[0.78rem] font-semibold truncate">
                                              {it.sortDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {it.title}
                                            </div>
                                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                              <span className={cn('inline-flex items-center gap-1 text-[0.65rem] font-medium px-1.5 py-0.5 rounded border bg-card/50', TASK_TYPE_CONFIG[it.type as TaskType]?.textColor)}>
                                                <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.icon}</span>
                                                <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.label} Deadline</span>
                                              </span>
                                              <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.65rem] border bg-card/50">
                                                {it.project.name}
                                              </Badge>
                                              {isCompleted && (
                                                <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.65rem] border bg-emerald-500/20 text-emerald-700">
                                                  Completed
                                                </Badge>
                                              )}
                                              {isPastDue && (
                                                <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.65rem] border bg-destructive/20 text-destructive">
                                                  Past Due
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  }

                                  const myResp = it.myResponse
                                  const hasStatus = !!myResp
                                  const resp = (myResp ?? 'PENDING') as keyof typeof SCHEDULE_RESPONSE_LABEL

                                  return (
                                    <button
                                      key={`sch:${it.id}`}
                                      type="button"
                                      onClick={() => setSelectedItemId(it.id)}
                                      className={cn(
                                        'text-left rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                                        'hover:opacity-90',
                                        isSelected ? 'ring-2 ring-primary/30' : '',
                                        hasStatus ? SCHEDULE_RESPONSE_COLOR[resp] : 'bg-muted/10 border-border/60 text-muted-foreground',
                                      )}
                                      title={`${scheduleTypeLabel(it.type)} — ${myResp ? SCHEDULE_RESPONSE_LABEL[myResp] : 'No status'}`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-[0.78rem] font-semibold truncate">
                                            {(() => {
                                              const start = new Date(it.scheduledAt)
                                              const end = it.endAt ? new Date(it.endAt) : null
                                              const startLabel = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                              if (!end) return `${startLabel} · ${it.title}`
                                              const endLabel = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                              return `${startLabel}–${endLabel} · ${it.title}`
                                            })()}
                                          </div>
                                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                                            <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.65rem] border', scheduleTypeBadgeClass(it.type))}>
                                              {scheduleTypeLabel(it.type)}
                                            </Badge>
                                            {myResp && (
                                              <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.65rem] border', SCHEDULE_RESPONSE_COLOR[myResp])}>
                                                {SCHEDULE_RESPONSE_SHORT[myResp]}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right column: Day overview + details */}
              <div className="space-y-4">
                {/* Day Overview */}
                <div className="rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold">Day Overview</p>
                      <p className="text-xs text-muted-foreground">
                        {miniMonthName} {miniYear}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-8 w-8 rounded-none"
                        onClick={() => setOverviewMonth(new Date(overviewMonth.getFullYear(), overviewMonth.getMonth() - 1, 1))}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 rounded-none"
                        onClick={() => setOverviewMonth(new Date(overviewMonth.getFullYear(), overviewMonth.getMonth() + 1, 1))}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-2">
                    <div className="grid grid-cols-7 gap-1 text-[0.65rem] text-muted-foreground font-semibold">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                        <div key={d} className="text-center">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {miniCalendarCells.map((d, idx) => {
                        const isSelected = d && effectiveDayDate && isSameDay(d, effectiveDayDate)
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!d}
                            onClick={() => {
                              if (!d) return
                              navigate(`/calendar/day/${toDateParamKey(d)}`)
                            }}
                            className={cn(
                              'h-8 w-full rounded-none border text-[0.75rem] transition-colors',
                              !d ? 'border-transparent bg-transparent' : 'bg-background/60 hover:bg-accent/40',
                              isSelected ? 'border-primary/60 bg-primary/10' : 'border-border/40',
                            )}
                          >
                            {d ? d.getDate() : ''}
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Total items today</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {dayItems.length}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-col gap-1">
                        {dayItems.slice(0, 3).map((it) => {
                          const isSelected = selectedItemId === it.id
                          return (
                            <button
                              key={`${it.kind}:${it.id}`}
                              type="button"
                              onClick={() => setSelectedItemId(it.id)}
                              className={cn(
                                'text-left rounded-md border px-2 py-1.5 transition-colors',
                                'hover:bg-accent/40',
                                isSelected ? 'border-primary/60 bg-primary/10' : 'border-border/40 bg-background/30',
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[0.72rem] font-semibold truncate">
                                  {it.sortDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {it.kind === 'SCHEDULE' && it.myResponse && (
                                  <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.62rem] border', SCHEDULE_RESPONSE_COLOR[it.myResponse])}>
                                    {SCHEDULE_RESPONSE_SHORT[it.myResponse]}
                                  </Badge>
                                )}
                                {it.kind === 'DEADLINE' && (
                                  <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[0.62rem] font-medium bg-background', TASK_TYPE_CONFIG[it.type as TaskType]?.textColor)}>
                                    <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.icon}</span>
                                    <span>{TASK_TYPE_CONFIG[it.type as TaskType]?.label}</span>
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[0.72rem] truncate">{it.title}</p>
                            </button>
                          )
                        })}
                        {dayItems.length > 3 && (
                          <p className="text-[0.7rem] text-muted-foreground mt-1">
                            +{dayItems.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold">Schedule Details</p>
                    <p className="text-xs text-muted-foreground">Attendees and response status</p>
                  </div>

                  <div className="p-4 space-y-4">
                    {!selectedItem ? (
                      <div className="text-sm text-muted-foreground">Select an item from the timeline.</div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-lg font-semibold truncate">{selectedItem.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {selectedItem.kind === 'SCHEDULE' ? (
                                  <>
                                    <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', scheduleTypeBadgeClass(selectedItem.type))}>
                                      {scheduleTypeLabel(selectedItem.type)}
                                    </Badge>
                                    {myResponseForSelected && (
                                      <Badge variant="secondary" className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_RESPONSE_COLOR[myResponseForSelected])}>
                                        {SCHEDULE_RESPONSE_LABEL[myResponseForSelected]}
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className={cn('inline-flex items-center gap-1 text-[0.7rem] font-medium px-2 py-0.5 rounded border bg-card/50', TASK_TYPE_CONFIG[selectedItem.type as TaskType]?.textColor)}>
                                      <span>{TASK_TYPE_CONFIG[selectedItem.type as TaskType]?.icon}</span>
                                      <span>{TASK_TYPE_CONFIG[selectedItem.type as TaskType]?.label} Deadline</span>
                                    </span>
                                    <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.7rem] border">
                                      Project: {selectedItem.project.name}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.7rem] border">
                                      Status: {selectedItem.status}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {(() => {
                                  if (selectedItem.kind === 'DEADLINE') {
                                    return selectedItem.sortDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                  }
                                  const start = new Date(selectedItem.scheduledAt)
                                  const end = selectedItem.endAt ? new Date(selectedItem.endAt) : null
                                  const startLabel = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                  if (!end) return startLabel
                                  const endLabel = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                  return `${startLabel}–${endLabel}`
                                })()}
                              </div>
                              <div className="text-xs mt-0.5">
                                {selectedItem.kind === 'SCHEDULE' && selectedItem.location ? (
                                  !selectedItem.isVirtual ? (
                                    <a
                                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedItem.location)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <MapIcon className="size-3 shrink-0" />
                                      {selectedItem.location}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">{selectedItem.location}</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">{selectedItem.kind === 'SCHEDULE' ? 'No location' : ''}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {selectedItem.kind === 'SCHEDULE' && selectedItem.details && (
                            <div className="rounded-lg border bg-background px-3 py-2 mt-4">
                              <p className="text-xs text-muted-foreground mb-1">Notes</p>
                              <p className="text-sm whitespace-pre-wrap">{selectedItem.details}</p>
                            </div>
                          )}

                          {selectedItem.kind === 'SCHEDULE' && (
                            <div className="rounded-lg border bg-background/60 overflow-hidden mt-4">
                              <div className="flex items-center justify-between gap-3 px-3 py-2 border-b">
                                <p className="text-sm font-semibold">Attendees</p>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {selectedAttendees.length}
                                </span>
                              </div>

                              {selectedAttendees.length === 0 ? (
                                <div className="p-3 text-sm text-muted-foreground">No attendees.</div>
                              ) : (
                                <div className="divide-y max-h-[320px] overflow-auto">
                                  {selectedAttendees.map((a) => {
                                    const resp = (a.response ?? 'PENDING') as keyof typeof SCHEDULE_RESPONSE_LABEL
                                    const initials = getInitials(a.name ?? null, a.email)
                                    return (
                                      <div
                                        key={`${a.scheduleId ?? selectedItem.id}:${a.email}`}
                                        className="flex items-center justify-between gap-3 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="h-8 w-8 rounded-full bg-muted/70 text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                                            {initials}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                              {a.name ? `${a.name} (${a.email})` : a.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                              {a.userId === myUserId ? 'You' : ''}
                                            </p>
                                          </div>
                                        </div>

                                        <Badge
                                          variant="secondary"
                                          className={cn('rounded-none px-2 py-0.5 text-[0.7rem] border', SCHEDULE_RESPONSE_COLOR[resp])}
                                        >
                                          {SCHEDULE_RESPONSE_SHORT[resp]}
                                        </Badge>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {selectedItem.kind === 'SCHEDULE' && selectedItem.location && !selectedItem.isVirtual && (
                            <div className="mt-4">
                              <LocationMap location={selectedItem.location} />
                            </div>
                          )}
                        </div>

                        {/* Accept/Decline controls for the current user */}
                        {myUserId && selectedItem.kind === 'SCHEDULE' && myResponseForSelected === 'PENDING' && (
                          <div className="pt-2 border-t mt-4">
                            <p className="text-xs text-muted-foreground mb-2">Your response</p>
                            <div className="flex items-center gap-2">
                              <Button
                                className="rounded-none"
                                variant="outline"
                                disabled={respondInvite.isPending}
                                onClick={() => respondInvite.mutate({ scheduleId: selectedItem.id, response: 'DECLINED' })}
                              >
                                Decline
                              </Button>
                              <Button
                                className="rounded-none"
                                disabled={respondInvite.isPending}
                                onClick={() => respondInvite.mutate({ scheduleId: selectedItem.id, response: 'ACCEPTED' })}
                              >
                                Accept
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

