import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface TaskTag {
  taskId: string
  tagId: string
  tag: Tag
}

/** Autocomplete: search for tags by name */
export function useTags(search?: string) {
  return useQuery({
    queryKey: ['tags', search ?? ''],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const { data } = await api.get(`/tags${params}`)
      return data as Tag[]
    },
    staleTime: 30_000,
  })
}

/** Get all tags attached to a specific task */
export function useTaskTags(taskId?: string) {
  return useQuery({
    queryKey: ['task-tags', taskId ?? ''],
    queryFn: async () => {
      if (!taskId) throw new Error('Missing taskId')
      const { data } = await api.get(`/tasks/${taskId}/tags`)
      return data as Tag[]
    },
    enabled: !!taskId,
    retry: false,
  })
}

/** Assign a tag to a task by name (creates the tag if new) */
export function useAddTaskTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      taskId,
      name,
      color,
    }: {
      taskId: string
      name: string
      color?: string
      projectId: string
    }) => {
      const { data } = await api.post(`/tasks/${taskId}/tags`, { name, color })
      return data as Tag
    },
    onSuccess: (_, { taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-tags', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

/** Remove a tag from a task */
export function useRemoveTaskTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      taskId,
      tagId,
    }: {
      taskId: string
      tagId: string
      projectId: string
    }) => {
      await api.delete(`/tasks/${taskId}/tags/${tagId}`)
    },
    onSuccess: (_, { taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-tags', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}
