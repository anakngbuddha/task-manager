import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCreateProject, useProjectsDashboard } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FolderPlus, Plus, FolderKanban, ListTodo, CheckCircle2, Users, PieChart as PieChartIcon } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

function greetingLabel() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstNameFrom(name?: string | null, email?: string | null) {
  const raw = (name ?? '').trim()
  if (raw) return raw.split(/\s+/)[0]
  if (email) return email.split('@')[0]
  return 'there'
}

export default function DashboardPage() {
  const { data: dashboard, isLoading: isLoadingDashboard } = useProjectsDashboard()
  const createProject = useCreateProject()
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  const dueThisWeek = useQuery({
    queryKey: ['dashboard-due-this-week'],
    queryFn: async () => {
      const { data: projects } = await api.get<Array<{ id: string }>>('/projects')
      const tasksByProject = await Promise.all(
        (projects ?? []).map(async (p) => {
          const { data } = await api.get<any[]>(`/projects/${p.id}/tasks`)
          return data ?? []
        }),
      )

      const now = new Date()
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const due = tasksByProject
        .flat()
        .filter((t: any) => t?.deadline)
        .filter((t: any) => {
          const d = new Date(t.deadline)
          if (Number.isNaN(d.getTime())) return false
          const status = String(t.status ?? '')
          if (status === 'DONE') return false
          return d >= now && d <= end
        }).length

      return due
    },
    staleTime: 30_000,
  })

  const headerSubtitle = useMemo(() => {
    const fn = firstNameFrom(session?.user?.name, session?.user?.email)
    const n = dueThisWeek.data ?? 0
    if (dueThisWeek.isLoading) return `${greetingLabel()}, ${fn} — loading your week…`
    if (n <= 0) return `You're all caught up today.`
    return `${greetingLabel()}, ${fn} — you have ${n} task${n === 1 ? '' : 's'} due this week.`
  }, [dueThisWeek.data, dueThisWeek.isLoading, session?.user?.email, session?.user?.name])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createProject.mutateAsync(name.trim())
    setName('')
    setOpen(false)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Workspace / Dashboard</span>}
          title="Projects"
          subtitle={headerSubtitle}
          actions={(
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Plus className="size-4" />
                  New project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a new project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                  <div className="relative">
                    <FolderPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Project name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-10 pl-10"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="h-10 w-full" disabled={createProject.isPending}>
                    {createProject.isPending ? 'Creating...' : 'Create project'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        />

        <section className="px-6 py-7 sm:px-8">
          {isLoadingDashboard || !dashboard ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading dashboard…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tier 1: Metric cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                    <FolderKanban className="mt-2 size-4 text-muted-foreground" />
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{dashboard.totalProjects}</div>
                    {typeof dashboard.finishedProjects === 'number' && dashboard.finishedProjects > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {dashboard.finishedProjects} finished
                      </div>
                    )}
                  </CardHeader>
                </Card>
                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
                    <ListTodo className="mt-2 size-4 text-muted-foreground" />
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{dashboard.totalTasks}</div>
                    {(dueThisWeek.data ?? 0) > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {dueThisWeek.data} due this week
                      </div>
                    )}
                  </CardHeader>
                </Card>
                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completed Tasks</CardTitle>
                    <CheckCircle2 className="mt-2 size-4 text-muted-foreground" />
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{dashboard.completedTasks}</div>
                  </CardHeader>
                </Card>
                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                    <Users className="mt-2 size-4 text-muted-foreground" />
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{dashboard.activeMembers}</div>
                  </CardHeader>
                </Card>
              </div>

              {/* Tier 2: Charts */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">Tasks by status</CardTitle>
                        <CardDescription>Kanban distribution per project</CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-none px-2 py-1 text-xs">
                        {dashboard.projects.length} projects
                      </Badge>
                    </div>
                  </CardHeader>

                  <div className="h-[200px] px-4 pb-3">
                    {dashboard.projects.length === 0 ? (
                      <div className="h-full text-sm text-muted-foreground">No projects yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dashboard.projects.map((p) => ({
                            project: p.name,
                            TODO: p.taskCountsByStatus.TODO ?? 0,
                            IN_PROGRESS: p.taskCountsByStatus.IN_PROGRESS ?? 0,
                            IN_REVIEW: p.taskCountsByStatus.IN_REVIEW ?? 0,
                            DONE: (p.taskCountsByStatus.DONE ?? 0) + (p.taskCountsByStatus.READY ?? 0),
                          }))}
                        >
                          <CartesianGrid stroke="#94a3b8" opacity={0.12} />
                          <XAxis dataKey="project" tick={{ fill: '#94a3b8', fontSize: 12 }} interval={0} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground)',
                            }}
                            itemStyle={{ color: 'var(--foreground)' }}
                          />
                          <Bar
                            dataKey="TODO"
                            stackId="status"
                            fill="#888780"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar dataKey="IN_PROGRESS" stackId="status" fill="#378ADD" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="IN_REVIEW" stackId="status" fill="#EF9F27" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="DONE" stackId="status" fill="#639922" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="px-4 pb-5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#888780' }} />Todo</span>
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#378ADD' }} />In Progress</span>
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#EF9F27' }} />In Review</span>
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#639922' }} />Done</span>
                    </div>
                  </div>
                </Card>

                <Card className="border-border/60 bg-background/60 backdrop-blur">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">Project completion</CardTitle>
                        <CardDescription>Finished vs in progress projects</CardDescription>
                      </div>
                      <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
                        {dashboard.finishedProjects}/{dashboard.totalProjects}
                      </Badge>
                    </div>
                  </CardHeader>

                  {dashboard.totalProjects <= 0 || dashboard.finishedPercentage <= 0 ? (
                    <div className="flex items-center gap-3 px-4 pb-6 pt-2 text-muted-foreground">
                      <div className="grid size-10 place-items-center rounded-lg bg-muted/40">
                        <PieChartIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">No completion stats yet</p>
                        <p className="text-xs text-muted-foreground">
                          Complete your first project to see completion stats.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6 px-4 pb-5">
                      <div className="relative h-[170px] w-[170px]">
                        <div className="absolute inset-0 grid place-items-center">
                          <div className="text-3xl font-semibold tabular-nums">
                            {dashboard.finishedPercentage.toFixed(0)}%
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                              }}
                              itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Pie
                              data={[
                                { name: 'Finished', value: dashboard.finishedProjects },
                                { name: 'In progress', value: Math.max(0, dashboard.totalProjects - dashboard.finishedProjects) },
                              ]}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={2}
                              stroke="transparent"
                              isAnimationActive={false}
                            >
                              <Cell fill="#639922" />
                              <Cell fill="#94a3b8" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-muted-foreground">Finished projects</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {dashboard.finishedProjects} of {dashboard.totalProjects} projects
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Tier 3: Projects list */}
              <Card className="border-border/60 bg-background/60 backdrop-blur">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">Projects</CardTitle>
                      <CardDescription>Progress, task counts, member avatars, and quick access</CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-none px-2 py-1 text-xs">
                      {dashboard.projects.length} total
                    </Badge>
                  </div>
                </CardHeader>

                {dashboard.projects.length === 0 ? (
                  <div className="px-4 pb-5">
                    <div className="rounded-xl border border-border/60 bg-card p-6">
                      <div className="flex items-center gap-2 text-primary">
                        <FolderPlus className="size-5" />
                        <p className="text-sm font-medium">Start here</p>
                      </div>
                      <h3 className="mt-2 text-xl font-semibold">Create your first project</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Projects group tasks, members, and deadlines. Create one to begin using the kanban board.
                      </p>
                      <div className="mt-4">
                        <Button className="h-10 gap-2" onClick={() => setOpen(true)}>
                          <Plus className="size-4" />
                          Create project
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {dashboard.projects.map((p: any) => {
                      const progress = Math.max(0, Math.min(100, p.completionPct ?? 0))
                      const membersToShow = (p.members ?? []).slice(0, 5)
                      const hiddenMembers = Math.max(0, (p.members ?? []).length - membersToShow.length)

                      // Load is based on "active" tasks: everything that's NOT DONE.
                      // Overloaded: > 5 active tasks, Normal: 3-5, Underloaded: < 3.
                      const activeTasks =
                        (p.taskCountsByStatus?.TODO ?? 0) +
                        (p.taskCountsByStatus?.IN_PROGRESS ?? 0) +
                        (p.taskCountsByStatus?.IN_REVIEW ?? 0) +
                        (p.taskCountsByStatus?.READY ?? 0)

                      const loadTone =
                        activeTasks > 5 ? 'overloaded' : activeTasks < 3 ? 'underloaded' : 'normal'

                      const progressBarClass =
                        loadTone === 'overloaded'
                          ? 'bg-red-500'
                          : loadTone === 'normal'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'

                      return (
                        <div key={p.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: progress >= 80 ? '#639922' : progress >= 30 ? '#EF9F27' : '#888780' }}
                                  />
                                  <div className="truncate font-semibold">{p.name}</div>
                                  <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[0.7rem]">
                                    {p.totalTasks} tasks
                                  </Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                  {p.doneTasks} done · {activeTasks} active
                                </div>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div className={`h-full ${progressBarClass}`} style={{ width: `${progress}%` }} />
                              </div>
                              <div className="mt-1 text-[0.7rem] text-muted-foreground tabular-nums">
                                {progress.toFixed(0)}% completed
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center -space-x-2">
                              {membersToShow.map((m: any) => (
                                <Avatar key={m.id} size="sm" className="h-7 w-7 ring-2 ring-background">
                                  <AvatarFallback className="text-[0.65rem] bg-muted">
                                    {(m.name ?? m.email ?? 'U').charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {hiddenMembers > 0 && (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[0.65rem] text-muted-foreground ring-2 ring-background">
                                  +{hiddenMembers}
                                </div>
                              )}
                            </div>

                            <Link to={`/projects/${p.id}`} className="shrink-0">
                              <Button variant="outline" className="h-9 rounded-none">
                                Open board
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}