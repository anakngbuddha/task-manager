import { GripVertical, Clock, BarChart3, Activity, Gauge, Layers } from 'lucide-react'
import type { DashboardWidgetType } from '@/hooks/useDashboardLayout'

const typeToTitle: Record<DashboardWidgetType, { title: string; Icon: any }> = {
  task_stats: { title: 'Task stats', Icon: Layers },
  recent_activity: { title: 'Recent activity', Icon: Activity },
  workload_summary: { title: 'Workload summary', Icon: Gauge },
  time_summary: { title: 'Time summary', Icon: Clock },
  velocity_chart: { title: 'Velocity', Icon: BarChart3 },
  burndown_chart: { title: 'Burndown', Icon: BarChart3 },
}

export function WidgetTitle({ type }: { type: DashboardWidgetType }) {
  const entry = typeToTitle[type]
  const Icon = entry.Icon ?? GripVertical

  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">{entry.title}</span>
    </div>
  )
}

