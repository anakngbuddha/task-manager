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

export async function flushOfflineQueue() {
  if (typeof window !== 'undefined' && !navigator.onLine) return
  
  const mutations = await offlineStore.getMutations()
  if (!mutations.length) return

  for (const mut of mutations) {
    if (!mut.id) continue
    try {
      await api.request({
        method: mut.method,
        url: mut.url,
        data: mut.body
      })
      await offlineStore.deleteMutation(mut.id)
    } catch (error) {
      if (error instanceof Error && (error.message === 'Network Error' || (error as any).code === 'ERR_NETWORK')) {
        break
      }
      // On permanent failure, drop it to not block the queue
      await offlineStore.deleteMutation(mut.id)
    }
  }
}
