import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return []
      const { data } = await api.get(`/tasks/${taskId}/comments`)
      return data
    },
    enabled: !!taskId,
  })
}

export function useAddTaskComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { taskId: string; content: string; parentId?: string }) => {
      const { taskId, ...body } = payload
      const { data } = await api.post(`/tasks/${taskId}/comments`, body)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', vars.taskId] })
    },
  })
}

