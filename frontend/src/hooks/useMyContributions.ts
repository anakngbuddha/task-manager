import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export type MyContributionsResponse = {
  days: number
  userId: string
  countsByDay: Record<string, number>
}

export function useMyContributions(days = 365) {
  return useQuery({
    queryKey: ['my-task-contributions', days],
    queryFn: async () => {
      const { data } = await api.get<MyContributionsResponse>('/activity/task-contributions', { params: { days } })
      return data
    },
  })
}


