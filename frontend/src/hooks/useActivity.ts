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

export function useProjectActivity(projectId: string, take = 8) {
  return useQuery({
    queryKey: ['project-activity', projectId, take],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/activity`, { params: { take } })
      return data
    },
    enabled: !!projectId,
  })
}

