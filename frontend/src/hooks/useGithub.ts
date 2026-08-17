import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useGithubConnect() {
  return useQuery({
    queryKey: ['github-connect'],
    queryFn: async () => {
      const { data } = await api.get('/github/connect')
      return data as { url: string }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useGithubInstallation(_projectId?: string) {
  return useQuery({
    queryKey: ['github-installation'],
    queryFn: async () => {
      const res = await api.get('/github/installation', {
        // Backend returns 404 when no installation is linked.
        // Treat that as a valid "not connected" state instead of a query error.
        validateStatus: (status) => status === 200 || status === 404,
      })
      if (res.status === 404) return null
      return res.data
    },
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
        repositories: Array<{
          id?: string
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
      void projectId
      const { data } = await api.post(`/github/connect`, { installationId })
      return data
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-pending-installation'] })
      queryClient.invalidateQueries({ queryKey: ['github-available-repos', projectId] })
    },
  })
}

export function useGithubPendingInstallation(enabled: boolean) {
  return useQuery({
    queryKey: ['github-pending-installation'],
    queryFn: async () => {
      // Try the in-memory pending store first (works when webhooks reach the server)
      const pending = await api.get('/github/pending-installation', {
        validateStatus: (s) => s === 200 || s === 204,
      })
      if (pending.status === 200 && pending.data) {
        return pending.data as { installationId: number; repos: string[] }
      }

      // Fallback: query GitHub API directly for unclaimed installations
      // (works in dev without webhooks)
      const detect = await api.get('/github/detect-installation', {
        validateStatus: (s) => s === 200 || s === 204,
      })
      if (detect.status === 200 && detect.data) {
        return detect.data as { installationId: number; repos: string[] }
      }

      return null
    },
    enabled,
    refetchInterval: enabled ? 2500 : false,
    retry: false,
  })
}

export function useDisconnectGithub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete('/github/installation')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
      queryClient.removeQueries({ queryKey: ['github-installation'] })
      queryClient.invalidateQueries({ queryKey: ['github-repos'] })
      queryClient.invalidateQueries({ queryKey: ['github-available-repos'] })
    },
  })
}

export function useGithubAvailableRepos(projectId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['github-available-repos', projectId ?? ''],
    queryFn: async () => {
      if (!projectId) throw new Error('Missing projectId')
      const { data } = await api.get(`/projects/${projectId}/github/available-repos`)
      return data as {
        repositories: Array<{
          id: string
          repoId: number
          fullName: string
          private: boolean
          htmlUrl: string
          defaultBranch: string
        }>
      }
    },
    enabled: !!projectId && enabled,
    retry: false,
  })
}

export function useAssignProjectRepo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, repoId }: { projectId: string; repoId: string }) => {
      const { data } = await api.post(`/projects/${projectId}/github/repos`, { repoId })
      return data
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-available-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
    },
  })
}

export function useAssignAllProjectRepos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { data } = await api.post(`/projects/${projectId}/github/repos/assign-all`)
      return data
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-available-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
    },
  })
}

export function useUnassignProjectRepo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, repoId }: { projectId: string; repoId: string }) => {
      await api.delete(`/projects/${projectId}/github/repos/${repoId}`)
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['github-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-available-repos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
    },
  })
}
