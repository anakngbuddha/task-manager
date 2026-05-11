import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queueOrRunMutation } from '../lib/offlineQueue'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects')
      return data
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const result = await queueOrRunMutation<any>({
        method: 'POST',
        url: '/projects',
        body: { name },
        onQueued: () => {
          // Optimistically add the project to the cache so UI updates immediately
          queryClient.setQueryData(['projects'], (old: any[] | undefined) => {
            const optimistic = {
              id: `offline_${Date.now()}`,
              name,
              _offline: true,
              createdAt: new Date().toISOString(),
            }
            return [...(old ?? []), optimistic]
          })
        },
      })
      return result.queued
        ? { _queued: true, name }
        : result.data
    },
    onSuccess: (data: any) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
      queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
    },
  })
}

export interface ProjectsDashboardProject {
  id: string
  name: string
  totalTasks: number
  doneTasks: number
  completionPct: number
  isFinished: boolean
  members: Array<{
    id: string
    name?: string | null
    email?: string | null
    avatar?: string | null
  }>
  // Keys are task statuses from the backend.
  taskCountsByStatus: Record<string, number>
  avgCompletionHours: number | null
}

export interface ProjectsDashboardResponse {
  totalProjects: number
  totalTasks: number
  completedTasks: number
  activeMembers: number
  finishedProjects: number
  finishedPercentage: number
  projects: ProjectsDashboardProject[]
}

export function useProjectsDashboard() {
  return useQuery({
    queryKey: ['projects-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/projects/dashboard')
      return data as ProjectsDashboardResponse
    },
  })
}