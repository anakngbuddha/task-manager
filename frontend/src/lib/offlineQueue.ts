import { api } from './api'
import { offlineStore } from './offlineStore'

interface QueueMutationArgs {
  method: string
  url: string
  body?: any
  onQueued?: () => void
}

export async function queueOrRunMutation<T>(args: QueueMutationArgs): Promise<{ queued: boolean; data?: T }> {
  const isOnline = typeof window !== 'undefined' && navigator.onLine

  if (isOnline) {
    try {
      const response = await api.request({
        method: args.method,
        url: args.url,
        data: args.body
      })
      return { queued: false, data: response.data }
    } catch (error) {
      if (error instanceof Error && (error.message === 'Network Error' || (error as any).code === 'ERR_NETWORK')) {
        await offlineStore.addMutation({
          url: args.url,
          method: args.method,
          body: args.body,
          timestamp: Date.now()
        })
        if (args.onQueued) args.onQueued()
        return { queued: true }
      }
      throw error
    }
  } else {
    await offlineStore.addMutation({
      url: args.url,
      method: args.method,
      body: args.body,
      timestamp: Date.now()
    })
    if (args.onQueued) args.onQueued()
    return { queued: true }
  }
}

export type FlushResult = {
  succeeded: number
  failed: Array<{ url: string; method: string; status?: number; message: string }>
  networkError: boolean
}

export async function flushOfflineQueue(): Promise<FlushResult> {
  const result: FlushResult = { succeeded: 0, failed: [], networkError: false }

  if (typeof window !== 'undefined' && !navigator.onLine) return result
  
  const mutations = await offlineStore.getMutations()
  if (!mutations.length) return result

  for (const mut of mutations) {
    if (!mut.id) continue
    try {
      await api.request({
        method: mut.method,
        url: mut.url,
        data: mut.body
      })
      await offlineStore.deleteMutation(mut.id)
      result.succeeded++
    } catch (error) {
      if (error instanceof Error && (error.message === 'Network Error' || (error as any).code === 'ERR_NETWORK')) {
        result.networkError = true
        break
      }
      const status = (error as any)?.response?.status as number | undefined
      const message = (error as any)?.response?.data?.error ?? (error instanceof Error ? error.message : 'Unknown error')
      result.failed.push({ url: mut.url, method: mut.method, status, message })
      await offlineStore.deleteMutation(mut.id)
    }
  }

  return result
}
