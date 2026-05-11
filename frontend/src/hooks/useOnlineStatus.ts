import { useEffect, useState } from 'react'
import { offlineStore } from '@/lib/offlineStore'
import { flushOfflineQueue } from '@/lib/offlineQueue'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState<number>(0)

  useEffect(() => {
    let mounted = true

    async function refreshPending() {
      const c = await offlineStore.countQueuedMutations()
      if (mounted) setPendingCount(c)
    }

    refreshPending()

    const onOnline = async () => {
      setIsOnline(true)
      await flushOfflineQueue()
      await refreshPending()
    }
    const onOffline = async () => {
      setIsOnline(false)
      await refreshPending()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      mounted = false
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { isOnline, pendingCount }
}

