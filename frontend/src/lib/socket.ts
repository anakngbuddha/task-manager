import { io } from 'socket.io-client'

// Derive socket URL from the API URL env var, falling back to same-origin in production
function getSocketURL(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (apiUrl) {
    try {
      const url = new URL(apiUrl)
      // Strip /api path to get the base origin
      return url.origin
    } catch {
      return apiUrl.replace(/\/api\/?$/, '')
    }
  }
  // In production (Vercel), use the Render backend directly
  if (import.meta.env.PROD) {
    return 'https://task-manager-390h.onrender.com'
  }
  // Development fallback
  return 'http://localhost:3000'
}

export const SOCKET_URL = getSocketURL()

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  transports: ['polling', 'websocket'],
})