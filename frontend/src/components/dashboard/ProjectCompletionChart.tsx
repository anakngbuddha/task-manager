import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PieChart as PieChartIcon } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

interface ProjectCompletionChartProps {
  totalProjects: number
  finishedProjects: number
  finishedPercentage: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background px-4 py-3 shadow-lg min-w-[150px]">
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color || entry.payload?.fill }}
                />
                <span className="text-muted-foreground font-medium">{entry.name}</span>
              </div>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function ProjectCompletionChart({
  totalProjects,
  finishedProjects,
  finishedPercentage,
}: ProjectCompletionChartProps) {
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Project completion</CardTitle>
            <CardDescription>Finished vs in progress projects</CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
            {finishedProjects}/{totalProjects}
          </Badge>
        </div>
      </CardHeader>

      {totalProjects <= 0 || finishedPercentage <= 0 ? (
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
                {finishedPercentage.toFixed(0)}%
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={[
                    { name: 'Finished', value: finishedProjects },
                    { name: 'In progress', value: Math.max(0, totalProjects - finishedProjects) },
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
              {finishedProjects} of {totalProjects} projects
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
