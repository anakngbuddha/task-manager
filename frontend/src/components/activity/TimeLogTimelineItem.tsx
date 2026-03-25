import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock } from 'lucide-react'
import { formatUserLogTime, formatDurationMinutes } from './activityRenderers'

interface TimeLogTimelineItemProps {
  event: any
  onClick: () => void
}

export default function TimeLogTimelineItem({ event, onClick }: TimeLogTimelineItemProps) {
  const md = event?.metadata ?? {}
  const createdAtSource = md?.createdAt ?? event.createdAt
  const createdAt = createdAtSource ? formatUserLogTime(String(createdAtSource)) : null
  const minutes = Number(md?.durationMinutes ?? 0)
  const title =
    typeof md?.title === 'string' && md.title.trim()
      ? md.title.trim()
      : typeof md?.taskTitle === 'string' && md.taskTitle.trim()
        ? md.taskTitle.trim()
        : 'Time log'

  return (
    <div className="relative flex gap-4 pl-12">
      <Avatar className="absolute left-0 top-0 size-10 ring-4 ring-background">
        <AvatarImage src={event.actor.avatar || ''} />
        <AvatarFallback>{event.actor.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <button
        type="button"
        className="text-left w-full"
        onClick={onClick}
      >
        <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-2 shadow-sm w-full hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">
              <span className="font-semibold text-foreground">{event.actor.name}</span>
            </p>
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <Clock className="size-3" />
              {createdAt?.time ?? ''}
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Local</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{createdAt?.day ?? ''}</p>
          <p className="text-sm">
            <span className="font-semibold text-foreground">{formatDurationMinutes(minutes)}</span>{' '}
            <span className="text-muted-foreground">logged</span>
          </p>
          <p className="text-sm font-medium text-foreground/90 truncate">{title}</p>
        </div>
      </button>
    </div>
  )
}
