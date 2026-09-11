import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from '@/components/layout/Sidebar'
import { useProject } from '@/hooks/useProject'
import { useProjectMessages, useSendProjectMessage } from '@/hooks/useProjectMessages'
import { useProjectDirectInbox } from '@/hooks/useProjectDirectInbox'
import { useProjectDirectMessages, useSendProjectDirectMessage } from '@/hooks/useProjectDirectMessages'
import { useDirectSeen, useMarkDirectRead, useMarkProjectRead, useProjectSeen } from '@/hooks/useReadReceipts'
import { useSession } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Hash, MessageCircle } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { useUserStatuses } from '@/hooks/useUserStatus'
import MessageBubble, {
  getInitials,
  getDayLabel,
  shouldShowDivider,
  DateDivider,
  TypingIndicator,
  EmptyState,
} from '@/components/messages/MessageBubble'
import MessageInputBar from '@/components/messages/MessageInputBar'
import ConversationSidebar from '@/components/messages/ConversationSidebar'

export default function ProjectMessagesPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: project } = useProject(projectId!)
  const location = useLocation()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<'project' | 'direct'>('project')
  const [input, setInput] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

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
  const [socketConnected, setSocketConnected] = useState(false)

  const membersById = useMemo(() => {
    const map = new Map<string, any>()
    for (const m of project?.members ?? []) {
      if (m?.user?.id) map.set(m.user.id, m.user)
    }
    return map
  }, [project?.members])

  const memberUserIds = useMemo(
    () => (project?.members ?? []).map((m: any) => m?.user?.id).filter(Boolean) as string[],
    [project?.members]
  )
  const { data: memberStatuses = [] } = useUserStatuses(memberUserIds)
  const statusById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of memberStatuses) map.set(s.id, s.status)
    return map
  }, [memberStatuses])

  useEffect(() => {
    if (!projectId || !session?.user?.id) return

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const sessionToken = (session as any)?.session?.token
    const socket = createSocket(sessionToken)
    socketRef.current = socket

    const joinRooms = () => {
      setSocketConnected(true)
      socket.emit('join:project', projectId)
      if (directTargetId) {
        socket.emit('join:direct', { projectId, userId: session.user!.id, otherUserId: directTargetId })
      }
    }

    socket.on('connect', joinRooms)

    socket.on('reconnect', () => {
      joinRooms()
      queryClient.invalidateQueries({ queryKey: ['project-messages', projectId] })
      if (directTargetId) {
        queryClient.invalidateQueries({ queryKey: ['project-direct-messages', projectId, directTargetId] })
      }
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.warn('[socket] connection error:', err.message)
      setSocketConnected(false)
    })

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

    socket.on('message:project', (msg: any) => {
      if (msg?.id && msg?.authorId !== session?.user?.id) {
        queryClient.setQueryData(['project-messages', projectId], (old: any[] | undefined) => {
          if (!old) return [msg]
          if (old.some((m: any) => m.id === msg.id)) return old
          return [...old, msg]
        })
      }
    })

    socket.on('message:direct', (msg: any) => {
      if (msg?.id && msg?.senderId !== session?.user?.id) {
        const otherUserId = msg.senderId
        queryClient.setQueryData(
          ['project-direct-messages', msg.projectId, otherUserId],
          (old: any[] | undefined) => {
            if (!old) return [msg]
            if (old.some((m: any) => m.id === msg.id)) return old
            return [...old, msg]
          }
        )
      }
    })

    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [projectId, session?.user?.id, queryClient])

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
      typingTimerRef.current = window.setTimeout(() => emitTyping(false), 2500)
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
    if (!input.trim() && !attachedFile) return
    if (!projectId || !session?.user?.id) return

    emitTyping(false)

    const contentToSend = input.trim()
    const fileToSend = attachedFile

    setInput('')
    setAttachedFile(null)

    let fileUrl: string | undefined = undefined
    let fileName: string | undefined = undefined

    if (fileToSend) {
      const formData = new FormData()
      formData.append('file', fileToSend)
      try {
        const res = await api.post('/upload', formData)
        fileUrl = res.data.fileUrl
        fileName = res.data.fileName
      } catch (err) {
        console.error('Failed to upload file', err)
        return
      }
    }

    if (mode === 'project') {
      sendProjectMessage.mutate({ 
        projectId, 
        content: contentToSend,
        fileUrl,
        fileName,
        authorId: session.user.id,
        authorName: session.user.name ?? undefined,
        authorEmail: session.user.email ?? undefined,
      })
    } else if (mode === 'direct' && directTargetId) {
      sendDirect.mutate({ 
        projectId, 
        otherUserId: directTargetId, 
        content: contentToSend,
        fileUrl,
        fileName,
        senderId: session.user.id,
        senderName: session.user.name ?? undefined,
        senderEmail: session.user.email ?? undefined,
      })
    }
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

  const projectUnreadCount = useMemo(() => {
    if (mode === 'project') return 0
    return 0
  }, [mode])

  const unreadDms = useMemo(() => {
    const me = session?.user?.id
    if (!me) return new Set<string>()
    const unread = new Set<string>()
    for (const c of directConversations) {
      if (c.last?.senderId !== me && c.otherId !== directTargetId) {
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
    const GROUPING_THRESHOLD_MS = 5 * 60 * 1000

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      const senderId: string = m[idKey]
      const isMine = senderId === session?.user?.id
      const createdAt = new Date(m.createdAt)

      if (shouldShowDivider(createdAt, prevDate)) {
        elements.push(<DateDivider key={`divider-${m.id}`} label={getDayLabel(createdAt)} />)
      }

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
            fileUrl={m.fileUrl}
            fileName={m.fileName}
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
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 overflow-hidden">
        <ConversationSidebar
          projectId={projectId!}
          projectName={project?.name}
          mode={mode}
          directTargetId={directTargetId}
          directConversations={directConversations}
          newDmCandidates={newDmCandidates}
          statusById={statusById}
          unreadDms={unreadDms}
          projectUnreadCount={projectUnreadCount}
          onSelectProject={() => setMode('project')}
          onSelectDirect={(userId) => { setMode('direct'); setDirectTargetId(userId) }}
        />

        <main className="flex flex-1 min-w-0 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(148,163,184,0.08),transparent_55%)]">
          <header className="flex items-center justify-between border-b bg-background/80 px-5 py-3 backdrop-blur">
            <div className="flex items-center gap-3">{chatHeader}</div>
            {!socketConnected && (
              <span className="flex items-center gap-1.5 text-[0.65rem] text-amber-600 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                Reconnecting...
              </span>
            )}
          </header>

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

          {typingText && <TypingIndicator text={typingText} />}

          <MessageInputBar
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
            isPending={false}
            allowMentions={mode === 'project'}
            attachedFile={attachedFile}
            onAttachFile={setAttachedFile}
            onRemoveFile={() => setAttachedFile(null)}
            members={(project?.members ?? [])
              .map((m: any) => ({
                id: m.user?.id ?? m.userId,
                name: m.user?.name,
                email: m.user?.email,
              }))
              .filter((m: any) => m.id !== session?.user?.id)}
          />
        </main>
      </div>
    </div>
  )
}
