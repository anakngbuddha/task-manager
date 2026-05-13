import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-client'
import { socket } from '@/lib/socket'

const HEARTBEAT_INTERVAL_MS = 30_000
const IDLE_TIMEOUT_MS = 2 * 60_000

export function usePresenceTracking() {
  const { data: session } = useSession()
  const idleRef = useRef(false)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const markActive = () => {
      lastActivityRef.current = Date.now()
      if (idleRef.current) {
        idleRef.current = false
        socket.emit('activity:idle', { isIdle: false })
      }
    }

    const connectSocket = () => {
      if (!socket.connected) {
        socket.connect()
      }
      socket.emit('auth:identify', { userId })
    }

    connectSocket()
    socket.on('connect', connectSocket)

    const heartbeat = window.setInterval(() => {
      if (!socket.connected) {
        socket.connect()
        return
      }

      const inactiveFor = Date.now() - lastActivityRef.current
      if (inactiveFor >= IDLE_TIMEOUT_MS) {
        if (!idleRef.current) {
          idleRef.current = true
          socket.emit('activity:idle', { isIdle: true })
        }
        return
      }

      socket.emit('activity:heartbeat')
    }, HEARTBEAT_INTERVAL_MS)

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ]

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true })
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        socket.emit('activity:idle', { isIdle: true })
        idleRef.current = true
        return
      }

      markActive()
      socket.emit('activity:heartbeat')
    }

    const handleUnload = () => {
      socket.emit('activity:disconnect')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.clearInterval(heartbeat)
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActive)
      })
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleUnload)
      socket.off('connect', connectSocket)
      socket.emit('activity:disconnect')
    }
  }, [session?.user?.id])
}
