import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
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
      const { data } = await api.post('/projects', { name })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
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