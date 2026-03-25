import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectDirectInbox(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-direct-inbox', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const { data } = await api.get(`/projects/${projectId}/direct-inbox`)
      return data
    },
    enabled: !!projectId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

