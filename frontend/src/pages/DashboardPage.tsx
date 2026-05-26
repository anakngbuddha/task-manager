import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCreateProject, useProjectsDashboard } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FolderPlus, Plus, FolderKanban, ListTodo, CheckCircle2, Users, ShieldAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { useOfflineToast } from '@/components/ui/OfflineToast'
import MetricCard from '@/components/dashboard/MetricCard'
import TasksByStatusChart from '@/components/dashboard/TasksByStatusChart'
import ProjectCompletionChart from '@/components/dashboard/ProjectCompletionChart'
import ProjectListCard from '@/components/dashboard/ProjectListCard'
import DashboardTasks from '@/components/dashboard/DashboardTasks'
import DashboardTerminal from '@/components/terminal/DashboardTerminal'

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
  const { showToast } = useOfflineToast()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Removed auto-redirect to admin dashboard so the admin can view the task dashboard and use the button instead.

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
    const result = await createProject.mutateAsync(name.trim())
    setName('')
    setOpen(false)
    if (result?._queued) {
      showToast('Project created — will sync when you\'re online', 'offline')
    }
  }

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Workspace / Dashboard</span>}
          title="Projects"
          subtitle={headerSubtitle}
          actions={(
            <div className="flex items-center gap-2">
              {(session?.user as any)?.role === 'admin' && (
                <Button 
                  variant="outline" 
                  className="h-10 gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                  onClick={() => navigate('/admin/dashboard')}
                >
                  <ShieldAlert className="size-4" />
                  Admin Dashboard
                </Button>
              )}
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
            </div>
          )}
        />

        <section className="px-6 py-7 sm:px-8">
          {isLoadingDashboard || !dashboard ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading dashboard…
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total Projects"
                  value={dashboard.totalProjects}
                  icon={FolderKanban}
                  subtitle={dashboard.finishedProjects > 0 ? `${dashboard.finishedProjects} finished` : undefined}
                />
                <MetricCard
                  title="Total Tasks"
                  value={dashboard.totalTasks}
                  icon={ListTodo}
                  subtitle={(dueThisWeek.data ?? 0) > 0 ? `${dueThisWeek.data} due this week` : undefined}
                />
                <MetricCard
                  title="Completed Tasks"
                  value={dashboard.completedTasks}
                  icon={CheckCircle2}
                />
                <MetricCard
                  title="Active Members"
                  value={dashboard.activeMembers}
                  icon={Users}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TasksByStatusChart projects={dashboard.projects} />
                <ProjectCompletionChart
                  totalProjects={dashboard.totalProjects}
                  finishedProjects={dashboard.finishedProjects}
                  finishedPercentage={dashboard.finishedPercentage}
                />
              </div>

              <ProjectListCard
                projects={dashboard.projects as any}
                onCreateClick={() => setOpen(true)}
              />

              <DashboardTasks />
            </div>
          )}
        </section>
      </main>
      <DashboardTerminal userName={session?.user?.name} />
    </div>
  )
}
