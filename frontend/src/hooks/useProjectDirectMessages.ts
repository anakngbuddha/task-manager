import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useProjectDirectMessages(projectId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['project-direct-messages', projectId, otherUserId],
    queryFn: async () => {
      if (!projectId || !otherUserId) return []
      const { data } = await api.get(`/projects/${projectId}/direct-messages/${otherUserId}`)
      return data
    },
    enabled: !!projectId && !!otherUserId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

export function useSendProjectDirectMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { projectId: string; otherUserId: string; content: string; fileUrl?: string; fileName?: string; optimisticId?: string; senderId?: string; senderName?: string; senderEmail?: string }) => {
      const { projectId, otherUserId, optimisticId, senderId, senderName, senderEmail, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/direct-messages/${otherUserId}`, body)
      return data
    },
    onMutate: async (newMsg) => {
      await queryClient.cancelQueries({ queryKey: ['project-direct-messages', newMsg.projectId, newMsg.otherUserId] })
      const previous = queryClient.getQueryData(['project-direct-messages', newMsg.projectId, newMsg.otherUserId])
      
      queryClient.setQueryData(['project-direct-messages', newMsg.projectId, newMsg.otherUserId], (old: any) => {
        return [...(old || []), {
          id: newMsg.optimisticId || `temp-${Date.now()}`,
          projectId: newMsg.projectId,
          senderId: newMsg.senderId || '',
          sender: {
            id: newMsg.senderId || '',
            name: newMsg.senderName || null,
            email: newMsg.senderEmail || null,
          },
          recipientId: newMsg.otherUserId,
          content: newMsg.content,
          fileUrl: newMsg.fileUrl,
          fileName: newMsg.fileName,
          createdAt: new Date().toISOString(),
        }]
      })
      
      return { previous }
    },
    onError: (_err, newMsg, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['project-direct-messages', newMsg.projectId, newMsg.otherUserId], context.previous)
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['project-direct-messages', vars.projectId, vars.otherUserId],
      })
    },
  })
}

