import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { createSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

/**
 * Real-time task synchronization hook.
 *
 * Connects to the project's Socket.IO room and listens for task:created,
 * task:updated, and task:deleted events emitted by the backend.  When another
 * user mutates a task, this hook patches the React Query cache immediately so
 * every component consuming `useTasks(projectId)` re-renders with fresh data —
 * no page refresh needed.
 *
 * Events from the **current** user are ignored because React Query's own
 * `onSuccess` invalidation already handles those.
 */
export function useTaskSync(projectId: string | undefined) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!projectId || !session?.user?.id) return

    const currentUserId = session.user.id

    // Create a dedicated socket for task sync.
    const socket = createSocket()
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:project', projectId)
    })

    // ── task:created ─────────────────────────────────────────────────────
    socket.on('task:created', (payload: { task: any; actorId: string }) => {
      if (payload.actorId === currentUserId) return

      queryClient.setQueryData(['tasks', projectId], (old: any[] | undefined) => {
        if (!old) return [payload.task]
        // Guard against duplicates (e.g. reconnect replays)
        if (old.some((t: any) => t.id === payload.task.id)) return old
        return [payload.task, ...old]
      })

      // Refresh dashboard-level aggregates
      queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
    })

    // ── task:updated ─────────────────────────────────────────────────────
    socket.on('task:updated', (payload: { task: any; actorId: string }) => {
      if (payload.actorId === currentUserId) return

      queryClient.setQueryData(['tasks', projectId], (old: any[] | undefined) => {
        if (!old) return old
        return old.map((t: any) =>
          t.id === payload.task.id ? { ...t, ...payload.task } : t,
        )
      })

      queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
    })

    // ── task:deleted ─────────────────────────────────────────────────────
    socket.on('task:deleted', (payload: { id: string; projectId: string; actorId: string }) => {
      if (payload.actorId === currentUserId) return

      queryClient.setQueryData(['tasks', projectId], (old: any[] | undefined) => {
        if (!old) return old
        return old.filter((t: any) => t.id !== payload.id)
      })

      queryClient.invalidateQueries({ queryKey: ['projects-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
    })

    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [projectId, session?.user?.id, queryClient])
}
