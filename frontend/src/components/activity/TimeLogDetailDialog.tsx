import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatUserLogTime, formatDurationMinutes } from './activityRenderers'

interface TimeLogDetailDialogProps {
  event: any | null
  onClose: () => void
}

export default function TimeLogDetailDialog({ event, onClose }: TimeLogDetailDialogProps) {
  return (
    <Dialog
      open={!!event}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg rounded-none max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event
              ? (typeof event?.metadata?.title === 'string' && event.metadata.title.trim()
                ? event.metadata.title.trim()
                : 'Time log')
              : 'Time log'}
          </DialogTitle>
        </DialogHeader>

        {event && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <p>
                <span className="text-muted-foreground">Task: </span>
                <span className="font-medium">
                  {typeof event.metadata?.taskTitle === 'string' && event.metadata.taskTitle.trim()
                    ? event.metadata.taskTitle
                    : 'Untitled task'}
                </span>
              </p>
              {typeof event.metadata?.taskId === 'string' && (
                <p className="text-xs text-muted-foreground break-all">
                  Task ID: {event.metadata.taskId}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Logged duration: </span>
                <span className="font-medium">{formatDurationMinutes(Number(event.metadata?.durationMinutes ?? 0))}</span>
              </p>
              <p className="text-xs text-muted-foreground break-all">
                Time log ID: {typeof event.entityId === 'string' ? event.entityId : event.id}
              </p>
            </div>

            <div className="rounded-md border bg-muted/10 p-3 space-y-2">
              <p>
                <span className="text-muted-foreground">Created (local): </span>
                <span className="font-medium">
                  {(() => {
                    const createdIso = event.metadata?.createdAt ?? event.createdAt
                    const t = createdIso ? formatUserLogTime(String(createdIso)) : null
                    return t ? `${t.day} · ${t.time}` : ''
                  })()}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Logged for (local): </span>
                <span className="font-medium">
                  {(() => {
                    const loggedIso = event.metadata?.loggedAt
                    const t = loggedIso ? formatUserLogTime(String(loggedIso)) : null
                    return t ? `${t.day} · ${t.time}` : ''
                  })()}
                </span>
              </p>
            </div>

            {typeof event.metadata?.title === 'string' && event.metadata.title.trim() && (
              <div className="rounded-md border bg-muted/10 p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Title</p>
                <p className="mt-1 whitespace-pre-wrap">{event.metadata.title}</p>
              </div>
            )}
            {typeof event.metadata?.description === 'string' && event.metadata.description.trim() && (
              <div className="rounded-md border bg-muted/10 p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{event.metadata.description}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
