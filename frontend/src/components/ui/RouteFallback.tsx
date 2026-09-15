import { Skeleton, SkeletonCard } from './skeleton'

/**
 * Suspense fallback for lazily loaded routes.
 *
 * Intentionally generic and page-shaped: a header bar, a row of stat cards and
 * a list body. It only ever renders inside a layout's <Outlet /> boundary, so
 * the sidebar and other chrome stay mounted while the route chunk downloads.
 *
 * `label` is exposed to screen readers only; the visual state is the shimmer.
 */
export function RouteFallback({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col gap-6 p-6" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Body */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default RouteFallback
