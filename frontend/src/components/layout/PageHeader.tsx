import type { ReactNode } from 'react'

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
}: {
  breadcrumb: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">
              {breadcrumb}
            </div>
            <h2 className="mt-1 text-2xl font-semibold leading-tight">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </header>
  )
}

