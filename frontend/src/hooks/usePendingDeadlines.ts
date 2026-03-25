import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface PendingDeadlineItem {
  kind: 'DEADLINE'
  id: string
  title: string
  deadline: string
  status: string
  project: { id: string; name: string }
}

export function usePendingDeadlines(opts?: { daysAhead?: number; limit?: number }) {
  const daysAhead = opts?.daysAhead ?? 14
  const limit = opts?.limit ?? 10

  return useQuery({
    queryKey: ['pending-deadlines', daysAhead, limit],
    queryFn: async () => {
      const { data } = await api.get('/projects/pending-deadlines', {
        params: { daysAhead, limit },
      })
      return data as PendingDeadlineItem[]
    },
    staleTime: 60 * 1000,
  })
}
