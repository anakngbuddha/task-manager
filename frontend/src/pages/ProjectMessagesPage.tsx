import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useProject } from '@/hooks/useProject'
import { useProjectMessages, useSendProjectMessage } from '@/hooks/useProjectMessages'
import { useProjectDirectInbox } from '@/hooks/useProjectDirectInbox'
import { useProjectDirectMessages, useSendProjectDirectMessage } from '@/hooks/useProjectDirectMessages'
import { useDirectSeen, useMarkDirectRead, useMarkProjectRead, useProjectSeen } from '@/hooks/useReadReceipts'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ArrowLeft,
  Hash,
  MessageCircle,
  Paperclip,
  SendHorizonal,
  Smile,
  AtSign,
  MessageSquareDashed,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { cn } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name?: string | null, email?: string | null): string {
  if (name) return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function formatRelativeTime(date: Date): string {
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

function formatFullTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function shouldShowDivider(curr: Date, prev: Date | null): boolean {
  if (!prev) return true
  return curr.toDateString() !== prev.toDateString()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
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

function TypingIndicator({ text }: { text: string }) {
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

function EmptyState({ message }: { message: string }) {
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

// ─── Render mentions ──────────────────────────────────────────────────────────

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

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  content: string
  createdAt: Date
  isMine: boolean
  isFirstInGroup: boolean
  senderName: string
  senderInitials: string
}

function MessageBubble({ content, createdAt, isMine, isFirstInGroup, senderName, senderInitials }: MessageBubbleProps) {
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
        {/* Timestamp (left of bubble, on hover) */}
        <span
          className={cn(
            'shrink-0 text-[0.65rem] text-muted-foreground transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
          title={fullTime}
        >
          {relTime}
        </span>
        {/* Bubble */}
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
      {/* Avatar (only on first in group, else spacer) */}
      <div className="shrink-0 w-8">
        {isFirstInGroup ? (
          <Avatar size="sm">
            <AvatarFallback className="text-[0.625rem] font-semibold bg-accent text-accent-foreground">
              {senderInitials}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {/* Bubble */}
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

      {/* Timestamp (right of bubble, on hover) */}
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

// ─── Input Bar ────────────────────────────────────────────────────────────────

interface InputBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  disabled?: boolean
  placeholder?: string
  isPending?: boolean
  onMentionClick?: () => void
}

function InputBar({ value, onChange, onSubmit, disabled, placeholder, isPending, onMentionClick }: InputBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  // Auto-grow textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + 'px'
    }
  }, [value])

  const insertAtCursor = (text: string) => {
    if (!ref.current) return
    const start = ref.current.selectionStart
    const end = ref.current.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    setTimeout(() => {
      ref.current?.setSelectionRange(start + text.length, start + text.length)
      ref.current?.focus()
    }, 0)
  }

  return (
    <form onSubmit={onSubmit} className="border-t bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background shadow-sm ring-1 ring-transparent focus-within:ring-primary/30 transition-shadow">
        <textarea
          ref={ref}
          rows={1}
          className="w-full resize-none bg-transparent px-3 pt-3 pb-0 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          placeholder={placeholder ?? 'Type a message… (Enter to send, Shift+Enter for new line)'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              title="Emoji"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Smile className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              title="Attach file"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Paperclip className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              title="Mention someone"
              onClick={() => insertAtCursor('@')}
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
            >
              <AtSign className="size-4" />
            </button>
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="sm"
            className="h-7 px-3 gap-1.5 text-xs"
            disabled={!value.trim() || disabled || isPending}
          >
            <SendHorizonal className="size-3.5" />
            Send
          </Button>
        </div>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectMessagesPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: project } = useProject(projectId!)
  const location = useLocation()

  const [mode, setMode] = useState<'project' | 'direct'>('project')
  const [input, setInput] = useState('')

  const { data: projectMessages = [] } = useProjectMessages(projectId!)
  const sendProjectMessage = useSendProjectMessage()
  const markProjectRead = useMarkProjectRead()
  const { data: projectSeen } = useProjectSeen(projectId!)

  const { data: inbox = [] } = useProjectDirectInbox(projectId!)
  const [directTargetId, setDirectTargetId] = useState<string | undefined>(undefined)
  const { data: directMessages = [] } = useProjectDirectMessages(projectId!, directTargetId)
  const sendDirect = useSendProjectDirectMessage()
  const markDirectRead = useMarkDirectRead()
  const { data: directSeen } = useDirectSeen(projectId!, directTargetId)

  const listEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (listEndRef.current) listEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [mode, projectMessages, directMessages, directTargetId])

  useEffect(() => {
    if (!projectId) return
    const params = new URLSearchParams(location.search)
    const requestedMode = params.get('mode')
    const requestedUser = params.get('user')
    if (requestedMode === 'direct') setMode('direct')
    if (requestedUser) setDirectTargetId(requestedUser)
  }, [location.search, projectId])

  // ── Socket ──────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const [projectTyping, setProjectTyping] = useState<Record<string, string>>({})
  const [directTyping, setDirectTyping] = useState<Record<string, string>>({})

  const membersById = useMemo(() => {
    const map = new Map<string, any>()
    for (const m of project?.members ?? []) {
      if (m?.user?.id) map.set(m.user.id, m.user)
    }
    return map
  }, [project?.members])

  useEffect(() => {
    if (!projectId || !session?.user?.id) return
    if (socketRef.current) return

    const socket = io('http://localhost:3001', { withCredentials: true })
    socketRef.current = socket
    socket.emit('join:project', projectId)

    socket.on('typing:project', (payload: { userId: string; name: string; isTyping: boolean }) => {
      setProjectTyping((curr) => {
        const next = { ...curr }
        if (payload.isTyping) next[payload.userId] = payload.name
        else delete next[payload.userId]
        return next
      })
    })

    socket.on('typing:direct', (payload: { userId: string; name: string; isTyping: boolean }) => {
      setDirectTyping((curr) => {
        const next = { ...curr }
        if (payload.isTyping) next[payload.userId] = payload.name
        else delete next[payload.userId]
        return next
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [projectId, session?.user?.id])

  useEffect(() => {
    if (!projectId || !session?.user?.id || !directTargetId) return
    socketRef.current?.emit('join:direct', { projectId, userId: session.user.id, otherUserId: directTargetId })
    setDirectTyping({})
  }, [directTargetId, projectId, session?.user?.id])

  useEffect(() => {
    if (!projectId || !session?.user?.id) return
    if (mode === 'project') {
      markProjectRead.mutate(projectId)
      socketRef.current?.emit('read:project', { projectId, userId: session.user.id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, projectId, session?.user?.id])

  useEffect(() => {
    if (!projectId || !session?.user?.id || mode !== 'direct' || !directTargetId) return
    markDirectRead.mutate({ projectId, otherUserId: directTargetId })
    socketRef.current?.emit('read:direct', { projectId, userId: session.user.id, otherUserId: directTargetId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directTargetId, mode, projectId, session?.user?.id])

  // ── Typing ─────────────────────────────────────────────────────────────────

  const typingText = useMemo(() => {
    if (mode === 'project') {
      const names = Object.entries(projectTyping)
        .filter(([id]) => id !== session?.user?.id)
        .map(([, name]) => name)
      if (names.length === 0) return null
      if (names.length === 1) return `${names[0]} is typing…`
      if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
      return `${names[0]} and ${names.length - 1} others are typing…`
    }
    const names = Object.entries(directTyping)
      .filter(([id]) => id !== session?.user?.id)
      .map(([, name]) => name)
    if (names.length === 0) return null
    return `${names[0]} is typing…`
  }, [directTyping, mode, projectTyping, session?.user?.id])

  const emitTyping = (isTyping: boolean) => {
    if (!projectId || !session?.user?.id) return
    const name = session.user.name ?? session.user.email ?? 'Someone'
    if (mode === 'project') {
      socketRef.current?.emit('typing:project', { projectId, userId: session.user.id, name, isTyping })
    } else if (mode === 'direct' && directTargetId) {
      socketRef.current?.emit('typing:direct', { projectId, userId: session.user.id, otherUserId: directTargetId, name, isTyping })
    }
  }

  useEffect(() => {
    if (!projectId || !session?.user?.id) return
    if (mode === 'direct' && !directTargetId) return
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    if (input.trim().length > 0) {
      emitTyping(true)
      typingTimerRef.current = window.setTimeout(() => emitTyping(false), 900)
    } else {
      emitTyping(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, mode, directTargetId, projectId, session?.user?.id])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
      emitTyping(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !projectId) return
    emitTyping(false)
    if (mode === 'project') {
      await sendProjectMessage.mutateAsync({ projectId, content: input.trim() })
    } else if (mode === 'direct' && directTargetId) {
      await sendDirect.mutateAsync({ projectId, otherUserId: directTargetId, content: input.trim() })
    }
    setInput('')
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const directConversations = useMemo(() => {
    return (inbox as any[]).map((row) => {
      const otherId = row.otherUserId as string
      const other = membersById.get(otherId)
      return {
        otherId,
        otherLabel: other?.name ?? other?.email ?? otherId,
        otherInitials: getInitials(other?.name, other?.email),
        last: row.lastMessage,
      }
    })
  }, [inbox, membersById])

  // Members we can start a new DM with (not self, not already in inbox)
  const newDmCandidates = useMemo(() => {
    const inboxIds = new Set(directConversations.map((c) => c.otherId))
    return (project?.members ?? [])
      .map((m: any) => m?.user)
      .filter((u: any) => u && u.id !== session?.user?.id && !inboxIds.has(u.id))
  }, [directConversations, project?.members, session?.user?.id])

  const activeDirectLabel = useMemo(() => {
    if (!directTargetId) return null
    const u = membersById.get(directTargetId)
    return u?.name ?? u?.email ?? directTargetId
  }, [directTargetId, membersById])

  const projectSeenLabel = useMemo(() => {
    if (!projectSeen?.messageId) return null
    const names = (projectSeen.seenBy ?? []).map((u: any) => u.name ?? u.email).filter(Boolean)
    if (names.length === 0) return null
    if (names.length === 1) return `Seen by ${names[0]}`
    if (names.length === 2) return `Seen by ${names[0]} and ${names[1]}`
    return `Seen by ${names[0]} and ${names.length - 1} others`
  }, [projectSeen])

  const directSeenLabel = useMemo(() => {
    if (!directSeen?.messageId) return null
    const names = (directSeen.seenBy ?? []).map((u: any) => u.name ?? u.email).filter(Boolean)
    if (names.length === 0) return null
    return `Seen by ${names[0]}`
  }, [directSeen])

  // Unread badge: project chat — messages newer than our lastReadAt
  // We use a simple heuristic: if we're currently on project mode, it's read
  const projectUnreadCount = useMemo(() => {
    if (mode === 'project') return 0
    // Count messages not authored by me since last read (we don't have lastReadAt on client, use last seen)
    return 0 // Would need a dedicated API; show dot if there are messages from others
  }, [mode])

  // Unread badge per DM conversation: count messages from other user with id > our lastRead message id
  // Since we don't have per-user lastReadAt on the client, we derive from inbox.lastMessage
  // A simple heuristic: if recipient is the last sender && current tab is not that conversation, show dot
  const unreadDms = useMemo(() => {
    const me = session?.user?.id
    if (!me) return new Set<string>()
    const unread = new Set<string>()
    for (const c of directConversations) {
      if (c.last?.senderId !== me && c.otherId !== directTargetId) {
        // The last message was from the other person and we're not currently viewing it
        unread.add(c.otherId)
      }
    }
    return unread
  }, [directConversations, directTargetId, session?.user?.id])

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderGroupedMessages = (messages: any[], idKey: 'authorId' | 'senderId') => {
    if (messages.length === 0) {
      return <EmptyState message="No messages yet." />
    }

    const elements: React.ReactNode[] = []
    let prevDate: Date | null = null
    let prevSenderId: string | null = null
    const GROUPING_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      const senderId: string = m[idKey]
      const isMine = senderId === session?.user?.id
      const createdAt = new Date(m.createdAt)

      // Date divider
      if (shouldShowDivider(createdAt, prevDate)) {
        elements.push(<DateDivider key={`divider-${m.id}`} label={getDayLabel(createdAt)} />)
      }

      // Grouping: first in group if sender changed OR time gap > threshold
      const prev = messages[i - 1]
      const prevCreatedAt = prev ? new Date(prev.createdAt) : null
      const timeDiff = prevCreatedAt ? createdAt.getTime() - prevCreatedAt.getTime() : Infinity
      const isFirstInGroup =
        !prev ||
        prev[idKey] !== senderId ||
        shouldShowDivider(createdAt, prevCreatedAt) ||
        timeDiff > GROUPING_THRESHOLD_MS

      const sender = isMine ? session?.user : (idKey === 'authorId' ? m.author : membersById.get(senderId))
      const senderName = sender?.name ?? sender?.email ?? 'Unknown'
      const senderInitials = getInitials(sender?.name, sender?.email)

      const isLast = i === messages.length - 1
      const seenLabel = idKey === 'authorId' ? projectSeenLabel : directSeenLabel

      elements.push(
        <div key={m.id} className="py-0.5">
          <MessageBubble
            content={m.content}
            createdAt={createdAt}
            isMine={isMine}
            isFirstInGroup={isFirstInGroup}
            senderName={senderName}
            senderInitials={senderInitials}
          />
          {isLast && isMine && seenLabel && (
            <div className="mt-1 flex justify-end pr-1">
              <p className="text-[0.65rem] text-muted-foreground">{seenLabel}</p>
            </div>
          )}
        </div>
      )

      prevDate = createdAt
      prevSenderId = senderId
    }

    return elements
  }

  // ── Active conversation header ─────────────────────────────────────────────

  const chatHeader =
    mode === 'project' ? (
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Hash className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Project chat</p>
          <p className="text-[0.7rem] text-muted-foreground">
            {project?.members?.length ?? 0} members
          </p>
        </div>
      </div>
    ) : directTargetId ? (
      <div className="flex items-center gap-2.5">
        <Avatar size="sm">
          <AvatarFallback className="text-xs font-semibold bg-accent text-accent-foreground">
            {getInitials(
              membersById.get(directTargetId)?.name,
              membersById.get(directTargetId)?.email
            )}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{activeDirectLabel ?? 'Direct message'}</p>
          <p className="text-[0.7rem] text-muted-foreground">Private conversation</p>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
          <MessageCircle className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Direct messages</p>
          <p className="text-[0.7rem] text-muted-foreground">Select a conversation</p>
        </div>
      </div>
    )

  // ── No-conversation empty state ────────────────────────────────────────────

  const noConversationSelected = (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative">
        <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent shadow-sm">
          <MessageCircle className="size-9 text-primary" />
        </div>
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
          ✓
        </span>
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Select a conversation</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-[22rem]">
          Choose a teammate from the panel on the left to start chatting privately.
        </p>
      </div>
    </div>
  )

  // ─── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      {/* App-level sidebar */}
      <Sidebar />

      {/* Messages area */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Conversation list sidebar ───────────────────────────────────── */}
        <aside className="flex w-64 shrink-0 flex-col border-r bg-background/60 backdrop-blur">
          {/* Header */}
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

            {/* Project Chat */}
            <div>
              <p className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Project
              </p>
              <button
                type="button"
                onClick={() => setMode('project')}
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
                    {project?.name ?? 'All members'}
                  </p>
                </div>
                {projectUnreadCount > 0 && (
                  <span className="shrink-0 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                    {projectUnreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Direct Messages */}
            <div>
              <p className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Direct Messages
              </p>

              {/* Existing conversations */}
              <div className="space-y-0.5">
                {directConversations.map((c) => (
                  <button
                    key={c.otherId}
                    type="button"
                    onClick={() => { setMode('direct'); setDirectTargetId(c.otherId) }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
                      mode === 'direct' && directTargetId === c.otherId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    {/* Avatar with online dot */}
                    <div className="relative shrink-0">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[0.625rem] font-semibold bg-accent text-accent-foreground">
                          {c.otherInitials}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator (always shown as green — real presence would require socket tracking) */}
                      <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-medium">{c.otherLabel}</p>
                      {c.last?.content && (
                        <p className="truncate text-[0.68rem] text-muted-foreground">{c.last.content}</p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {unreadDms.has(c.otherId) && (
                      <span className="shrink-0 size-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              {/* New DM candidates (teammates not yet in inbox) */}
              {newDmCandidates.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {newDmCandidates.map((u: any) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setMode('direct'); setDirectTargetId(u.id) }}
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
                        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-slate-400 ring-1 ring-background" />
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

        {/* ── Chat area ──────────────────────────────────────────────────── */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(148,163,184,0.08),transparent_55%)]">

          {/* Chat header */}
          <header className="flex items-center gap-3 border-b bg-background/80 px-5 py-3 backdrop-blur">
            {chatHeader}
          </header>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {mode === 'project' ? (
              <div className="flex flex-col gap-1">
                {renderGroupedMessages(projectMessages as any[], 'authorId')}
              </div>
            ) : !directTargetId ? (
              noConversationSelected
            ) : (
              <div className="flex flex-col gap-1">
                {renderGroupedMessages(directMessages as any[], 'senderId')}
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          {/* Typing indicator */}
          {typingText && <TypingIndicator text={typingText} />}

          {/* Input bar */}
          <InputBar
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            disabled={mode === 'direct' && !directTargetId}
            placeholder={
              mode === 'project'
                ? `Message #project-chat… (Enter to send)`
                : directTargetId
                ? `Message ${activeDirectLabel ?? 'privately'}…`
                : 'Select a conversation first…'
            }
            isPending={sendProjectMessage.isPending || sendDirect.isPending}
          />
        </main>
      </div>
    </div>
  )
}
