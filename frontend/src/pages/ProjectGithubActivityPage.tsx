import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useGithubActivity, type GithubActivityEvent } from '@/hooks/useGithubActivity'
import { useGithubInstallation } from '@/hooks/useGithub'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  GitCommit,
  GitPullRequest,
  GitBranch,
  Tag,
  ExternalLink,
  Github,
  GitMerge,
  Eye,
  Loader2,
} from 'lucide-react'
import ProjectTerminal from '@/components/terminal/ProjectTerminal'

const EVENT_ICONS: Record<string, typeof GitCommit> = {
  PUSH: GitCommit,
  PR_OPENED: GitPullRequest,
  PR_MERGED: GitMerge,
  PR_CLOSED: GitPullRequest,
  PR_REVIEWED: Eye,
  BRANCH_CREATED: GitBranch,
  BRANCH_DELETED: GitBranch,
  TAG_CREATED: Tag,
  TAG_DELETED: Tag,
}

const EVENT_COLORS: Record<string, string> = {
  PUSH: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  PR_OPENED: 'bg-green-500/15 text-green-700 border-green-500/30',
  PR_MERGED: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
  PR_CLOSED: 'bg-red-500/15 text-red-700 border-red-500/30',
  PR_REVIEWED: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  BRANCH_CREATED: 'bg-teal-500/15 text-teal-700 border-teal-500/30',
  BRANCH_DELETED: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  TAG_CREATED: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30',
  TAG_DELETED: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
}

function getEventVerb(eventType: string): string {
  switch (eventType) {
    case 'PUSH': return 'pushed to'
    case 'PR_OPENED': return 'opened pull request on'
    case 'PR_MERGED': return 'merged pull request on'
    case 'PR_CLOSED': return 'closed pull request on'
    case 'PR_REVIEWED': return 'reviewed pull request on'
    case 'BRANCH_CREATED': return 'created branch on'
    case 'BRANCH_DELETED': return 'deleted branch on'
    case 'TAG_CREATED': return 'created tag on'
    case 'TAG_DELETED': return 'deleted tag on'
    default: return 'performed action on'
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'PUSH': return 'Push'
    case 'PR_OPENED': return 'PR Opened'
    case 'PR_MERGED': return 'PR Merged'
    case 'PR_CLOSED': return 'PR Closed'
    case 'PR_REVIEWED': return 'PR Review'
    case 'BRANCH_CREATED': return 'Branch Created'
    case 'BRANCH_DELETED': return 'Branch Deleted'
    case 'TAG_CREATED': return 'Tag Created'
    case 'TAG_DELETED': return 'Tag Deleted'
    default: return eventType.replace(/_/g, ' ')
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function EventCard({ event }: { event: GithubActivityEvent }) {
  const Icon = EVENT_ICONS[event.eventType] ?? GitCommit
  const colorCls = EVENT_COLORS[event.eventType] ?? 'bg-muted text-foreground'
  const verb = getEventVerb(event.eventType)
  const label = getEventLabel(event.eventType)

  const commits = event.summary?.commits as Array<{ sha: string; message: string; author: string }> | undefined
  const commitCount = event.summary?.commitCount as number | undefined

  return (
    <div className="relative flex gap-4 pl-8">
      <div className="absolute left-0 top-1 flex size-6 items-center justify-center rounded-full border bg-background shadow-sm">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 rounded-lg border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">
            {event.author ?? 'Unknown'}
          </span>
          <span className="text-muted-foreground">{verb}</span>
          <span className="font-medium text-foreground">{event.repo.repoFullName}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 border ${colorCls}`}>
            {label}
          </Badge>
        </div>

        {event.prTitle && (
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {event.prNumber ? `#${event.prNumber} ` : ''}
            {event.prTitle}
          </p>
        )}

        {event.branch && (
          <div className="mt-1.5 inline-flex items-center gap-1.5">
            <GitBranch className="size-3 text-muted-foreground" />
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {event.branch}
            </code>
          </div>
        )}

        {commits && commits.length > 0 && (
          <div className="mt-2 space-y-1 rounded-md border border-border/40 bg-muted/30 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              {commitCount ?? commits.length} commit{(commitCount ?? commits.length) === 1 ? '' : 's'}
            </p>
            {commits.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <code className="shrink-0 text-muted-foreground font-mono">{c.sha}</code>
                <span className="text-foreground truncate">{c.message}</span>
                {c.author && (
                  <span className="shrink-0 text-muted-foreground ml-auto">{c.author}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {event.message && !commits?.length && !event.prTitle && (
          <p className="mt-1.5 text-sm text-muted-foreground">{event.message}</p>
        )}

        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <time title={new Date(event.createdAt).toLocaleString()}>
            {formatRelativeTime(event.createdAt)}
          </time>
          <span>{new Date(event.createdAt).toLocaleString()}</span>
          {event.htmlUrl && (
            <a
              href={event.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
            >
              View on GitHub <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'PUSH', label: 'Pushes' },
  { value: 'PR_OPENED', label: 'PR Opened' },
  { value: 'PR_MERGED', label: 'PR Merged' },
  { value: 'PR_CLOSED', label: 'PR Closed' },
  { value: 'PR_REVIEWED', label: 'PR Reviews' },
  { value: 'BRANCH_CREATED', label: 'Branches Created' },
  { value: 'BRANCH_DELETED', label: 'Branches Deleted' },
  { value: 'TAG_CREATED', label: 'Tags Created' },
  { value: 'TAG_DELETED', label: 'Tags Deleted' },
]

export default function ProjectGithubActivityPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: installation } = useGithubInstallation(projectId)

  const [eventFilter, setEventFilter] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(30)

  const { data: activityData, isLoading } = useGithubActivity(projectId, {
    eventType: eventFilter || undefined,
    limit: visibleLimit,
  })

  const events = activityData?.events ?? []
  const hasMore = !!activityData?.nextCursor

  return (
    <div className="flex h-dvh bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <PageHeader
          breadcrumb={
            <span className="text-muted-foreground">
              Projects / {project?.name ?? 'Project'} / GitHub Activity
            </span>
          }
          title="GitHub Activity"
          subtitle="All commits, pull requests, branches, and tags from connected repositories."
          actions={
            <div className="flex items-center gap-3">
              <Select
                value={eventFilter || 'ALL'}
                onValueChange={(v) => setEventFilter(v === 'ALL' ? '' : v)}
              >
                <SelectTrigger className="h-9 w-[160px] rounded-none text-xs">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value || 'ALL'} value={t.value || 'ALL'}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <div className="mx-auto max-w-3xl">
            {!installation ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground">
                <Github className="mb-4 size-10 opacity-20" />
                <p className="text-sm font-medium">No GitHub App connected</p>
                <p className="mt-1 text-xs max-w-sm">
                  Connect your GitHub App in the{' '}
                  <Link to="/profile" className="text-primary hover:underline">
                    Profile
                  </Link>{' '}
                  page to start monitoring repository activity.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading activity...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground">
                <GitCommit className="mb-4 size-10 opacity-20" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-xs max-w-sm">
                  GitHub events will appear here as they happen — pushes, pull requests, branches, and tags.
                </p>
              </div>
            ) : (
              <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border/60">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            {hasMore && !isLoading && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setVisibleLimit((v) => v + 30)}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
      <ProjectTerminal projectId={projectId!} projectName={project?.name} projectMembers={project?.members} />
    </div>
  )
}
