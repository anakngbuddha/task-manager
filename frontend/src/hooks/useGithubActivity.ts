import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface GithubActivityEvent {
  id: string
  projectId: string
  repoId: string
  eventType: string
  branch: string | null
  sha: string | null
  prNumber: number | null
  prTitle: string | null
  author: string | null
  htmlUrl: string | null
  message: string | null
  summary: any
  githubDeliveryId: string | null
  createdAt: string
  repo: {
    repoFullName: string
    repoId: number
  }
}

export function useGithubActivity(
  projectId?: string,
  options?: { eventType?: string; repo?: string; cursor?: string; limit?: number },
) {
  const params = new URLSearchParams()
  if (options?.eventType) params.set('eventType', options.eventType)
  if (options?.repo) params.set('repo', options.repo)
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.limit) params.set('limit', String(options.limit))
  const qs = params.toString()

  return useQuery({
    queryKey: ['github-activity', projectId ?? '', qs],
    queryFn: async () => {
      if (!projectId) throw new Error('Missing projectId')
      const { data } = await api.get(
        `/projects/${projectId}/github/events${qs ? `?${qs}` : ''}`,
      )
      return data as { events: GithubActivityEvent[]; nextCursor: string | null }
    },
    enabled: !!projectId,
    retry: false,
    refetchInterval: 30_000,
  })
}
