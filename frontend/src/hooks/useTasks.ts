import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queueOrRunMutation } from '../lib/offlineQueue'
import type { TaskType } from '../lib/taskTypes'
import { useTaskSync } from './useTaskSync'

export function useTasks(projectId: string) {
  // Real-time sync: listens for task:created / task:updated / task:deleted
  // from other users via Socket.IO and patches the React Query cache.
  useTaskSync(projectId)

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
      parentId?: string | null
      priority?: string
      deadline?: string | null
      type?: TaskType
    }) => {
      const result = await queueOrRunMutation<any>({
        method: 'POST',
        url: '/tasks',
        body: payload,
        onQueued: () => {
          // Optimistically add to the task list
          queryClient.setQueryData(['tasks', payload.projectId], (old: any[] | undefined) => {
            const optimistic = {
              id: `offline_${Date.now()}`,
              ...payload,
              _offline: true,
              createdAt: new Date().toISOString(),
              tags: [],
            }
            return [...(old ?? []), optimistic]
          })
        },
      })
      return result.queued
        ? { _queued: true, id: `offline_${Date.now()}`, ...payload }
        : result.data
    },
    onSuccess: (data: any, vars) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
      }
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
      githubPrUrl?: string | null
      type?: TaskType
    }) => {
      const result = await queueOrRunMutation<any>({
        method: 'PATCH',
        url: `/tasks/${id}`,
        body: payload,
        onQueued: () => {
          // Optimistically update the task in the cache
          queryClient.setQueryData(['tasks', projectId], (old: any[] | undefined) => {
            if (!old) return old
            return old.map((t: any) =>
              String(t.id) === String(id) ? { ...t, ...payload, _offline: true } : t
            )
          })
        },
      })
      return result.queued
        ? { _queued: true }
        : result.data
    },
    onSuccess: (data: any, vars) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
      }
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const result = await queueOrRunMutation<any>({
        method: 'DELETE',
        url: `/tasks/${id}`,
        onQueued: () => {
          // Optimistically remove the task from the cache
          queryClient.setQueryData(['tasks', projectId], (old: any[] | undefined) => {
            if (!old) return old
            return old.filter((t: any) => String(t.id) !== String(id))
          })
        },
      })
      return result.queued
        ? { _queued: true }
        : undefined
    },
    onSuccess: (data: any, vars) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
      }
    },
  })
}

export function useCreateTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, targetTaskId, type }: { taskId: string; targetTaskId: string; type: 'BLOCKS' | 'IS_BLOCKED_BY', projectId: string }) => {
      const result = await queueOrRunMutation<any>({
        method: 'POST',
        url: `/tasks/${taskId}/dependencies`,
        body: { targetTaskId, type },
      })
      return result.queued
        ? { _queued: true }
        : result.data
    },
    onSuccess: (data: any, vars) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
      }
    },
  })
}

export function useDeleteTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, depId }: { taskId: string; depId: string; projectId: string }) => {
      const result = await queueOrRunMutation<any>({
        method: 'DELETE',
        url: `/tasks/${taskId}/dependencies/${depId}`,
      })
      return result.queued
        ? { _queued: true }
        : undefined
    },
    onSuccess: (data: any, vars) => {
      if (!data?._queued) {
        queryClient.invalidateQueries({ queryKey: ['tasks', vars.projectId] })
      }
    },
  })
}
