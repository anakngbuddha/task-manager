import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { ListTodo, Search } from 'lucide-react'

export default function DashboardTasks() {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-task-projects'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/projects')
      return data ?? []
    }
  })

  // We only fetch tasks if we have projects
  const { data: allTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-all-tasks', (projects ?? []).map(p => p.id).join(',')],
    queryFn: async () => {
      if (!projects || projects.length === 0) return []
      const tasksByProject = await Promise.all(
        projects.map(async (p) => {
          const { data } = await api.get<any[]>(`/projects/${p.id}/tasks`)
          return (data ?? []).map(t => ({ ...t, projectName: p.name, projectId: p.id }))
        })
      )
      return tasksByProject.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    enabled: !!projects && projects.length > 0,
  })

  const [projectIdFilter, setProjectIdFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const filteredTasks = useMemo(() => {
    if (!allTasks) return []
    return allTasks.filter(t => {
      if (projectIdFilter !== 'ALL' && String(t.projectId) !== String(projectIdFilter)) return false
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && (t.status === 'DONE' || t.status === 'READY')) return false
        if (statusFilter !== 'ACTIVE' && t.status !== statusFilter) return false
      }
      if (search) {
        if (!t.title.toLowerCase().includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [allTasks, projectIdFilter, statusFilter, search])

  const isLoading = projectsLoading || (projects && projects.length > 0 && tasksLoading)

  return (
    <Card className="col-span-full shadow-sm rounded-xl border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex flex-col">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="size-5 text-emerald-600" />
            Global Tasks Filter
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Manage and track tasks across all your projects.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search tasks by title..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 border-border/70" 
            />
          </div>
          <Select value={projectIdFilter} onValueChange={setProjectIdFilter}>
            <SelectTrigger className="w-full md:w-[220px] h-9 border-border/70">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Projects</SelectItem>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] h-9 border-border/70">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active (Not Done)</SelectItem>
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground rounded-xl border border-dashed">
             <div className="flex items-center gap-2">
                <div className="size-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span>Loading all tracking tasks...</span>
             </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg bg-muted/20">
            <ListTodo className="size-8 text-muted-foreground mb-3 opacity-30" />
            <p className="text-sm font-medium text-foreground">No tasks found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">Try adjusting your filters or search query to find what you're looking for.</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-lg overflow-hidden shrink-0 flex flex-col">
            <div className="overflow-auto bg-background flex-1 max-h-[400px]">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10 shadow-sm border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Task Detail</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Project Source</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 font-medium text-sm">
                        <div className="flex flex-col gap-0.5" title={task.title}>
                           <span className="truncate max-w-[200px] sm:max-w-[400px]">{task.title}</span>
                           {task.assignee && (
                             <span className="text-[10px] text-muted-foreground font-normal">Assigned to: {task.assignee.name || task.assignee.email.split('@')[0]}</span>
                           )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider bg-background border">
                          {task.status?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5 border rounded-sm pl-1 pr-2 py-0.5 bg-background w-fit">
                           <div className="size-2 rounded-full bg-emerald-500/80" />
                           {task.projectName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link 
                          to={`/projects/${task.projectId}?taskId=${task.id}`}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        >
                          View Board &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/20 px-4 py-2 text-xs text-muted-foreground border-t flex items-center justify-between">
              <span>Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}</span>
              <span>Sorted by newest</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
