import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useSprints, useSprintBurndown } from '@/hooks/useSprints'

function formatDayLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function BurndownChartWidget({ projectId }: { projectId: string }) {
  const { data: sprints = [], isLoading: isLoadingSprints } = useSprints(projectId)

  const activeSprintId = (() => {
    const active = (sprints as any[]).find((s) => s.status === 'ACTIVE')
    return active?.id ?? (sprints as any[])[0]?.id ?? null
  })()

  const { data: burndown, isLoading: isLoadingBurndown } = useSprintBurndown(projectId, activeSprintId)

  const data = (burndown?.points ?? []).map((p: any) => ({
    day: formatDayLabel(p.date),
    idealRemaining: p.idealRemaining,
    actualRemaining: p.actualRemaining,
  }))

  return (
    <div className="h-full">
      {isLoadingSprints || !activeSprintId ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          Loading burndown…
        </div>
      ) : isLoadingBurndown ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          Loading chart…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid stroke="#94a3b8" opacity={0.12} />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Line type="monotone" dataKey="idealRemaining" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actualRemaining" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

