import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useGithubConnect() {
  return useQuery({
    queryKey: ['github-connect'],
    queryFn: async () => {
      const { data } = await api.get('/github/connect')
      return data as { url: string }
    },
  })
}

export function useGithubInstallation(projectId?: string) {
  return useQuery({
    queryKey: ['github-installation', projectId ?? ''],
    queryFn: async () => {
      if (!projectId) throw new Error('Missing projectId')
      const { data } = await api.get(`/projects/${projectId}/github`)
      return data
    },
    enabled: !!projectId,
    retry: false,
  })
}

export function useGithubRepos(projectId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['github-repos', projectId ?? ''],
    queryFn: async () => {
      if (!projectId) throw new Error('Missing projectId')
      const { data } = await api.get(`/projects/${projectId}/github/repos`)
      return data as {
        installationId: number
        repositories: Array<{
          repoId: number
          fullName: string
          private: boolean
          htmlUrl: string
        }>
      }
    },
    enabled: !!projectId && enabled,
    retry: false,
  })
}

export function useLinkGithubInstallation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, installationId }: { projectId: string; installationId: number }) => {
      const { data } = await api.post(`/projects/${projectId}/github/connect`, { installationId })
      return data
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['github-installation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
    },
  })
}

/**
 * Polls the backend every 2s for an unclaimed (pending) GitHub installation
 * that arrived via webhook. The `enabled` flag controls whether polling runs.
 */
export function useGithubPendingInstallation(enabled: boolean) {
  return useQuery({
    queryKey: ['github-pending-installation'],
    queryFn: async () => {
      const { data, status } = await api.get('/github/pending-installation', {
        validateStatus: (s) => s === 200 || s === 204,
      })
      if (status === 204) return null
      return data as { installationId: number; repos: string[] }
    },
    enabled,
    refetchInterval: enabled ? 2000 : false,
    retry: false,
  })
}

export function useDisconnectGithub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`/projects/${projectId}/github`)
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['github-installation', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
    },
  })
}
