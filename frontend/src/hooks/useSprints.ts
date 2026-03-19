import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED'

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal?: string | null
  startDate: string
  endDate: string
  status: SprintStatus
  createdAt: string
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
      startDate: string
      endDate: string
      status?: SprintStatus
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
      status?: SprintStatus
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

export interface SprintBurndownPoint {
  date: string // YYYY-MM-DD
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

