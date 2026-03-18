import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/members`)
      return data
    },
    enabled: !!projectId,
  })
}

export function useUpdateMemberRole(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { userId: string; role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' }) => {
      await api.patch(`/projects/${projectId}/members/${payload.userId}/role`, { role: payload.role })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

