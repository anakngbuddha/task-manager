import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Paperclip, SendHorizonal, Smile, AtSign } from 'lucide-react'
import { getInitials } from './MessageBubble'

type MentionMember = { id: string; name?: string | null; email?: string | null }

interface MessageInputBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  disabled?: boolean
  placeholder?: string
  isPending?: boolean
  members?: MentionMember[]
}

export default function MessageInputBar({ value, onChange, onSubmit, disabled, placeholder, isPending, members = [] }: MessageInputBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    onChange(text)

    const caret = e.target.selectionStart
    const textBefore = text.slice(0, caret)
    const match = textBefore.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1].toLowerCase())
      setMentionStart(caret - match[0].length)
    } else {
      setMentionQuery(null)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && e.key === 'Escape') {
      setMentionQuery(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  const insertMention = (displayName: string) => {
    const caret = ref.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(caret)
    const inserted = `@${displayName} `
    const next = before + inserted + after
    onChange(next)
    setMentionQuery(null)
    setTimeout(() => {
      const pos = mentionStart + inserted.length
      ref.current?.setSelectionRange(pos, pos)
      ref.current?.focus()
    }, 0)
  }

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members.filter((m) => {
      const n = (m.name ?? m.email ?? '').toLowerCase()
      return n.includes(q)
    })
  }, [mentionQuery, members])

  const showPicker = mentionQuery !== null && (filteredMembers.length > 0 || mentionQuery === '')

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
    setMentionQuery('')
    setMentionStart(start)
    setTimeout(() => {
      ref.current?.setSelectionRange(start + text.length, start + text.length)
      ref.current?.focus()
    }, 0)
  }

  return (
    <form onSubmit={onSubmit} className="relative border-t bg-background/80 px-4 py-3 backdrop-blur">
      {showPicker && (
        <div className="absolute bottom-full left-4 right-4 mb-1 z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
            Mention a member
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); insertMention('everyone') }}
            >
              <span className="size-6 rounded-full bg-primary/20 text-center text-xs leading-6 font-bold text-primary">@</span>
              <span className="font-medium">everyone</span>
              <span className="ml-auto text-[0.68rem] text-muted-foreground">Notify all members</span>
            </button>
            {filteredMembers.map((m) => {
              const display = m.name ?? m.email ?? 'Unknown'
              const initials = getInitials(m.name, m.email)
              return (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(display) }}
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[0.6rem] font-semibold bg-muted text-muted-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span>{display}</span>
                </button>
              )
            })}
            {filteredMembers.length === 0 && mentionQuery !== '' && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No members match &ldquo;{mentionQuery}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background shadow-sm ring-1 ring-transparent focus-within:ring-primary/30 transition-shadow">
        <textarea
          ref={ref}
          rows={1}
          className="w-full resize-none bg-transparent px-3 pt-3 pb-0 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          placeholder={placeholder ?? 'Type a message… (Enter to send, Shift+Enter for new line)'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          disabled={disabled}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
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
