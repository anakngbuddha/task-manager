import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const DASHBOARD_WIDGET_TYPES = [
  'velocity_chart',
  'burndown_chart',
  'workload_summary',
  'time_summary',
  'recent_activity',
  'task_stats',
] as const

export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number]

export type DashboardWidgetConfig = {
  id: string
  type: DashboardWidgetType
  position: { x: number; y: number }
  size: { w: number; h: number }
}

export type DashboardLayoutResponse = {
  layout: DashboardWidgetConfig[]
}

export function useDashboardLayout(projectId: string) {
  return useQuery({
    queryKey: ['dashboard-layout', projectId],
    queryFn: async () => {
      const { data } = await api.get<DashboardLayoutResponse>(`/projects/${projectId}/dashboard-layout`)
      return data.layout
    },
    enabled: !!projectId,
    retry: false,
  })
}

export function useUpdateDashboardLayout(projectId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (layout: DashboardWidgetConfig[]) => {
      const { data } = await api.patch<{ layout: DashboardWidgetConfig[] }>(
        `/projects/${projectId}/dashboard-layout`,
        { layout },
      )
      return data.layout
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-layout', projectId] })
    },
  })
}

