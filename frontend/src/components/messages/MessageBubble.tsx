import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquareDashed } from 'lucide-react'
import { cn } from '@/lib/utils'

export function getInitials(name?: string | null, email?: string | null): string {
  if (name) return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatFullTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getDayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function shouldShowDivider(curr: Date, prev: Date | null): boolean {
  if (!prev) return true
  return curr.toDateString() !== prev.toDateString()
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-2">
      <div className="flex-1 h-px bg-border/60" />
      <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-wider px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

export function TypingIndicator({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2 px-4 pb-2">
      <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <span className="truncate">{text}</span>
          <span className="inline-flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-muted shadow-sm">
        <MessageSquareDashed className="size-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">Start the conversation by typing a message below.</p>
      </div>
    </div>
  )
}

function RenderWithMentions({ text, isMine }: { text: string; isMine?: boolean }) {
  if (!text) return null
  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, idx) =>
        part.startsWith('@') && part.length > 1 ? (
          <span
            key={idx}
            className={
              isMine
                ? 'font-semibold underline decoration-primary-foreground/60 underline-offset-2 opacity-90'
                : 'text-primary font-semibold'
            }
          >
            {part}
          </span>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  )
}

interface MessageBubbleProps {
  content: string
  createdAt: Date
  isMine: boolean
  isFirstInGroup: boolean
  senderName: string
  senderInitials: string
}

export default function MessageBubble({ content, createdAt, isMine, isFirstInGroup, senderName, senderInitials }: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false)
  const relTime = formatRelativeTime(createdAt)
  const fullTime = formatFullTime(createdAt)

  if (isMine) {
    return (
      <div
        className="group flex items-end justify-end gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className={cn(
            'shrink-0 text-[0.65rem] text-muted-foreground transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
          title={fullTime}
        >
          {relTime}
        </span>
        <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-[0.875rem] text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">
            <RenderWithMentions text={content} isMine={true} />
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group flex items-end gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="shrink-0 w-8">
        {isFirstInGroup ? (
          <Avatar size="sm">
            <AvatarFallback className="text-[0.625rem] font-semibold bg-accent text-accent-foreground">
              {senderInitials}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 max-w-[72%]">
        {isFirstInGroup && (
          <p className="ml-0.5 text-[0.7rem] font-semibold text-muted-foreground">{senderName}</p>
        )}
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-[0.875rem] text-foreground shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">
            <RenderWithMentions text={content} isMine={false} />
          </p>
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 self-end text-[0.65rem] text-muted-foreground transition-opacity duration-150',
          hovered ? 'opacity-100' : 'opacity-0'
        )}
        title={fullTime}
      >
        {relTime}
      </span>
    </div>
  )
}
