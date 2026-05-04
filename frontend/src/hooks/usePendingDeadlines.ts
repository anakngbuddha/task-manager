import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface PendingDeadlineItem {
  kind: 'DEADLINE'
  id: string
  title: string
  deadline: string
  status: string
  type: string
  project: { id: string; name: string }
}

export function usePendingDeadlines(opts?: { daysAhead?: number; daysBehind?: number; limit?: number; includeCompleted?: boolean }) {
  const daysAhead = opts?.daysAhead ?? 14
  const daysBehind = opts?.daysBehind ?? 0
  const limit = opts?.limit ?? 10
  const includeCompleted = opts?.includeCompleted ?? false

  return useQuery({
    queryKey: ['pending-deadlines', daysAhead, daysBehind, limit, includeCompleted],
    queryFn: async () => {
      const { data } = await api.get('/projects/pending-deadlines', {
        params: { daysAhead, daysBehind, limit, includeCompleted },
      })
      return data as PendingDeadlineItem[]
    },
    staleTime: 60 * 1000,
  })
}
