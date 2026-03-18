import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useActivity(take = 50) {
  return useQuery({
    queryKey: ['activity', take],
    queryFn: async () => {
      const { data } = await api.get('/activity', { params: { take } })
      return data
    },
  })
}

