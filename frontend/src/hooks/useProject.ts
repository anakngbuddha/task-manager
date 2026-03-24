import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; status?: 'ACTIVE' | 'COMPLETED'; boardColumns?: string[] } }) => {
      const res = await api.patch(`/projects/${id}`, data)
      return res.data
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
    },
  })
}

