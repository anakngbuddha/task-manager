import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useProjectTimeReport } from '@/hooks/useTimeLogs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatHours(hours: number) {
  if (!Number.isFinite(hours)) return '0.00'
  return hours.toFixed(2)
}

export default function ProjectTimeReportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: report, isLoading } = useProjectTimeReport(projectId!)

  const grandTotalHours = report?.grandTotalHours ?? 0

  const members = useMemo(() => report?.members ?? [], [report?.members])

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Reports</span>}
          title="Time report"
          subtitle="Logged hours by member and task."
          actions={(
            <Link to={`/projects/${projectId}`}>
              <Button variant="outline" className="h-10">
                Back to tasks
              </Button>
            </Link>
          )}
        />

        <section className="px-4 py-6 sm:px-6">
          {isLoading ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading time report…
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-6">
              <p className="text-sm font-medium">No time logged yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Log time from a task to see it reflected here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
              <div className="flex items-center justify-between gap-3 px-1 pb-4">
                <p className="text-sm font-medium">Hours by member</p>
                <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                  Total: {formatHours(grandTotalHours)}h
                </Badge>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <Fragment key={m.userId}>
                        <tr>
                          <td colSpan={2} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{m.userName}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  Total: {formatHours(m.totalHours)}h
                                </p>
                              </div>
                              <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                                {formatHours(m.totalHours)}h
                              </Badge>
                            </div>
                          </td>
                        </tr>
                        {m.tasks.map((t) => (
                          <tr key={t.taskId}>
                            <td className="px-4 py-2 text-foreground/90">
                              <span className="block truncate">{t.taskTitle}</span>
                            </td>
                            <td className="px-4 py-2 text-right font-medium tabular-nums">
                              {formatHours(t.hours)}h
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

