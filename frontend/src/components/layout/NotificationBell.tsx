import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell } from 'lucide-react'

export default function NotificationBell({
  notifData,
  markAllRead,
  markRead,
  onNavigate,
  className,
}: {
  notifData: any
  markAllRead: { mutateAsync: () => Promise<any> }
  markRead: { mutateAsync: (id: string) => Promise<any> }
  onNavigate: (to: string) => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={['relative shrink-0', className].filter(Boolean).join(' ')}
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {(notifData?.unread ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4 text-destructive-foreground">
              {Math.min(99, notifData!.unread)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-4rem)]"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-auto">
          {(notifData?.items ?? []).length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            (notifData?.items ?? []).map((n: any) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-1"
                onSelect={async () => {
                  if (!n.readAt) await markRead.mutateAsync(n.id)
                  onNavigate(n.href)
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                <span className="text-[0.65rem] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await markAllRead.mutateAsync()
          }}
        >
          Mark all as read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

