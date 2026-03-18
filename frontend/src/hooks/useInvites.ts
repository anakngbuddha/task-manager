import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useInvite(code: string | undefined) {
  return useQuery({
    queryKey: ['invite', code],
    enabled: !!code,
    queryFn: async () => {
      const { data } = await api.get(`/invites/${code}`)
      return data as {
        code: string
        projectId: string
        projectName: string
        expiresAt: string
        isExpired: boolean
      }
    },
  })
}

export function useCreateInvite(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${projectId}/invites`)
      return data as {
        code: string
        projectId: string
        expiresAt: string
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post(`/invites/${code}/accept`)
      return data as { projectId: string; projectName: string }
    },
  })
}

