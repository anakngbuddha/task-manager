import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useUpdateProject } from '@/hooks/useProject'

type ArchiveTab = 'COMPLETED' | 'AXED'

const DONE_TASK_STATUSES = new Set(['DONE', 'READY'])

type ProjectWithTaskSummary = {
  id: string
  name: string
  status: 'ACTIVE' | 'COMPLETED' | 'AXED'
  totalTasks: number
  completedTasks: number
  pendingTasks: number
}

export default function ArchivedProjectsPage() {
  const [activeTab, setActiveTab] = useState<ArchiveTab>('COMPLETED')
  const updateProject = useUpdateProject()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-archived-report'],
    queryFn: async (): Promise<ProjectWithTaskSummary[]> => {
      const { data } = await api.get('/projects')
      const allProjects: any[] = data ?? []

      const taskRows = await Promise.all(
        allProjects.map(async (project) => {
          const { data: tasksData } = await api.get(`/projects/${project.id}/tasks`)
          const tasks: any[] = tasksData ?? []
          const completedTasks = tasks.filter((task) => DONE_TASK_STATUSES.has(String(task.status))).length
          return {
            id: String(project.id),
            name: String(project.name),
            status: String(project.status) as ProjectWithTaskSummary['status'],
            totalTasks: tasks.length,
            completedTasks,
            pendingTasks: Math.max(tasks.length - completedTasks, 0),
          }
        })
      )

      return taskRows
    },
  })

  const completedProjects = useMemo(
    () => projects.filter((project) => project.status === 'COMPLETED'),
    [projects],
  )
  const axedProjects = useMemo(
    () => projects.filter((project) => project.status === 'AXED'),
    [projects],
  )

  const visibleProjects = activeTab === 'COMPLETED' ? completedProjects : axedProjects

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Workspace / Projects / Archived</span>}
          title="Archived Projects"
          subtitle="Review completed and discontinued projects, then re-open if needed."
          actions={(
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => setActiveTab('COMPLETED')}
                className={activeTab === 'COMPLETED' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}
              >
                Completed
                <span className="ml-2 text-xs text-muted-foreground">({completedProjects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('AXED')}
                className={activeTab === 'AXED' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-sm font-medium' : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'}
              >
                Axed
                <span className="ml-2 text-xs text-muted-foreground">({axedProjects.length})</span>
              </button>
            </div>
          )}
        />

        <section className="px-6 py-7 sm:px-8">
          {isLoading ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading archived projects...
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No {activeTab === 'COMPLETED' ? 'completed' : 'axed'} projects yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProjects.map((project) => (
                <Card key={project.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={project.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'}
                        >
                          {project.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateProject.isPending}
                          onClick={async () => {
                            await updateProject.mutateAsync({
                              id: project.id,
                              data: { status: 'ACTIVE' },
                            })
                          }}
                        >
                          Re-open
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">Pending: {project.pendingTasks}</Badge>
                      <Badge variant="outline">Completed: {project.completedTasks}</Badge>
                      <Badge variant="outline">Total: {project.totalTasks}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
