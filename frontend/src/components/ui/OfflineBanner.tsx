import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const { isOnline, pendingCount } = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <span>
          You&apos;re offline. Changes will sync when reconnected.
        </span>
        {pendingCount > 0 && (
          <span className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">
            Pending: {pendingCount}
          </span>
        )}
      </div>
    </div>
  )
}

