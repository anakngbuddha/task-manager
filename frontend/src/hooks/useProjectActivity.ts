import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/activity`)
      return res.data
    },
    enabled: !!projectId,
  })
}
