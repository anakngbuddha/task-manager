import { useMemo } from 'react'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { useTasks } from '@/hooks/useTasks'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const statusColors: Record<string, string> = {
  TODO: 'bg-muted/60',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  READY: 'bg-primary',
}

function getInitials(nameOrEmail: string) {
  const s = (nameOrEmail ?? '').trim()
  if (!s) return 'U'
  const parts = s.includes('@') ? s.split('@')[0].split(/[.\s_-]+/) : s.split(/\s+/)
  const first = parts[0]?.[0] ?? 'U'
  const second = parts.length > 1 ? parts[1]?.[0] : (s.replace(/[^a-zA-Z]/g, '')?.[1] ?? '')
  return (first + (second || '')).toUpperCase().slice(0, 2)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function WorkloadSummaryWidget({ projectId }: { projectId: string }) {
  const { data: members = [] } = useProjectMembers(projectId)
  const { data: tasks = [] } = useTasks(projectId)
  const { data: report } = useProjectTimeReport(projectId)

  const byUserHours = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of report?.byUser ?? []) m.set(String(row.userId), row.totalHours)
    return m
  }, [report])

  const rows = useMemo(() => {
    const taskList = tasks as any[]

    return (members as any[]).map((member) => {
      const userId = String(member.userId)
      const user = member?.user ?? member?.user ?? null
      const displayName = user?.name ?? user?.email ?? userId
      const initials = getInitials(displayName)

      const assigned = taskList.filter((t) => String(t.assigneeId) === userId)

      const todo = assigned.filter((t) => t.status === 'TODO').length
      const inProgress = assigned.filter((t) => t.status === 'IN_PROGRESS').length
      const inReview = assigned.filter((t) => t.status === 'IN_REVIEW').length

      // Treat READY as done-ish for the breakdown (matches dashboard "done" bucket).
      const done = assigned.filter((t) => t.status === 'DONE' || t.status === 'READY').length

      const assignedTaskCount = assigned.length
      const activeTasks = todo + inProgress + inReview

      const loadTone = activeTasks > 5 ? 'overloaded' : activeTasks < 3 ? 'underloaded' : 'normal'
      const progressWidth = clamp((activeTasks / 8) * 100, 0, 100)

      const color =
        loadTone === 'overloaded'
          ? 'bg-red-500'
          : loadTone === 'normal'
            ? 'bg-amber-500'
            : 'bg-emerald-500'

      return {
        userId,
        displayName,
        initials,
        assignedTaskCount,
        todo,
        inProgress,
        inReview,
        done,
        totalLoggedHours: byUserHours.get(userId) ?? 0,
        loadTone,
        progressWidth,
        color,
      }
    })
  }, [members, tasks, byUserHours])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Workload</p>
        <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
          {rows.length} members
        </Badge>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-lg border border-border/60 bg-background/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-[0.65rem]">
                    {r.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.displayName}</div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {r.totalLoggedHours.toFixed(1)}h logged
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <Badge variant="outline" className="rounded-none px-2 py-1 text-xs">
                  {r.assignedTaskCount} tasks
                </Badge>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${r.color}`} style={{ width: `${r.progressWidth}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-[0.7rem] text-muted-foreground">
                  {r.loadTone === 'overloaded' ? 'Overloaded' : r.loadTone === 'normal' ? 'Normal' : 'Underloaded'}
                </div>
                <div className="text-[0.7rem] text-muted-foreground tabular-nums">
                  Active: {r.todo + r.inProgress + r.inReview}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusColors.TODO}`} />
                <span className="text-[0.7rem] text-muted-foreground tabular-nums">{r.todo}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusColors.IN_PROGRESS}`} />
                <span className="text-[0.7rem] text-muted-foreground tabular-nums">{r.inProgress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusColors.IN_REVIEW}`} />
                <span className="text-[0.7rem] text-muted-foreground tabular-nums">{r.inReview}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusColors.DONE}`} />
                <span className="text-[0.7rem] text-muted-foreground tabular-nums">{r.done}</span>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
            No members yet.
          </div>
        )}
      </div>
    </div>
  )
}

