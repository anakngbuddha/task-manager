import { useProjectActivity } from '@/hooks/useActivity'
import { Badge } from '@/components/ui/badge'

function formatActivityType(type: string): string {
  switch (type) {
    case 'PR_OPENED': return 'Opened PR'
    case 'PR_MERGED': return 'Merged PR'
    case 'PR_CLOSED': return 'Closed PR'
    case 'PUSH_TO_REPO': return 'Pushed to Repository'
    case 'TASK_CREATED': return 'Created Task'
    case 'TASK_UPDATED': return 'Updated Task'
    case 'TASK_COMMENT_ADDED': return 'Commented on Task'
    case 'TASK_COMMENT_REPLIED': return 'Replied to Comment'
    case 'PROJECT_MESSAGE_SENT': return 'Sent Message'
    case 'DIRECT_MESSAGE_SENT': return 'Sent Direct Message'
    default:
      return type.replace(/_/g, ' ').toLowerCase()
  }
}

export function RecentActivityWidget({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading } = useProjectActivity(projectId, 8)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Latest</p>
        <Badge variant="secondary" className="rounded-none px-2 py-1 text-xs">
          {isLoading ? '...' : `${events.length}`}
        </Badge>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          Loading activity…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
          No activity yet.
        </div>
      ) : (
        <div className="space-y-2 overflow-auto max-h-[220px] pr-1">
          {events.map((e: any) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{e.actor?.name ?? e.actor?.email ?? 'Unknown'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                  {formatActivityType(e.type)}
                </div>
              </div>
              <div className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
                {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

