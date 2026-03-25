import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectDirectMessages(projectId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['project-direct-messages', projectId, otherUserId],
    queryFn: async () => {
      if (!projectId || !otherUserId) return []
      const { data } = await api.get(`/projects/${projectId}/direct-messages/${otherUserId}`)
      return data
    },
    enabled: !!projectId && !!otherUserId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

export function useSendProjectDirectMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { projectId: string; otherUserId: string; content: string }) => {
      const { projectId, otherUserId, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/direct-messages/${otherUserId}`, body)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['project-direct-messages', vars.projectId, vars.otherUserId],
      })
    },
  })
}

