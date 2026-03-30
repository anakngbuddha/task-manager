import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquareDashed, FileText, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
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
  content?: string
  fileUrl?: string | null
  fileName?: string | null
  createdAt: Date
  isMine: boolean
  isFirstInGroup: boolean
  senderName: string
  senderInitials: string
}

export default function MessageBubble({ content, fileUrl, fileName, createdAt, isMine, isFirstInGroup, senderName, senderInitials }: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false)
  const relTime = formatRelativeTime(createdAt)
  const fullTime = formatFullTime(createdAt)
  const isImage = fileUrl ? /\.(jpeg|jpg|gif|png|webp|svg|avif)$/i.test(fileUrl) : false
  const isVideo = fileUrl ? /\.(mp4|webm|ogg|mov)$/i.test(fileUrl) : false

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
          {fileUrl && isImage && (
            <div className={cn("overflow-hidden rounded-xl", content ? "mb-2" : "")}>
              <Dialog>
                <DialogTrigger asChild>
                  <img src={`http://localhost:3000${fileUrl}`} alt={fileName || "Attachment"} className="max-w-full max-h-64 object-contain cursor-pointer transition-transform hover:scale-[1.02]" />
                </DialogTrigger>
                <DialogContent className="max-w-[75vw] sm:max-w-[75vw] w-fit p-0 overflow-hidden border-none bg-transparent shadow-none flex justify-center" showCloseButton={false}>
                  <img src={`http://localhost:3000${fileUrl}`} alt={fileName || "Attachment"} className="w-auto h-auto max-w-[75vw] max-h-[75vh] object-contain rounded-md" />
                </DialogContent>
              </Dialog>
            </div>
          )}
          {fileUrl && isVideo && (
            <div className={cn("overflow-hidden rounded-xl", content ? "mb-2" : "")}>
              <video 
                src={`http://localhost:3000${fileUrl}`} 
                controls 
                className="max-w-full max-h-64 object-contain rounded-md" 
              />
            </div>
          )}
          {fileUrl && !isImage && !isVideo && (
            <a 
              href={`http://localhost:3000${fileUrl}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              download={fileName || "attachment"}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2.5 bg-background/10 hover:bg-background/20 transition-colors cursor-pointer text-primary-foreground border border-primary-foreground/20", 
                content ? "mb-2" : ""
              )}
            >
              <div className="grid size-9 place-items-center rounded-lg shadow-sm shrink-0 bg-primary-foreground/20">
                <FileText className="size-4" />
              </div>
              <div className="flex flex-col overflow-hidden min-w-0 pr-2">
                <span className="truncate font-medium text-sm leading-tight">{fileName || "Attachment"}</span>
                <span className="text-[0.6rem] opacity-80 uppercase tracking-widest font-semibold mt-0.5">Download</span>
              </div>
              <Download className="size-4 opacity-70 ml-auto shrink-0" />
            </a>
          )}
          {content && (
            <p className="whitespace-pre-wrap leading-relaxed">
              <RenderWithMentions text={content} isMine={true} />
            </p>
          )}
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
          {fileUrl && isImage && (
            <div className={cn("overflow-hidden rounded-xl", content ? "mb-2" : "")}>
              <Dialog>
                <DialogTrigger asChild>
                  <img src={`http://localhost:3000${fileUrl}`} alt={fileName || "Attachment"} className="max-w-full max-h-64 object-contain cursor-pointer transition-transform hover:scale-[1.02]" />
                </DialogTrigger>
                <DialogContent className="max-w-[75vw] sm:max-w-[75vw] w-fit p-0 overflow-hidden border-none bg-transparent shadow-none flex justify-center" showCloseButton={false}>
                  <img src={`http://localhost:3000${fileUrl}`} alt={fileName || "Attachment"} className="w-auto h-auto max-w-[75vw] max-h-[75vh] object-contain rounded-md" />
                </DialogContent>
              </Dialog>
            </div>
          )}
          {fileUrl && isVideo && (
            <div className={cn("overflow-hidden rounded-xl", content ? "mb-2" : "")}>
              <video 
                src={`http://localhost:3000${fileUrl}`} 
                controls 
                className="max-w-full max-h-64 object-contain rounded-md border border-border" 
              />
            </div>
          )}
          {fileUrl && !isImage && !isVideo && (
            <a 
              href={`http://localhost:3000${fileUrl}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              download={fileName || "attachment"}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2.5 bg-background/50 hover:bg-background transition-colors cursor-pointer text-foreground border border-border", 
                content ? "mb-2" : ""
              )}
            >
              <div className="grid size-9 place-items-center rounded-lg shadow-sm shrink-0 bg-muted-foreground/10">
                <FileText className="size-4" />
              </div>
              <div className="flex flex-col overflow-hidden min-w-0 pr-2">
                <span className="truncate font-medium text-sm leading-tight">{fileName || "Attachment"}</span>
                <span className="text-[0.6rem] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Download</span>
              </div>
              <Download className="size-4 text-muted-foreground ml-auto shrink-0" />
            </a>
          )}
          {content && (
            <p className="whitespace-pre-wrap leading-relaxed">
              <RenderWithMentions text={content} isMine={false} />
            </p>
          )}
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
