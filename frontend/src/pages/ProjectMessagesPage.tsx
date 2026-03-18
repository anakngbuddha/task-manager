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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, SendHorizonal } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'

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

    socket.on('read:project', () => {
      // Seen state is computed server-side; polling exists, but this improves responsiveness.
    })

    socket.on('read:direct', () => {
      // Same as above; client will refetch via polling or manual invalidation.
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

  const renderWithMentions = (text: string) => {
    if (!text) return null
    const parts = text.split(/(\s+)/)
    return parts.map((part, idx) => {
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span key={idx} className="text-purple-600 font-medium">
            {part}
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }

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
      socketRef.current?.emit('typing:direct', {
        projectId,
        userId: session.user.id,
        otherUserId: directTargetId,
        name,
        isTyping,
      })
    }
  }

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

  useEffect(() => {
    if (!projectId || !session?.user?.id) return
    if (mode === 'direct' && !directTargetId) return

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)

    if (input.trim().length > 0) {
      emitTyping(true)
      typingTimerRef.current = window.setTimeout(() => {
        emitTyping(false)
      }, 900)
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

  const directConversations = useMemo(() => {
    const me = session?.user?.id
    if (!me) return []

    return (inbox as any[]).map((row) => {
      const otherId = row.otherUserId as string
      const other = membersById.get(otherId)
      return {
        otherId,
        otherLabel: other?.name ?? other?.email ?? otherId,
        last: row.lastMessage,
      }
    })
  }, [inbox, membersById, session?.user?.id])

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

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-2 text-xs hover:underline">
                    <ArrowLeft className="size-4" />
                    Back to board
                  </Link>
                </div>
                <h2 className="mt-1 text-xl font-semibold leading-tight">Messages</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {project?.name ? `Project: ${project.name}` : 'Project messages'}
                </p>
              </div>

              <div className="inline-flex rounded-md bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  className={[
                    'rounded-sm px-3 py-1.5',
                    mode === 'project' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
                  ].join(' ')}
                  onClick={() => setMode('project')}
                >
                  Project
                </button>
                <button
                  type="button"
                  className={[
                    'rounded-sm px-3 py-1.5',
                    mode === 'direct' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
                  ].join(' ')}
                  onClick={() => setMode('direct')}
                >
                  Direct
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid h-[calc(100vh-4.5rem)] grid-cols-1 md:grid-cols-[17rem_1fr]">
          <aside className="border-b bg-background/70 backdrop-blur md:border-b-0 md:border-r">
            <div className="p-3">
              {mode === 'direct' ? (
                <>
                  <Label className="text-xs text-muted-foreground">Direct messages (project only)</Label>
                  <div className="mt-2 max-h-[38vh] space-y-1.5 overflow-auto pr-1 md:max-h-[calc(100vh-14rem)]">
                    {directConversations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No direct messages yet.</p>
                    ) : (
                      directConversations.map((c) => (
                        <button
                          key={c.otherId}
                          type="button"
                          onClick={() => setDirectTargetId(c.otherId)}
                          className={[
                            'w-full rounded-lg border px-2.5 py-2 text-left text-sm transition-colors',
                            directTargetId === c.otherId ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-accent',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium leading-tight">{c.otherLabel}</p>
                              <p className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">{c.last?.content}</p>
                            </div>
                            <p className="shrink-0 text-[0.65rem] text-muted-foreground">
                              {c.last?.createdAt ? new Date(c.last.createdAt).toLocaleTimeString() : ''}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground">New direct message</Label>
                    <Select value={directTargetId ?? ''} onValueChange={(v) => setDirectTargetId(v || undefined)}>
                      <SelectTrigger className="mt-2 h-9 text-sm">
                        <SelectValue placeholder="Select teammate" />
                      </SelectTrigger>
                      <SelectContent>
                        {(project?.members ?? [])
                          .map((m: any) => m?.user)
                          .filter((u: any) => u && u.id !== session?.user?.id)
                          .map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name ?? u.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Project chat is visible to all project members.
                </p>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="border-b bg-background/60 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {mode === 'project' ? 'Project chat' : (activeDirectLabel ?? 'Direct messages')}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {mode === 'project' ? 'Everyone in the project' : 'Private conversation'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {mode === 'project' ? (
                projectMessages.length === 0 ? (
                  <div className="grid h-full place-items-center">
                    <p className="text-sm text-muted-foreground">No project messages yet.</p>
                  </div>
                ) : (
                  projectMessages.map((m: any, idx: number) => (
                    <div key={m.id} className="py-0.5">
                      <div className={m.authorId === session?.user?.id ? 'flex justify-end' : 'flex justify-start'}>
                        <div
                          className={[
                            'max-w-[78%] rounded-2xl px-3 py-2 text-[0.9rem] shadow-sm',
                            m.authorId === session?.user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground',
                          ].join(' ')}
                        >
                          {m.authorId !== session?.user?.id && (
                            <p className="mb-1 text-[0.7rem] font-medium text-muted-foreground">
                              {m.author?.name ?? m.author?.email ?? 'Unknown'}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap leading-snug">{renderWithMentions(m.content)}</p>
                          <p
                            className={[
                              'mt-1 text-[0.65rem]',
                              m.authorId === session?.user?.id ? 'text-primary-foreground/80 text-right' : 'text-muted-foreground',
                            ].join(' ')}
                          >
                            {new Date(m.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {idx === projectMessages.length - 1 && m.authorId === session?.user?.id && projectSeen?.messageId === m.id && projectSeenLabel && (
                        <div className="mt-1 flex justify-end">
                          <p className="text-[0.7rem] text-muted-foreground">{projectSeenLabel}</p>
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : !directTargetId ? (
                <div className="grid h-full place-items-center">
                  <p className="text-sm text-muted-foreground">Pick a teammate to view the conversation.</p>
                </div>
              ) : directMessages.length === 0 ? (
                <div className="grid h-full place-items-center">
                  <p className="text-sm text-muted-foreground">No direct messages yet.</p>
                </div>
              ) : (
                directMessages.map((m: any, idx: number) => (
                  <div key={m.id} className="py-0.5">
                    <div className={m.senderId === session?.user?.id ? 'flex justify-end' : 'flex justify-start'}>
                      <div
                        className={[
                          'max-w-[78%] rounded-2xl px-3 py-2 text-[0.9rem] shadow-sm',
                          m.senderId === session?.user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground',
                        ].join(' ')}
                      >
                        {m.senderId !== session?.user?.id && (
                          <p className="mb-1 text-[0.7rem] font-medium text-muted-foreground">
                            {membersById.get(m.senderId)?.name ?? membersById.get(m.senderId)?.email ?? 'Unknown'}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-snug">{renderWithMentions(m.content)}</p>
                        <p
                          className={[
                            'mt-1 text-[0.65rem]',
                            m.senderId === session?.user?.id ? 'text-primary-foreground/80 text-right' : 'text-muted-foreground',
                          ].join(' ')}
                        >
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {idx === directMessages.length - 1 && m.senderId === session?.user?.id && directSeen?.messageId === m.id && directSeenLabel && (
                      <div className="mt-1 flex justify-end">
                        <p className="text-[0.7rem] text-muted-foreground">{directSeenLabel}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>

            {/* Instagram-style typing indicator just above input */}
            <div className="px-3 pb-2">
              {typingText && (
                <div className="flex items-end gap-2">
                  <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{typingText}</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t bg-background/70 p-3">
              <div className="flex gap-2">
                <Input
                  placeholder={mode === 'project' ? 'Message the project…' : 'Message privately…'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-10"
                  disabled={mode === 'direct' && !directTargetId}
                />
                <Button
                  type="submit"
                  className="h-10 px-3"
                  disabled={
                    !input.trim()
                    || (mode === 'direct' && !directTargetId)
                    || sendProjectMessage.isPending
                    || sendDirect.isPending
                  }
                >
                  <SendHorizonal className="size-4" />
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}

