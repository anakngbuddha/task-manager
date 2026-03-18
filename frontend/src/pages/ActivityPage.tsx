import Sidebar from '@/components/layout/Sidebar'
import { useActivity } from '@/hooks/useActivity'
import { LayoutGrid } from 'lucide-react'

function formatEvent(e: any) {
  const actor = e.actor?.name ?? e.actor?.email ?? 'Someone'
  const project = e.project?.name ?? 'Project'

  switch (e.type) {
    case 'TASK_CREATED':
      return `${actor} created a task in ${project}`
    case 'TASK_UPDATED':
      return `${actor} updated a task in ${project}`
    case 'TASK_COMMENT_ADDED':
      return `${actor} commented on a task in ${project}`
    case 'TASK_COMMENT_REPLIED':
      return `${actor} replied in a task thread in ${project}`
    case 'PROJECT_MESSAGE_SENT':
      return `${actor} sent a project message in ${project}`
    case 'DIRECT_MESSAGE_SENT':
      return `${actor} sent a direct message in ${project}`
    default:
      return `${actor} did ${e.type} in ${project}`
  }
}

export default function ActivityPage() {
  const { data: events = [], isLoading } = useActivity(80)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Activity</span>
                </div>
                <h2 className="mt-1 text-2xl font-semibold leading-tight">Recent changes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What’s happening across your projects.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="px-6 py-7 sm:px-8">
          {isLoading ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading activity…
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e: any) => (
                <div key={e.id} className="rounded-lg border border-border/60 bg-card px-4 py-3">
                  <p className="text-sm">{formatEvent(e)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

