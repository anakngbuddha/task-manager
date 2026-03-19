import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useSprints } from '@/hooks/useSprints'

const completedStroke = '#10b981'

export function VelocityChartWidget({ projectId }: { projectId: string }) {
  const { data: sprints = [], isLoading } = useSprints(projectId)

  const data = (sprints as any[]).map((s) => {
    const completed = (s.tasks ?? []).filter((t: any) => t.status === 'DONE').length
    return { sprint: s.name, completed }
  })

  return (
    <div className="h-full">
      {isLoading ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          Loading velocity…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid stroke="#94a3b8" opacity={0.12} />
            <XAxis dataKey="sprint" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Bar dataKey="completed" fill={completedStroke} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

