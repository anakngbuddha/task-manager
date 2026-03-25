import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: number
  icon: LucideIcon
  subtitle?: string
}

export default function MetricCard({ title, value, icon: Icon, subtitle }: MetricCardProps) {
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="mt-2 size-4 text-muted-foreground" />
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardHeader>
    </Card>
  )
}
