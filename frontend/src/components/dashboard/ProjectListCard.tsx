import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FolderPlus, Plus } from 'lucide-react'

interface ProjectData {
  id: string
  name: string
  totalTasks: number
  doneTasks: number
  completionPct: number
  taskCountsByStatus: Record<string, number>
  members: { id: string; name?: string; email?: string }[]
}

interface ProjectListCardProps {
  projects: ProjectData[]
  onCreateClick: () => void
}

export default function ProjectListCard({ projects, onCreateClick }: ProjectListCardProps) {
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Projects</CardTitle>
            <CardDescription>Progress, task counts, member avatars, and quick access</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-none px-2 py-1 text-xs">
            {projects.length} total
          </Badge>
        </div>
      </CardHeader>

      {projects.length === 0 ? (
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
              <Button className="h-10 gap-2" onClick={onCreateClick}>
                <Plus className="size-4" />
                Create project
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {projects.map((p) => {
            const progress = Math.max(0, Math.min(100, p.completionPct ?? 0))
            const membersToShow = (p.members ?? []).slice(0, 5)
            const hiddenMembers = Math.max(0, (p.members ?? []).length - membersToShow.length)

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
  )
}
