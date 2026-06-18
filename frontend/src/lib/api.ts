import axios, { AxiosHeaders } from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api'),
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (method === 'post') {
    const headers = AxiosHeaders.from(config.headers ?? {})
    if (!headers.get('Idempotency-Key') && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      headers.set('Idempotency-Key', crypto.randomUUID())
    }
    config.headers = headers
  }
  return config
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
  return 'http://localhost:3000'
}

const BACKEND_ORIGIN = getBackendOrigin()

/** Pull a user-facing message from an axios (or unknown) API error. */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data
    if (typeof data?.error === 'string' && data.error.trim()) return data.error
    if (typeof data?.message === 'string' && data.message.trim()) return data.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function resolveFileUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_ORIGIN}${path}`
}  

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Track API errors
    if (err.config && err.response) {
      // Dynamic import to avoid circular dependencies
      import('../hooks/useAnalytics').then(({ trackEvent }) => {
        trackEvent('ERROR', {
          elementId: `API Error: ${err.message}`,
          metadata: {
            source: `API Request: ${err.config.method?.toUpperCase()} ${err.config.url}`,
            status: err.response.status,
            url: err.config.url,
            method: err.config.method?.toUpperCase()
          }
        }).catch(console.error)
      }).catch(console.error)
    }

    const authPaths = ['/login', '/register', '/invite']
    const isAuthPage = authPaths.some(p => window.location.pathname.startsWith(p))
    if (err.response?.status === 401 && !isAuthPage) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)