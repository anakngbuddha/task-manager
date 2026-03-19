import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks`)
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      description?: string
      projectId: string
      assigneeId?: string
      status?: string
      sprintId?: string | null
      priority?: string
      deadline?: string | null
    }) => {
      const { data } = await api.post('/tasks', payload)
      return data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId, ...payload }: {
      id: string
      projectId: string
      status?: string
      title?: string
      description?: string
      priority?: string
      sprintId?: string | null
      deadline?: string | null
    }) => {
      const { data } = await api.patch(`/tasks/${id}`, payload)
      return data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) => {
      await api.delete(`/tasks/${id}`)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
    },
  })
}

export function useCreateTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, targetTaskId, type }: { taskId: string; targetTaskId: string; type: 'BLOCKS' | 'IS_BLOCKED_BY', projectId: string }) => {
      const { data } = await api.post(`/tasks/${taskId}/dependencies`, { targetTaskId, type })
      return data
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
    },
  })
}

export function useDeleteTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, depId }: { taskId: string; depId: string; projectId: string }) => {
      await api.delete(`/tasks/${taskId}/dependencies/${depId}`)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
    },
  })
}
