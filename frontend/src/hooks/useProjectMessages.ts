import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-messages', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const { data } = await api.get(`/projects/${projectId}/messages`)
      return data
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  })
}

export function useSendProjectMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { projectId: string; content: string }) => {
      const { projectId, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/messages`, body)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-messages', vars.projectId] })
    },
  })
}

