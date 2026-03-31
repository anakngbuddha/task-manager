import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface TaskGithubLink {
  id: string
  taskId: string
  url: string
  type: string
  title: string | null
  status: string | null
  author: string | null
  number: number | null
  sha: string | null
  repoFullName: string | null
  metadata: any
  createdAt: string
  updatedAt: string
  autoTransitionStatus?: string | null
}

export function useTaskGithubLinks(taskId?: string) {
  return useQuery({
    queryKey: ['task-github-links', taskId ?? ''],
    queryFn: async () => {
      if (!taskId) throw new Error('Missing taskId')
      const { data } = await api.get(`/tasks/${taskId}/github-links`)
      return data as TaskGithubLink[]
    },
    enabled: !!taskId,
    retry: false,
  })
}

export function useAddTaskGithubLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, url }: { taskId: string; url: string }) => {
      const { data } = await api.post(`/tasks/${taskId}/github-links`, { url })
      return data as TaskGithubLink
    },
    onSuccess: (data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-github-links', taskId] })
      if (data.autoTransitionStatus) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }
    },
  })
}

export function useRemoveTaskGithubLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, linkId }: { taskId: string; linkId: string }) => {
      await api.delete(`/tasks/${taskId}/github-links/${linkId}`)
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-github-links', taskId] })
    },
  })
}
