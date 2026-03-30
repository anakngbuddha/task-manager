import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED'

export interface SprintTask {
  id: string
  title: string
  status: string
  priority: string
  assigneeId: string | null
  completedAt: string | null
  assignee: { id: string; name: string | null; email: string } | null
}

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal?: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
  completedAt: string | null
  createdAt: string
  tasks: SprintTask[]
  _count?: { tasks: number }
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/sprints`)
      return data as Sprint[]
    },
    enabled: !!projectId,
  })
}

export function useCreateSprint(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      goal?: string
      startDate?: string
      endDate?: string
    }) => {
      const { data } = await api.post(`/projects/${projectId}/sprints`, payload)
      return data as Sprint
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })
}

export function useUpdateSprint(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      sprintId: string
      name?: string
      goal?: string | null
      startDate?: string
      endDate?: string
    }) => {
      const { sprintId, ...body } = payload
      const { data } = await api.patch(`/projects/${projectId}/sprints/${sprintId}`, body)
      return data as Sprint
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })
}

export function useStartSprint(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      sprintId: string
      startDate: string
      endDate: string
    }) => {
      const { sprintId, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/sprints/${sprintId}/start`, body)
      return data as Sprint
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useCompleteSprint(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      sprintId: string
      moveIncompleteTasksTo: string
    }) => {
      const { sprintId, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/sprints/${sprintId}/complete`, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export interface SprintBurndownPoint {
  date: string
  completedDaily: number
  completedCumulative: number
  total: number
  idealRemaining: number
  actualRemaining: number
}

export interface SprintBurndownResponse {
  sprint: {
    id: string
    name: string
    startDate: string
    endDate: string
    status: SprintStatus
  }
  totalScope: number
  points: SprintBurndownPoint[]
}

export function useSprintBurndown(projectId: string, sprintId: string | null | undefined) {
  return useQuery({
    queryKey: ['sprint-burndown', projectId, sprintId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/sprints/${sprintId}/burndown`)
      return data as SprintBurndownResponse
    },
    enabled: !!projectId && !!sprintId,
  })
}
