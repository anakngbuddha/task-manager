import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectSeen(projectId: string | undefined) {
  return useQuery({
    queryKey: ['seen', 'project', projectId],
    queryFn: async () => {
      if (!projectId) return { messageId: null, createdAt: null, seenBy: [] }
      const { data } = await api.get(`/projects/${projectId}/messages/seen`)
      return data
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  })
}

export function useDirectSeen(projectId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['seen', 'direct', projectId, otherUserId],
    queryFn: async () => {
      if (!projectId || !otherUserId) return { messageId: null, createdAt: null, seenBy: [] }
      const { data } = await api.get(`/projects/${projectId}/direct-messages/${otherUserId}/seen`)
      return data
    },
    enabled: !!projectId && !!otherUserId,
    refetchInterval: 5000,
  })
}

export function useMarkProjectRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.post(`/projects/${projectId}/messages/read`)
    },
    onSuccess: (_d, projectId) => {
      qc.invalidateQueries({ queryKey: ['seen', 'project', projectId] })
    },
  })
}

export function useMarkDirectRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { projectId: string; otherUserId: string }) => {
      await api.post(`/projects/${payload.projectId}/direct-messages/${payload.otherUserId}/read`)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['seen', 'direct', vars.projectId, vars.otherUserId] })
    },
  })
}

