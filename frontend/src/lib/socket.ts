import { io, type Socket } from 'socket.io-client'

let cachedSessionToken: string | null = null

export function setSocketAuthToken(token: string | null | undefined) {
  cachedSessionToken = token || null
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        sessionStorage.setItem('tm_session_token', token)
      } else {
        sessionStorage.removeItem('tm_session_token')
      }
    } catch {
      // ignore storage errors
    }
  }
  if (socket) {
    socket.auth = token ? { token } : {}
  }
}

export function getSocketAuthToken(): string | null {
  if (cachedSessionToken) return cachedSessionToken

  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('tm_session_token')
      if (stored) {
        cachedSessionToken = stored
        return stored
      }
    } catch {
      // ignore storage errors
    }

    try {
      const match = document.cookie.match(/(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/)
      if (match) {
        const cookieToken = decodeURIComponent(match[1])
        cachedSessionToken = cookieToken
        return cookieToken
      }
    } catch {
      // ignore cookie errors
    }
  }

  return null
}

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
  return import.meta.env.PROD && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
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

export function createSocket(token?: string): Socket {
  return io(SOCKET_URL, {
    ...SOCKET_OPTIONS,
    auth: (cb: (data: Record<string, any>) => void) => {
      const active = token || getSocketAuthToken()
      cb(active ? { token: active } : {})
    },
  })
}

export const socket = io(SOCKET_URL, {
  ...SOCKET_OPTIONS,
  auth: (cb: (data: Record<string, any>) => void) => {
    const active = getSocketAuthToken()
    cb(active ? { token: active } : {})
  },
})

