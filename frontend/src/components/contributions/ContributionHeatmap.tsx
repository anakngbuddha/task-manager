import { useMemo } from 'react'

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function dateKeyUTC(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short' })
}

function intensityClass(count: number) {
  if (count <= 0) return 'bg-muted/60'
  if (count <= 2) return 'bg-emerald-200'
  if (count <= 4) return 'bg-emerald-300'
  if (count <= 7) return 'bg-emerald-400'
  return 'bg-emerald-500'
}

export function ContributionHeatmap({
  countsByDay,
  days = 365,
  showHeader = true,
  cellSizePx = 12,
  gapPx = 4,
}: {
  countsByDay: Record<string, number>
  days?: number
  showHeader?: boolean
  cellSizePx?: number
  gapPx?: number
}) {
  const { cells, monthTicks } = useMemo(() => {
    const safeDays = Math.max(7, Math.min(370, days))
    const today = startOfDayUTC(new Date())
    const start = new Date(today.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000)

    // Align to Sunday like GitHub (week rows)
    const startDow = start.getUTCDay() // 0=Sun
    const gridStart = new Date(start.getTime() - startDow * 24 * 60 * 60 * 1000)

    const totalDays = safeDays + startDow
    const weeks = Math.ceil(totalDays / 7)

    const out: Array<{ key: string; count: number; isInRange: boolean; date: string }> = []
    const ticks: Array<{ weekIndex: number; label: string }> = []

    let lastMonth = -1
    for (let w = 0; w < weeks; w += 1) {
      const weekStart = new Date(gridStart.getTime() + w * 7 * 24 * 60 * 60 * 1000)
      const m = weekStart.getUTCMonth()
      if (m !== lastMonth) {
        ticks.push({ weekIndex: w, label: monthLabel(weekStart) })
        lastMonth = m
      }

      for (let r = 0; r < 7; r += 1) {
        const d = new Date(weekStart.getTime() + r * 24 * 60 * 60 * 1000)
        const key = dateKeyUTC(d)
        const isInRange = d >= start && d <= today
        const count = isInRange ? (countsByDay?.[key] ?? 0) : 0
        out.push({ key, count, isInRange, date: key })
      }
    }

    return { cells: out, monthTicks: ticks }
  }, [countsByDay, days])

  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground mb-2">
          <div className="flex gap-3">
            {monthTicks.slice(0, 12).map((t) => (
              <span
                key={`${t.weekIndex}-${t.label}`}
                className="inline-block"
                style={{ marginLeft: t.weekIndex === 0 ? 0 : t.weekIndex * 0 }}
              >
                {t.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span>Less</span>
            <span className="rounded-sm bg-muted/60 border border-border/60" style={{ height: cellSizePx, width: cellSizePx }} />
            <span className="rounded-sm bg-emerald-200 border border-border/30" style={{ height: cellSizePx, width: cellSizePx }} />
            <span className="rounded-sm bg-emerald-300 border border-border/30" style={{ height: cellSizePx, width: cellSizePx }} />
            <span className="rounded-sm bg-emerald-400 border border-border/30" style={{ height: cellSizePx, width: cellSizePx }} />
            <span className="rounded-sm bg-emerald-500 border border-border/30" style={{ height: cellSizePx, width: cellSizePx }} />
            <span>More</span>
          </div>
        </div>
      )}

      <div className="overflow-auto">
        {/* 7 rows, N columns (weeks) */}
        <div className="grid grid-flow-col grid-rows-7 min-w-max" style={{ gap: `${gapPx}px` }}>
          {cells.map((c) => (
            <div
              key={c.key}
              title={`${c.date}: ${c.count} contributions`}
              className={[
                'rounded-sm border',
                c.isInRange ? intensityClass(c.count) : 'bg-transparent',
                c.isInRange ? 'border-border/40' : 'border-transparent',
              ].join(' ')}
              style={{ height: cellSizePx, width: cellSizePx }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

