import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useSprints, useSprintBurndown } from '@/hooks/useSprints'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRightLeft } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts'

function formatDayLabel(dateKey: string) {
  // backend returns YYYY-MM-DD (UTC). Use UTC parsing to avoid timezone shifts.
  const d = new Date(`${dateKey}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ProjectSprintReportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)

  const { data: sprints = [], isLoading: isLoadingSprints } = useSprints(projectId!)

  const activeSprint = useMemo(() => {
    return (sprints as any[]).find((s) => s.status === 'ACTIVE') ?? null
  }, [sprints])

  const {
    data: burndown,
    isLoading: isLoadingBurndown,
  } = useSprintBurndown(projectId!, activeSprint?.id)

  const velocityData = useMemo(() => {
    return (sprints as any[]).map((s) => ({
      sprint: s.name,
      completed: (s.tasks ?? []).filter((t: any) => t.status === 'DONE' || t.status === 'READY').length,
    }))
  }, [sprints])

  const burndownChartData = useMemo(() => {
    const points = burndown?.points ?? []
    return points.map((p) => ({
      day: formatDayLabel(p.date),
      idealRemaining: p.idealRemaining,
      actualRemaining: p.actualRemaining,
      completedCumulative: p.completedCumulative,
      total: p.total,
    }))
  }, [burndown])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Reports</span>}
          title="Sprint report"
          subtitle="Velocity, burndown, and burnup for the active sprint."
          actions={(
            <Link to={`/projects/${projectId}`}>
              <Button variant="outline" className="h-10 gap-2">
                Back to tasks
                <ArrowRightLeft className="size-4" />
              </Button>
            </Link>
          )}
        />

        {activeSprint && (
          <div className="px-4 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                Active sprint: {activeSprint.name}
              </Badge>
              <Badge variant="outline" className="rounded-none px-2 py-1 text-xs text-muted-foreground">
                {new Date(activeSprint.startDate).toLocaleDateString()} - {new Date(activeSprint.endDate).toLocaleDateString()}
              </Badge>
            </div>
          </div>
        )}

        <section className="px-4 py-6 sm:px-6">
          {isLoadingSprints ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading sprint report…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2 rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm font-medium">Velocity</p>
                    <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                      Completed tasks by sprint
                    </Badge>
                  </div>

                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocityData}>
                        <CartesianGrid stroke="#94a3b8" opacity={0.15} />
                        <XAxis dataKey="sprint" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: 'var(--foreground)',
                          }}
                          itemStyle={{ color: 'var(--foreground)' }}
                          labelStyle={{ color: 'var(--foreground)' }}
                        />
                        <Bar dataKey="completed" name="Completed" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm font-medium">Burndown</p>
                    <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                      Remaining tasks
                    </Badge>
                  </div>

                  {!activeSprint ? (
                    <div className="h-[280px] rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                      No active sprint found.
                    </div>
                  ) : isLoadingBurndown ? (
                    <div className="h-[280px] rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                      Loading burndown…
                    </div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={burndownChartData}>
                          <CartesianGrid stroke="#94a3b8" opacity={0.15} />
                          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground)',
                            }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            labelStyle={{ color: 'var(--foreground)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="idealRemaining"
                            name="Ideal"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="actualRemaining"
                            name="Actual"
                            stroke="#4f46e5"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
                  <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm font-medium">Burnup</p>
                    <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                      Completed vs total
                    </Badge>
                  </div>

                  {!activeSprint ? (
                    <div className="h-[280px] rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                      No active sprint found.
                    </div>
                  ) : isLoadingBurndown ? (
                    <div className="h-[280px] rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                      Loading burnup…
                    </div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={burndownChartData}>
                          <CartesianGrid stroke="#94a3b8" opacity={0.15} />
                          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground)',
                            }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            labelStyle={{ color: 'var(--foreground)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="completedCumulative"
                            name="Completed"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total scope"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

