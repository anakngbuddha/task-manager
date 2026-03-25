import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useProjectActivity } from '@/hooks/useProjectActivity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Activity } from 'lucide-react'
import TimeLogTimelineItem from '@/components/activity/TimeLogTimelineItem'
import TimeLogDetailDialog from '@/components/activity/TimeLogDetailDialog'

export default function ProjectActivityPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: activities = [], isLoading } = useProjectActivity(projectId!)

  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const timeLogEvents = (activities as any[])
    .filter((e) => e?.type === 'TIME_LOG_CREATED')
    .filter((e) => {
      if (!selectedDate) return true
      const md = e?.metadata ?? {}
      const iso = md?.createdAt ?? e?.createdAt
      if (!iso) return false
      const eventDate = new Date(String(iso)).toISOString().slice(0, 10)
      return eventDate === selectedDate
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Date</Label>
                <Input
                  type="date"
                  className="h-9 w-40 rounded-none"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                {selectedDate !== todayStr && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-none text-xs"
                    onClick={() => setSelectedDate(todayStr)}
                  >
                    Today
                  </Button>
                )}
              </div>
              <Button variant="outline" className="h-9 gap-2" asChild>
                <Link to={`/projects/${projectId}`}>
                  <ArrowLeft className="size-4" />
                  Back to Board
                </Link>
              </Button>
            </div>
          }
        />
        <div className="h-[calc(100vh-5rem)] overflow-auto px-6 py-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : timeLogEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                <Activity className="mb-4 size-8 opacity-20" />
                <p>No time logs recorded{selectedDate === todayStr ? ' today' : ` on ${selectedDate}`}.</p>
              </div>
            ) : (
              <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-5 before:w-0.5 before:bg-border/60">
                {visibleTimeLogEvents.map((event: any) => (
                  <TimeLogTimelineItem
                    key={event.id}
                    event={event}
                    onClick={() => setActiveLogEvent(event)}
                  />
                ))}
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

      <TimeLogDetailDialog
        event={activeLogEvent}
        onClose={() => setActiveLogEvent(null)}
      />
    </div>
  )
}
