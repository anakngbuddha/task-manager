import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Low-level shimmer placeholder. Compose it into page-shaped fallbacks rather
 * than rendering bare "Loading..." text, which reads as a broken page.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
