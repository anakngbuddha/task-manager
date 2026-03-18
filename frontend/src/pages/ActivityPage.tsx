import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useActivity } from '@/hooks/useActivity'
import { useSession } from '@/lib/auth-client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Activity,
  CheckSquare,
  MessageCircle,
  MessageSquare,
  Pencil,
  Reply,
  Zap,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name?: string | null, email?: string | null): string {
  if (name) return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getDayKey(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Event config ─────────────────────────────────────────────────────────────

interface EventConfig {
  icon: React.ElementType
  pillBg: string
  pillText: string
  label: string
  filterKey: FilterKey
}

type FilterKey = 'all' | 'tasks' | 'messages' | 'comments'

const EVENT_CONFIG: Record<string, EventConfig> = {
  TASK_CREATED: {
    icon: CheckSquare,
    pillBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    pillText: 'text-emerald-700 dark:text-emerald-400',
    label: 'created a task',
    filterKey: 'tasks',
  },
  TASK_UPDATED: {
    icon: Pencil,
    pillBg: 'bg-amber-100 dark:bg-amber-950/60',
    pillText: 'text-amber-700 dark:text-amber-400',
    label: 'updated a task',
    filterKey: 'tasks',
  },
  TASK_COMMENT_ADDED: {
    icon: MessageSquare,
    pillBg: 'bg-blue-100 dark:bg-blue-950/60',
    pillText: 'text-blue-700 dark:text-blue-400',
    label: 'commented on a task',
    filterKey: 'comments',
  },
  TASK_COMMENT_REPLIED: {
    icon: Reply,
    pillBg: 'bg-violet-100 dark:bg-violet-950/60',
    pillText: 'text-violet-700 dark:text-violet-400',
    label: 'replied in a thread',
    filterKey: 'comments',
  },
  PROJECT_MESSAGE_SENT: {
    icon: MessageCircle,
    pillBg: 'bg-primary/10',
    pillText: 'text-primary',
    label: 'sent a message',
    filterKey: 'messages',
  },
  DIRECT_MESSAGE_SENT: {
    icon: MessageSquare,
    pillBg: 'bg-pink-100 dark:bg-pink-950/60',
    pillText: 'text-pink-700 dark:text-pink-400',
    label: 'sent a direct message',
    filterKey: 'messages',
  },
}

function getCfg(type: string): EventConfig {
  return (
    EVENT_CONFIG[type] ?? {
      icon: Zap,
      pillBg: 'bg-muted',
      pillText: 'text-muted-foreground',
      label: 'did something',
      filterKey: 'all',
    }
  )
}

function getHref(event: any): string | null {
  const pid = event.project?.id ?? event.metadata?.projectId
  if (!pid) return null
  switch (event.type) {
    case 'PROJECT_MESSAGE_SENT':
      return `/projects/${pid}/messages`
    case 'DIRECT_MESSAGE_SENT':
      return `/projects/${pid}/messages?mode=direct`
    case 'TASK_CREATED':
    case 'TASK_UPDATED':
    case 'TASK_COMMENT_ADDED':
    case 'TASK_COMMENT_REPLIED':
      return `/projects/${pid}`
    default:
      return `/projects/${pid}`
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string
  type: string
  actorId: string
  createdAt: string
  actor?: { id: string; name?: string | null; email?: string | null }
  project?: { id: string; name?: string | null }
  metadata?: Record<string, any>
}

interface UserGroup {
  actor: ActivityEvent['actor']
  events: ActivityEvent[]
}

interface DaySection {
  dayKey: string
  groups: UserGroup[]
}

// ─── Inline event pill ────────────────────────────────────────────────────────

function EventPill({ type }: { type: string }) {
  const cfg = getCfg(type)
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.62rem] font-semibold shrink-0',
        cfg.pillBg,
        cfg.pillText
      )}
    >
      <Icon className="size-2.5" />
      {type.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

// ─── Single action row ────────────────────────────────────────────────────────

function ActionRow({ event, actorName }: { event: ActivityEvent; actorName: string }) {
  const cfg = getCfg(event.type)
  const project = event.project?.name ?? 'a project'
  const href = getHref(event)
  const createdAt = new Date(event.createdAt)

  const content = (
    <p className="text-sm leading-snug text-foreground/80">
      <span className="font-medium text-foreground">{cfg.label}</span>{' '}
      <span className="text-muted-foreground">in</span>{' '}
      <span className="font-medium text-foreground">{project}</span>{' '}
      <EventPill type={event.type} />
      <span className="ml-1.5 text-[0.7rem] text-muted-foreground tabular-nums" title={createdAt.toLocaleString()}>
        · {formatRelativeTime(createdAt)}
      </span>
    </p>
  )

  if (href) {
    return (
      <Link
        to={href}
        className="group/row -mx-3 flex items-start gap-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-accent/60"
      >
        {content}
      </Link>
    )
  }

  return <div className="py-1.5">{content}</div>
}

// ─── User group ───────────────────────────────────────────────────────────────

function UserGroupBlock({ group, isLast }: { group: UserGroup; isLast: boolean }) {
  const actor = group.actor
  const name = actor?.name ?? actor?.email ?? 'Unknown'
  const initials = getInitials(actor?.name, actor?.email)

  return (
    <div className={cn('flex gap-3', !isLast && 'mb-5')}>
      {/* Avatar column */}
      <div className="flex flex-col items-center shrink-0">
        <Avatar size="sm">
          <AvatarFallback className="text-[0.625rem] font-bold bg-accent text-accent-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Spine — only show if multiple actions in group */}
        {group.events.length > 1 && (
          <div className="mt-1 w-px flex-1 bg-border/50" />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[0.8rem] font-semibold text-foreground leading-tight mb-1">{name}</p>
        <div className="space-y-0.5">
          {group.events.map((e) => (
            <ActionRow key={e.id} event={e} actorName={name} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Day header ───────────────────────────────────────────────────────────────

function DayHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-border/40" />
      <span className="shrink-0 rounded-full border border-border/60 bg-background px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterKey | 'mine'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'messages', label: 'Messages' },
  { key: 'comments', label: 'Comments' },
  { key: 'mine', label: 'By me' },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2', color)}>
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { data: events = [], isLoading } = useActivity(120)
  const { data: session } = useSession()
  const myId = session?.user?.id

  const [activeFilter, setActiveFilter] = useState<FilterKey | 'mine'>('all')

  // ─ Filter ─
  const filtered = useMemo(() => {
    return (events as ActivityEvent[]).filter((e) => {
      if (activeFilter === 'mine') return e.actorId === myId
      if (activeFilter === 'all') return true
      return getCfg(e.type).filterKey === activeFilter
    })
  }, [events, activeFilter, myId])

  // ─ Stats (based on full set) ─
  const stats = useMemo(() => ({
    messages: (events as ActivityEvent[]).filter((e) => getCfg(e.type).filterKey === 'messages').length,
    tasks: (events as ActivityEvent[]).filter((e) => getCfg(e.type).filterKey === 'tasks').length,
    comments: (events as ActivityEvent[]).filter((e) => getCfg(e.type).filterKey === 'comments').length,
  }), [events])

  // ─ Group: day → consecutive-same-user groups ─
  const sections = useMemo<DaySection[]>(() => {
    const result: DaySection[] = []
    let currentDay = ''
    let currentSection: DaySection | null = null
    let currentGroup: UserGroup | null = null

    for (const e of filtered) {
      const dayKey = getDayKey(new Date(e.createdAt))

      if (dayKey !== currentDay) {
        currentDay = dayKey
        currentSection = { dayKey, groups: [] }
        result.push(currentSection)
        currentGroup = null
      }

      // Group consecutive same-actor events together
      if (currentGroup && currentGroup.actor?.id === e.actorId && currentSection) {
        currentGroup.events.push(e)
      } else {
        currentGroup = { actor: e.actor, events: [e] }
        currentSection!.groups.push(currentGroup)
      }
    }

    return result
  }, [filtered])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 px-6 py-3 sm:px-8">
            <Activity className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">Activity Feed</h1>
              <p className="text-[0.7rem] text-muted-foreground">Recent changes across all projects</p>
            </div>
            {/* Stats inline in header */}
            {!isLoading && (events as ActivityEvent[]).length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <StatCard value={stats.tasks} label="tasks" color="text-emerald-600" />
                <StatCard value={stats.messages} label="messages" color="text-primary" />
                <StatCard value={stats.comments} label="comments" color="text-blue-600" />
              </div>
            )}
          </div>

          {/* ── Filter pills ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 px-6 pb-2.5 sm:px-8">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" />
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setActiveFilter(opt.key as FilterKey | 'mine')}
                className={cn(
                  'rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
                  activeFilter === opt.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Feed ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 sm:px-8">
          {isLoading ? (
            /* Skeleton */
            <div className="space-y-6 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="size-7 rounded-full bg-muted shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-2.5 w-64 rounded bg-muted" />
                    <div className="h-2.5 w-48 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : sections.length === 0 ? (
            /* Empty */
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card/40 py-16 text-center mt-4">
              <div className="grid size-12 place-items-center rounded-xl bg-muted">
                <Activity className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {activeFilter === 'all' ? 'No activity yet' : `No ${activeFilter} activity`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                  {activeFilter === 'all'
                    ? 'Actions like creating tasks, sending messages, and commenting will appear here.'
                    : 'Try a different filter to see more activity.'}
                </p>
              </div>
              {activeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Show all activity
                </button>
              )}
            </div>
          ) : (
            sections.map((section, si) => (
              <div key={section.dayKey}>
                <DayHeader label={section.dayKey} />
                <div>
                  {section.groups.map((group, gi) => (
                    <UserGroupBlock
                      key={`${group.actor?.id}-${gi}`}
                      group={group}
                      isLast={si === sections.length - 1 && gi === section.groups.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
