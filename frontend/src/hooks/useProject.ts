import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`)
      return data
    },
    enabled: !!projectId,
  })
}

