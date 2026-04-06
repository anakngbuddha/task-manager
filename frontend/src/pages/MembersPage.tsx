import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'

type Mode = 'view' | 'add' | 'remove'

export default function MembersPage() {
  const [params] = useSearchParams()
  const mode = (params.get('mode') ?? 'view') as Mode

  const title = useMemo(() => {
    if (mode === 'add') return 'Add members'
    if (mode === 'remove') return 'Remove members'
    return 'Members'
  }, [mode])

  const description = useMemo(() => {
    if (mode === 'add') return 'Invite new members to your workspace.'
    if (mode === 'remove') return 'Remove members from your workspace.'
    return 'View and manage workspace members.'
  }, [mode])

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </header>

        <section className="px-6 py-6 sm:px-8">
          <div className="border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Members management UI coming next.
          </div>
        </section>
      </main>
    </div>
  )
}

