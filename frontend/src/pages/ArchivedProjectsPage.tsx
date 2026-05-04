import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useUpdateProject } from '@/hooks/useProject'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, ArchiveRestore, CheckCircle2, RotateCcw, XCircle, LayoutGrid, List } from 'lucide-react'

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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
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
    <div className="flex h-dvh overflow-hidden bg-background/95">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-background/90 to-muted/20">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground/80 font-medium">Workspace / Projects / Archived</span>}
          title={
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Archive className="w-6 h-6 text-primary" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Archived Projects</span>
            </div>
          }
          subtitle="Review completed and discontinued projects, or re-open them if needed."
          actions={(
            <div className="flex bg-muted/60 p-1.5 rounded-xl border shadow-sm backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setActiveTab('COMPLETED')}
                className={`relative flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                  activeTab === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {activeTab === 'COMPLETED' && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-background border rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${activeTab === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-muted-foreground/10'}`}>
                    {completedProjects.length}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('AXED')}
                className={`relative flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                  activeTab === 'AXED' ? 'text-rose-700 dark:text-rose-300 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {activeTab === 'AXED' && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-background border rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Axed
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${activeTab === 'AXED' ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-muted-foreground/10'}`}>
                    {axedProjects.length}
                  </span>
                </span>
              </button>
            </div>
          )}
        />

        <section className="px-6 py-8 sm:px-8 max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border bg-card/50 h-56 animate-pulse p-6">
                  <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-1/4 mb-10"></div>
                  <div className="h-2 bg-muted rounded w-full mb-2"></div>
                  <div className="h-2 bg-muted rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : visibleProjects.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed bg-card/30 backdrop-blur-sm"
            >
              <div className="w-20 h-20 mb-6 rounded-full bg-muted flex items-center justify-center">
                <ArchiveRestore className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No {activeTab === 'COMPLETED' ? 'completed' : 'axed'} projects</h3>
              <p className="text-muted-foreground max-w-md">
                When projects are marked as {activeTab === 'COMPLETED' ? 'completed' : 'axed'}, they will appear here for you to review or restore.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {visibleProjects.map((project) => {
                  const progressPercentage = project.totalTasks === 0 ? 0 : Math.round((project.completedTasks / project.totalTasks) * 100)
                  
                  return (
                    <motion.div
                      key={project.id}
                      variants={itemVariants}
                      layout
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="group"
                    >
                      <Card className="h-full overflow-hidden border-border/50 bg-card/80 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:bg-card">
                        <div className={`h-1.5 w-full ${project.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-xl font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                              {project.name}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className={project.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 font-medium'}
                            >
                              {project.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pb-6">
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground font-medium">Task Progress</span>
                                <span className="font-semibold">{progressPercentage}%</span>
                              </div>
                              <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercentage}%` }}
                                  transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                                  className={`h-full rounded-full ${project.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 pt-2">
                              <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <span className="text-xl font-bold text-foreground">{project.completedTasks}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Done</span>
                              </div>
                              <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <span className="text-xl font-bold text-foreground">{project.pendingTasks}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Pending</span>
                              </div>
                              <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <span className="text-xl font-bold text-foreground">{project.totalTasks}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Total</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                        
                        <CardFooter className="pt-0 pb-5 px-6">
                          <Button
                            variant="outline"
                            className="w-full bg-background/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 group/btn"
                            disabled={updateProject.isPending}
                            onClick={async () => {
                              await updateProject.mutateAsync({
                                id: project.id,
                                data: { status: 'ACTIVE' },
                              })
                            }}
                          >
                            <RotateCcw className="w-4 h-4 mr-2 group-hover/btn:-rotate-180 transition-transform duration-500" />
                            Restore Project
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      </main>
    </div>
  )
}
