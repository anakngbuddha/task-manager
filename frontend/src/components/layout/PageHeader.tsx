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
            <div className="flex w-full flex-wrap items-center justify-start gap-2 pt-1 sm:w-auto sm:justify-end sm:pt-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

