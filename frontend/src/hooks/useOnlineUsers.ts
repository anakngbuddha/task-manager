import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { socket } from '@/lib/socket'

export type OnlineUserStatus = 'ONLINE' | 'IDLE' | 'OFFLINE'

export type OnlineUser = {
  userId: string
  status: OnlineUserStatus
  lastSeenAt: string
}

export function useOnlineUsers(enabled = true) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUser>>({})

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function fetchOnlineUsers() {
      try {
        const { data } = await api.get<OnlineUser[]>('/admin/users/online')
        if (cancelled) return
        setOnlineUsers(
          Object.fromEntries(data.map((entry) => [entry.userId, entry])),
        )
      } catch (error) {
        console.error('Failed to fetch online users', error)
      }
    }

    fetchOnlineUsers()

    if (!socket.connected) {
      socket.connect()
    }

    const handleStatusUpdate = (payload: OnlineUser) => {
      setOnlineUsers((current) => ({
        ...current,
        [payload.userId]: payload,
      }))
    }

    socket.on('user:status:update', handleStatusUpdate)

    return () => {
      cancelled = true
      socket.off('user:status:update', handleStatusUpdate)
    }
  }, [enabled])

  return onlineUsers
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
