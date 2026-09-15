import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/**
 * Reconciliation interval for the project message list.
 *
 * This used to be 3000ms, which meant every open tab refetched the entire
 * message list 20 times a minute even though the backend already emits
 * `message:project` over Socket.IO on every send (QA_REPORT M7). The socket is
 * the delivery path; this poll only exists to heal a client that missed events.
 *
 * Paired with refetchOnWindowFocus / refetchOnReconnect below, a backgrounded
 * tab catches up the instant the user returns rather than depending on a fast
 * timer, so the slower interval costs nothing in perceived freshness.
 */
const MESSAGE_RECONCILE_INTERVAL_MS = 20_000

export function useProjectMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-messages', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const { data } = await api.get(`/projects/${projectId}/messages`)
      return data
    },
    enabled: !!projectId,
    refetchInterval: MESSAGE_RECONCILE_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export function useSendProjectMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { projectId: string; content: string; fileUrl?: string; fileName?: string; optimisticId?: string; authorId?: string; authorName?: string; authorEmail?: string }) => {
      const { projectId, optimisticId, authorId, authorName, authorEmail, ...body } = payload
      const { data } = await api.post(`/projects/${projectId}/messages`, body)
      return data
    },
    onMutate: async (newMsg) => {
      await queryClient.cancelQueries({ queryKey: ['project-messages', newMsg.projectId] })
      const previous = queryClient.getQueryData(['project-messages', newMsg.projectId])

      queryClient.setQueryData(['project-messages', newMsg.projectId], (old: any) => {
        return [...(old || []), {
          id: newMsg.optimisticId || `temp-${Date.now()}`,
          projectId: newMsg.projectId,
          authorId: newMsg.authorId || '',
          author: {
            id: newMsg.authorId || '',
            name: newMsg.authorName || null,
            email: newMsg.authorEmail || null,
          },
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
        queryClient.setQueryData(['project-messages', newMsg.projectId], context.previous)
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-messages', vars.projectId] })
    },
  })
}
