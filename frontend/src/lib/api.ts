import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
})

function getBackendOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (apiUrl) {
    try {
      const u = new URL(apiUrl)
      return u.origin
    } catch {
      // Relative URL (e.g. "/api") — can't extract origin
    }
  }
  if (import.meta.env.PROD) {
    return 'https://task-manager-390h.onrender.com'
  }
  return 'http://localhost:3000'
}

const BACKEND_ORIGIN = getBackendOrigin()

export function resolveFileUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_ORIGIN}${path}`
}  

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)