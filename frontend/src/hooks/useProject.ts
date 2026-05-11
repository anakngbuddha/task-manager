import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queueOrRunMutation } from '../lib/offlineQueue'

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

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; status?: 'ACTIVE' | 'COMPLETED' | 'AXED'; boardColumns?: string[]; githubStatusMap?: Record<string, string | null> } }) => {
      const result = await queueOrRunMutation<any>({
        method: 'PATCH',
        url: `/projects/${id}`,
        body: data,
        onQueued: () => {
          // Optimistically update the project cache
          queryClient.setQueryData(['project', id], (old: any) => {
            if (!old) return old
            return { ...old, ...data, _offline: true }
          })
        },
      })
      return result.queued
        ? { _queued: true }
        : result.data
    },
    onSuccess: (data: any, variables: any) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['project', variables.id] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
      }
    },
  })
}
