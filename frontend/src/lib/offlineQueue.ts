import { api } from './api'
import { offlineStore, type OfflineQueuedMutation } from './offlineStore'

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: not cryptographically strong, but fine for local queue IDs
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function isNetworkError(err: any) {
  // Axios sets `code: 'ERR_NETWORK'` for fetch/connect failures
  if (err?.code === 'ERR_NETWORK') return true
  // No response implies request didn't reach server
  if (err && !err.response) return true
  return false
}

export async function queueOrRunMutation<T>(input: {
  method: OfflineQueuedMutation['method']
  url: string
  body?: unknown
  headers?: Record<string, string>
  // Optional optimistic updater for the React Query cache (caller can do this)
  onQueued?: (queued: OfflineQueuedMutation) => void
}): Promise<{ queued: boolean; data?: T }> {
  try {
    const res =
      input.method === 'POST'
        ? await api.post<T>(input.url, input.body, { headers: input.headers })
        : input.method === 'PATCH'
          ? await api.patch<T>(input.url, input.body, { headers: input.headers })
          : input.method === 'PUT'
            ? await api.put<T>(input.url, input.body, { headers: input.headers })
            : await api.delete<T>(input.url, { headers: input.headers, data: input.body as any })

    return { queued: false, data: res.data }
  } catch (err) {
    // Queue only when offline / network failure. For 4xx/5xx we should fail fast.
    if (!navigator.onLine || isNetworkError(err)) {
      const queued: OfflineQueuedMutation = {
        id: uuid(),
        createdAt: Date.now(),
        method: input.method,
        url: input.url,
        body: input.body,
        headers: input.headers,
      }
      await offlineStore.enqueueMutation(queued)
      input.onQueued?.(queued)
      return { queued: true }
    }
    throw err
  }
}

export async function flushOfflineQueue(max = 50) {
  const items = await offlineStore.listQueuedMutations(max)
  for (const item of items) {
    try {
      await queueOrRunMutation({
        method: item.method,
        url: item.url,
        body: item.body,
        headers: item.headers,
      })
      // If it wasn't queued, it succeeded now. Remove it.
      await offlineStore.removeQueuedMutation(item.id)
    } catch (err) {
      // Stop early if still failing; we'll retry on next reconnect.
      if (!navigator.onLine || isNetworkError(err)) return
      // Non-network errors mean the mutation is invalid now; drop it.
      await offlineStore.removeQueuedMutation(item.id)
    }
  }
}

