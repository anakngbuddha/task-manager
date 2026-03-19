import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { Badge } from '@/components/ui/badge'

const statusDot: Record<string, string> = {
  TODO: 'bg-muted/60',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  READY: 'bg-primary',
}

const statusLabels: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  READY: 'Ready',
}

export function TaskStatsWidget({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useTasks(projectId)

  const counts = useMemo(() => {
    const base = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, READY: 0 } as Record<string, number>
    for (const t of tasks as any[]) {
      const s = t.status
      if (s in base) base[s] += 1
    }
    return base
  }, [tasks])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Tasks</p>
        <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
          {tasks.length} total
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.keys(statusLabels).map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDot[k]}`} />
              <span className="text-xs text-muted-foreground">{statusLabels[k]}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{counts[k] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

