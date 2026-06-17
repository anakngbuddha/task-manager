import { io, type Socket } from 'socket.io-client'

function getSocketURL(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (explicit) return explicit.replace(/\/$/, '')

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (apiUrl) {
    try {
      const url = new URL(apiUrl)
      return url.origin
    } catch {
      return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:3000'
    }
  }
  return 'http://localhost:3000'
}

export const SOCKET_URL = getSocketURL()

export const SOCKET_OPTIONS = {
  withCredentials: true,
  autoConnect: false,
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  reconnection: true,
  // Prevent infinite retry spam when socket endpoint is misconfigured/unavailable.
  reconnectionAttempts: 8,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.4,
  timeout: 15000,
  forceNew: false,
}

export function createSocket(): Socket {
  return io(SOCKET_URL, { ...SOCKET_OPTIONS })
}

export const socket = io(SOCKET_URL, {
  ...SOCKET_OPTIONS,
})
