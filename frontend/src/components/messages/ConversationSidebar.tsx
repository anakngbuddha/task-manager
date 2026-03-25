import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_CONFIG, type UserStatus } from '@/hooks/useUserStatus'
import { getInitials } from './MessageBubble'

interface DirectConversation {
  otherId: string
  otherLabel: string
  otherInitials: string
  last: { content?: string; senderId?: string } | null
}

interface ConversationSidebarProps {
  projectId: string
  projectName?: string
  mode: 'project' | 'direct'
  directTargetId?: string
  directConversations: DirectConversation[]
  newDmCandidates: any[]
  statusById: Map<string, string>
  unreadDms: Set<string>
  projectUnreadCount: number
  onSelectProject: () => void
  onSelectDirect: (userId: string) => void
}

export default function ConversationSidebar({
  projectId,
  projectName,
  mode,
  directTargetId,
  directConversations,
  newDmCandidates,
  statusById,
  unreadDms,
  projectUnreadCount,
  onSelectProject,
  onSelectDirect,
}: ConversationSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background/60 backdrop-blur">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to board
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <div>
          <p className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </p>
          <button
            type="button"
            onClick={onSelectProject}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
              mode === 'project'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-accent'
            )}
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Hash className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] font-medium">Project Chat</p>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {projectName ?? 'All members'}
              </p>
            </div>
            {projectUnreadCount > 0 && (
              <span className="shrink-0 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                {projectUnreadCount}
              </span>
            )}
          </button>
        </div>

        <div>
          <p className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Direct Messages
          </p>

          <div className="space-y-0.5">
            {directConversations.map((c) => (
              <button
                key={c.otherId}
                type="button"
                onClick={() => onSelectDirect(c.otherId)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
                  mode === 'direct' && directTargetId === c.otherId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[0.625rem] font-semibold bg-accent text-accent-foreground">
                      {c.otherInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute bottom-0 right-0 size-2 rounded-full ring-1 ring-background',
                      STATUS_CONFIG[(statusById.get(c.otherId) as UserStatus) ?? 'OFFLINE']?.dotClass ?? 'bg-gray-400'
                    )}
                    title={STATUS_CONFIG[(statusById.get(c.otherId) as UserStatus) ?? 'OFFLINE']?.label}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8rem] font-medium">{c.otherLabel}</p>
                  {c.last?.content && (
                    <p className="truncate text-[0.68rem] text-muted-foreground">{c.last.content}</p>
                  )}
                </div>

                {unreadDms.has(c.otherId) && (
                  <span className="shrink-0 size-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {newDmCandidates.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {newDmCandidates.map((u: any) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectDirect(u.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
                    mode === 'direct' && directTargetId === u.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar size="sm">
                      <AvatarFallback className="text-[0.625rem] font-semibold bg-muted text-muted-foreground">
                        {getInitials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 size-2 rounded-full ring-1 ring-background',
                        STATUS_CONFIG[(statusById.get(u.id) as UserStatus) ?? 'OFFLINE']?.dotClass ?? 'bg-gray-400'
                      )}
                      title={STATUS_CONFIG[(statusById.get(u.id) as UserStatus) ?? 'OFFLINE']?.label}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8rem]">{u.name ?? u.email}</p>
                    <p className="truncate text-[0.68rem] text-muted-foreground">Start a conversation</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {directConversations.length === 0 && newDmCandidates.length === 0 && (
            <p className="px-2 py-2 text-[0.72rem] text-muted-foreground">No teammates yet.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
