import { useMemo } from 'react'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { Badge } from '@/components/ui/badge'

export function TimeSummaryWidget({ projectId }: { projectId: string }) {
  const { data: report, isLoading } = useProjectTimeReport(projectId)

  const topTasks = useMemo(() => {
    const list = report?.byTask ?? []
    return [...list].sort((a: any, b: any) => b.totalHours - a.totalHours).slice(0, 5)
  }, [report])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Time</p>
        <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
          {isLoading ? '—' : `${(report?.grandTotalHours ?? 0).toFixed(1)}h`}
        </Badge>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          Loading time summary…
        </div>
      ) : topTasks.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          No time logs yet.
        </div>
      ) : (
        <div className="space-y-2">
          {topTasks.map((t: any) => (
            <div key={t.taskId} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{t.taskTitle}</div>
                <div className="text-[0.7rem] text-muted-foreground tabular-nums mt-0.5">
                  {t.totalHours.toFixed(2)}h logged
                </div>
              </div>
              <div className="shrink-0">
                <Badge variant="outline" className="rounded-none px-2 py-1 text-[0.7rem]">
                  {t.totalHours.toFixed(1)}h
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

