import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useProjectActivity } from '@/hooks/useProjectActivity'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Clock, Activity } from 'lucide-react'

function formatUserLogTime(value: string) {
  const date = new Date(value)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return { time, day }
}

function formatDurationMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function ProjectActivityPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: activities = [], isLoading } = useProjectActivity(projectId!)
  const todayKey = new Date().toDateString()
  const timeLogEvents = (activities as any[])
    .filter((e) => e?.type === 'TIME_LOG_CREATED')
    .filter((e) => {
      const md = e?.metadata ?? {}
      const iso = md?.createdAt ?? e?.createdAt
      return iso ? new Date(String(iso)).toDateString() === todayKey : false
    })

  const [visibleLimit, setVisibleLimit] = useState(10)
  const [activeLogEvent, setActiveLogEvent] = useState<any | null>(null)
  const visibleTimeLogEvents = timeLogEvents.slice(0, visibleLimit)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Logs</span>}
          title="Project Logs"
          subtitle="Time logs recorded for this project."
          actions={
            <Button variant="outline" className="h-9 gap-2" asChild>
              <Link to={`/projects/${projectId}`}>
                <ArrowLeft className="size-4" />
                Back to Board
              </Link>
            </Button>
          }
        />
        <div className="h-[calc(100vh-5rem)] overflow-auto px-6 py-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : timeLogEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                <Activity className="mb-4 size-8 opacity-20" />
                <p>No time logs recorded today.</p>
              </div>
            ) : (
              <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-5 before:w-0.5 before:bg-border/60">
                {visibleTimeLogEvents.map((event: any) => {
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
                  <div key={event.id} className="relative flex gap-4 pl-12">
                    <Avatar className="absolute left-0 top-0 size-10 ring-4 ring-background">
                      <AvatarImage src={event.actor.avatar || ''} />
                      <AvatarFallback>{event.actor.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => setActiveLogEvent(event)}
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
                )})}
              </div>
            )}

            {timeLogEvents.length > visibleLimit && !isLoading && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setVisibleLimit((v) => v + 10)}
                >
                  Show more
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog
        open={!!activeLogEvent}
        onOpenChange={(open) => {
          if (!open) setActiveLogEvent(null)
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-none max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeLogEvent
                ? (typeof activeLogEvent?.metadata?.title === 'string' && activeLogEvent.metadata.title.trim()
                  ? activeLogEvent.metadata.title.trim()
                  : 'Time log')
                : 'Time log'}
            </DialogTitle>
          </DialogHeader>

          {activeLogEvent && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <p>
                  <span className="text-muted-foreground">Task: </span>
                  <span className="font-medium">
                    {typeof activeLogEvent.metadata?.taskTitle === 'string' && activeLogEvent.metadata.taskTitle.trim()
                      ? activeLogEvent.metadata.taskTitle
                      : 'Untitled task'}
                  </span>
                </p>
                    {typeof activeLogEvent.metadata?.taskId === 'string' && (
                      <p className="text-xs text-muted-foreground break-all">
                        Task ID: {activeLogEvent.metadata.taskId}
                      </p>
                    )}
                <p>
                  <span className="text-muted-foreground">Logged duration: </span>
                  <span className="font-medium">{formatDurationMinutes(Number(activeLogEvent.metadata?.durationMinutes ?? 0))}</span>
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  Time log ID: {typeof activeLogEvent.entityId === 'string' ? activeLogEvent.entityId : activeLogEvent.id}
                </p>
              </div>

              <div className="rounded-md border bg-muted/10 p-3 space-y-2">
                <p>
                  <span className="text-muted-foreground">Created (local): </span>
                  <span className="font-medium">
                    {(() => {
                      const createdIso = activeLogEvent.metadata?.createdAt ?? activeLogEvent.createdAt
                      const t = createdIso ? formatUserLogTime(String(createdIso)) : null
                      return t ? `${t.day} · ${t.time}` : ''
                    })()}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Logged for (local): </span>
                  <span className="font-medium">
                    {(() => {
                      const loggedIso = activeLogEvent.metadata?.loggedAt
                      const t = loggedIso ? formatUserLogTime(String(loggedIso)) : null
                      return t ? `${t.day} · ${t.time}` : ''
                    })()}
                  </span>
                </p>
              </div>

              {typeof activeLogEvent.metadata?.title === 'string' && activeLogEvent.metadata.title.trim() && (
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Title</p>
                  <p className="mt-1 whitespace-pre-wrap">{activeLogEvent.metadata.title}</p>
                </div>
              )}
              {typeof activeLogEvent.metadata?.description === 'string' && activeLogEvent.metadata.description.trim() && (
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{activeLogEvent.metadata.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
