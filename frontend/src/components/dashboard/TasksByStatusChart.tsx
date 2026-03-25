import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface ProjectData {
  name: string
  taskCountsByStatus: Record<string, number>
}

interface TasksByStatusChartProps {
  projects: ProjectData[]
}

const STATUS_COLORS = {
  TODO: '#888780',
  IN_PROGRESS: '#378ADD',
  IN_REVIEW: '#EF9F27',
  DONE: '#639922',
} as const

export default function TasksByStatusChart({ projects }: TasksByStatusChartProps) {
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Tasks by status</CardTitle>
            <CardDescription>Kanban distribution per project</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-none px-2 py-1 text-xs">
            {projects.length} projects
          </Badge>
        </div>
      </CardHeader>

      <div className="h-[200px] px-4 pb-3">
        {projects.length === 0 ? (
          <div className="h-full text-sm text-muted-foreground">No projects yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={projects.map((p) => ({
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
              <Bar dataKey="TODO" stackId="status" fill={STATUS_COLORS.TODO} radius={[4, 4, 0, 0]} />
              <Bar dataKey="IN_PROGRESS" stackId="status" fill={STATUS_COLORS.IN_PROGRESS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="IN_REVIEW" stackId="status" fill={STATUS_COLORS.IN_REVIEW} radius={[4, 4, 0, 0]} />
              <Bar dataKey="DONE" stackId="status" fill={STATUS_COLORS.DONE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="px-4 pb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.TODO }} />Todo</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.IN_PROGRESS }} />In Progress</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.IN_REVIEW }} />In Review</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.DONE }} />Done</span>
        </div>
      </div>
    </Card>
  )
}
