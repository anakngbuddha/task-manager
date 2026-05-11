import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
  })

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {offlineReady ? (
            <p className="text-sm font-medium">App ready to work offline</p>
          ) : (
            <>
              <p className="text-sm font-medium">Update available</p>
              <p className="text-sm text-muted-foreground">
                A newer version is ready. Reload to update.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reload
            </button>
          )}
          <button
            onClick={close}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
