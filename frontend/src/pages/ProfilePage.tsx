import Sidebar from '@/components/layout/Sidebar'
import { useSession } from '@/lib/auth-client'
import { ContributionHeatmap } from '@/components/contributions/ContributionHeatmap'
import { useMyContributions } from '@/hooks/useMyContributions'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: contrib } = useMyContributions(365)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold leading-tight">Profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account details and activity.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/settings">
                  <Button variant="outline" className="h-10">Settings</Button>
                </Link>
                <Link to="/change-password">
                  <Button variant="outline" className="h-10">Change password</Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-4">
          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
            <p className="text-sm font-medium">Account</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{session?.user?.name ?? '—'}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{session?.user?.email ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
            <p className="text-sm font-medium">Contributions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tasks completed per day (last 12 months).
            </p>
            <div className="mt-4">
              <ContributionHeatmap countsByDay={contrib?.countsByDay ?? {}} days={365} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

