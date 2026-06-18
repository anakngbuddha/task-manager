import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

// ─── Types ────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// ─── Quick prompt suggestions ─────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: '📋', label: 'My pending tasks', prompt: 'Show me my pending tasks' },
  { icon: '📅', label: 'This week\'s schedule', prompt: 'What schedules do I have this week?' },
  { icon: '🚀', label: 'How to create a task', prompt: 'How do I create a task in this app?' },
  { icon: '👥', label: 'Invite a team member', prompt: 'How do I invite someone to my project?' },
  { icon: '⚡', label: 'Set up automations', prompt: 'How do automations work?' },
  { icon: '🔥', label: 'Overdue tasks', prompt: 'Do I have any overdue tasks?' },
]

// ─── Typing indicator ─────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="chat-typing-indicator">
      <span />
      <span />
      <span />
    </div>
  )
}

// ─── Single message bubble ────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={cn('chat-message-row', isUser ? 'chat-message-row--user' : 'chat-message-row--ai')}>
      {!isUser && (
        <div className="chat-avatar chat-avatar--ai" aria-label="TaskBot">
          🤖
        </div>
      )}
      <div className={cn('chat-bubble', isUser ? 'chat-bubble--user' : 'chat-bubble--ai')}>
        {isUser ? (
          <p className="chat-bubble-text">{msg.content}</p>
        ) : (
          <div className="chat-bubble-markdown">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
        <span className="chat-bubble-time">{time}</span>
      </div>
      {isUser && (
        <div className="chat-avatar chat-avatar--user" aria-label="You">
          You
        </div>
      )}
    </div>
  )
}

// ─── Main ChatWidget ──────────────────────────────────────────────────────

export default function ChatWidget() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Load chat history when first opened
  useEffect(() => {
    if (isOpen && !hasLoadedHistory && session?.user) {
      setIsHistoryLoading(true)
      api.get<{ messages: Message[] }>('/chat/history?limit=50')
        .then(res => {
          setMessages(res.data.messages || [])
          setHasLoadedHistory(true)
        })
        .catch(() => {
          // Silent fail — just start with empty history
          setHasLoadedHistory(true)
        })
        .finally(() => setIsHistoryLoading(false))
    }
  }, [isOpen, hasLoadedHistory, session])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    setInput('')
    setError(null)
    const tempId = `temp-${Date.now()}`
    const userMsg: Message = {
      id: tempId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await api.post<{ message: string; timestamp: string }>('/chat', {
        message: trimmed,
      })
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.data.message,
        createdAt: res.data.timestamp,
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setError('Failed to get a response. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClearHistory = async () => {
    try {
      await api.delete('/chat/history')
      setMessages([])
      setShowClearConfirm(false)
    } catch {
      setError('Failed to clear history.')
    }
  }

  if (!session) return null

  return (
    <>
      {/* Chat styles */}
      <style>{CHAT_CSS}</style>

      {/* ── Floating toggle button ── */}
      <button
        id="chat-widget-toggle"
        className={cn('chat-fab', isOpen && 'chat-fab--active')}
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        title="AI Assistant — TaskBot"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <circle cx="9" cy="10" r="0.5" fill="currentColor" /><circle cx="12" cy="10" r="0.5" fill="currentColor" /><circle cx="15" cy="10" r="0.5" fill="currentColor" />
          </svg>
        )}
        {/* Notification pulse for new users */}
        {!isOpen && messages.length === 0 && !hasLoadedHistory && (
          <span className="chat-fab-pulse" />
        )}
      </button>

      {/* ── Chat panel ── */}
      <div
        id="chat-widget-panel"
        className={cn('chat-panel', isOpen && 'chat-panel--open')}
        role="dialog"
        aria-label="TaskBot AI Assistant"
      >
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-avatar">🤖</div>
            <div>
              <p className="chat-header-title">TaskBot</p>
              <p className="chat-header-subtitle">AI Assistant • We Work IT</p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              className="chat-icon-btn"
              onClick={() => setShowClearConfirm(true)}
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </button>
            <button
              className="chat-icon-btn"
              onClick={() => setIsOpen(false)}
              title="Close"
              aria-label="Close chat"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clear confirm */}
        {showClearConfirm && (
          <div className="chat-confirm-bar">
            <span>Clear all chat history?</span>
            <button className="chat-confirm-yes" onClick={handleClearHistory}>Clear</button>
            <button className="chat-confirm-no" onClick={() => setShowClearConfirm(false)}>Cancel</button>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages" id="chat-messages-list">
          {isHistoryLoading ? (
            <div className="chat-loading-history">
              <div className="chat-spinner" />
              <span>Loading your chat history…</span>
            </div>
          ) : (
            <>
              {/* Welcome / quick prompts shown when no messages */}
              {messages.length === 0 && (
                <div className="chat-welcome">
                  <div className="chat-welcome-avatar">🤖</div>
                  <p className="chat-welcome-title">Hi {session.user?.name?.split(' ')[0] || 'there'}! I'm TaskBot</p>
                  <p className="chat-welcome-subtitle">
                    I can help you with your tasks, schedules, and anything about the app. Try one of these:
                  </p>
                  <div className="chat-quick-prompts">
                    {QUICK_PROMPTS.map(qp => (
                      <button
                        key={qp.prompt}
                        className="chat-quick-prompt"
                        onClick={() => sendMessage(qp.prompt)}
                        disabled={isLoading}
                      >
                        <span className="chat-quick-icon">{qp.icon}</span>
                        <span>{qp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="chat-message-row chat-message-row--ai">
                  <div className="chat-avatar chat-avatar--ai">🤖</div>
                  <div className="chat-bubble chat-bubble--ai chat-bubble--typing">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="chat-error">
                  <span>⚠️ {error}</span>
                  <button onClick={() => setError(null)}>✕</button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            id="chat-input"
            className="chat-textarea"
            placeholder="Ask me anything…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="chat-footer-hint">Enter to send • Shift+Enter for newline • History kept 30 days</p>
      </div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────

const CHAT_CSS = `
/* ── Floating action button ── */
.chat-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  color: white;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.5), 0 2px 8px rgba(0,0,0,0.3);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.chat-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 32px rgba(99, 102, 241, 0.6), 0 2px 12px rgba(0,0,0,0.35);
}
.chat-fab--active {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  transform: scale(0.95);
}
.chat-fab-pulse {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f59e0b;
  border: 2px solid white;
  animation: chatPulse 2s infinite;
}
@keyframes chatPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

/* ── Panel ── */
.chat-panel {
  position: fixed;
  bottom: 96px;
  right: 28px;
  z-index: 9998;
  width: 400px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(15, 15, 25, 0.92);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(99, 102, 241, 0.3);
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset;
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}
.chat-panel--open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: all;
}

/* ── Header ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.15) 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
  flex-shrink: 0;
}
.chat-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chat-header-avatar {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(99,102,241,0.5));
}
.chat-header-title {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1;
  letter-spacing: 0.01em;
}
.chat-header-subtitle {
  font-size: 11px;
  color: rgba(167, 139, 250, 0.8);
  margin: 2px 0 0;
  line-height: 1;
}
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.chat-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  color: rgba(167, 139, 250, 0.7);
  transition: background 0.15s, color 0.15s;
}
.chat-icon-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  color: white;
}

/* ── Confirm bar ── */
.chat-confirm-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.15);
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 12px;
  color: #fca5a5;
  flex-shrink: 0;
}
.chat-confirm-bar span { flex: 1; }
.chat-confirm-yes {
  background: #ef4444;
  color: white;
  border: none;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
}
.chat-confirm-no {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  border: none;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

/* ── Messages area ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

/* ── Loading history ── */
.chat-loading-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(167, 139, 250, 0.7);
  font-size: 13px;
  padding: 40px 20px;
}
.chat-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(99,102,241,0.3);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: chatSpin 0.7s linear infinite;
}
@keyframes chatSpin { to { transform: rotate(360deg); } }

/* ── Welcome screen ── */
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 4px;
  gap: 8px;
}
.chat-welcome-avatar {
  font-size: 36px;
  filter: drop-shadow(0 4px 12px rgba(99,102,241,0.5));
  margin-bottom: 4px;
}
.chat-welcome-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}
.chat-welcome-subtitle {
  font-size: 12px;
  color: rgba(167, 139, 250, 0.7);
  margin: 0;
  line-height: 1.5;
}
.chat-quick-prompts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
}
.chat-quick-prompt {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: rgba(167, 139, 250, 0.9);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  line-height: 1.3;
}
.chat-quick-prompt:hover {
  background: rgba(99, 102, 241, 0.22);
  border-color: rgba(99, 102, 241, 0.5);
  color: white;
  transform: translateY(-1px);
}
.chat-quick-prompt:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-quick-icon { font-size: 14px; flex-shrink: 0; }

/* ── Message row ── */
.chat-message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  animation: chatMsgIn 0.25s ease;
}
@keyframes chatMsgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.chat-message-row--user { flex-direction: row-reverse; }
.chat-message-row--ai { flex-direction: row; }

/* ── Avatars ── */
.chat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.chat-avatar--ai {
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3));
  border: 1px solid rgba(99,102,241,0.4);
}
.chat-avatar--user {
  background: linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.5));
  border: 1px solid rgba(139,92,246,0.5);
  color: white;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* ── Bubbles ── */
.chat-bubble {
  max-width: 82%;
  padding: 10px 13px;
  border-radius: 16px;
  position: relative;
}
.chat-bubble--user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 12px rgba(99,102,241,0.35);
}
.chat-bubble--ai {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom-left-radius: 4px;
  backdrop-filter: blur(8px);
}
.chat-bubble--typing {
  padding: 12px 16px;
}
.chat-bubble-text {
  font-size: 13.5px;
  color: white;
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}
.chat-bubble-time {
  display: block;
  font-size: 10px;
  margin-top: 4px;
  opacity: 0.55;
  color: white;
  text-align: right;
}
.chat-bubble--ai .chat-bubble-time { text-align: left; }

/* ── AI markdown ── */
.chat-bubble-markdown {
  font-size: 13.5px;
  color: rgba(255,255,255,0.92);
  line-height: 1.6;
  word-break: break-word;
}
.chat-bubble-markdown p { margin: 0 0 6px; }
.chat-bubble-markdown p:last-child { margin-bottom: 0; }
.chat-bubble-markdown ul, .chat-bubble-markdown ol { margin: 4px 0 6px 16px; padding: 0; }
.chat-bubble-markdown li { margin-bottom: 2px; }
.chat-bubble-markdown strong { color: #a78bfa; font-weight: 700; }
.chat-bubble-markdown em { color: #c4b5fd; }
.chat-bubble-markdown code {
  background: rgba(99,102,241,0.2);
  border: 1px solid rgba(99,102,241,0.3);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}
.chat-bubble-markdown pre {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 6px 0;
}
.chat-bubble-markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 12px;
}
.chat-bubble-markdown h1, .chat-bubble-markdown h2, .chat-bubble-markdown h3 {
  color: #c4b5fd;
  margin: 8px 0 4px;
  font-size: 13.5px;
  font-weight: 700;
}
.chat-bubble-markdown a { color: #818cf8; text-decoration: underline; }
.chat-bubble-markdown blockquote {
  border-left: 2px solid rgba(99,102,241,0.5);
  padding-left: 10px;
  margin: 4px 0;
  color: rgba(255,255,255,0.65);
}
.chat-bubble-markdown hr {
  border: none;
  border-top: 1px solid rgba(99,102,241,0.2);
  margin: 8px 0;
}

/* ── Typing indicator ── */
.chat-typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
}
.chat-typing-indicator span {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(167, 139, 250, 0.7);
  animation: chatTypingBounce 1.2s infinite ease-in-out;
}
.chat-typing-indicator span:nth-child(1) { animation-delay: 0s; }
.chat-typing-indicator span:nth-child(2) { animation-delay: 0.18s; }
.chat-typing-indicator span:nth-child(3) { animation-delay: 0.36s; }
@keyframes chatTypingBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}

/* ── Error ── */
.chat-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 12px;
  color: #fca5a5;
}
.chat-error button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #fca5a5;
  font-size: 14px;
  line-height: 1;
}

/* ── Input area ── */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgba(99, 102, 241, 0.15);
  background: rgba(0,0,0,0.2);
  flex-shrink: 0;
}
.chat-textarea {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px;
  padding: 10px 13px;
  color: white;
  font-size: 13.5px;
  line-height: 1.5;
  resize: none;
  outline: none;
  font-family: inherit;
  min-height: 40px;
  max-height: 120px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
.chat-textarea::placeholder { color: rgba(167, 139, 250, 0.4); }
.chat-textarea:focus { border-color: rgba(99, 102, 241, 0.6); background: rgba(255,255,255,0.08); }
.chat-textarea:disabled { opacity: 0.5; }
.chat-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  flex-shrink: 0;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(99,102,241,0.4);
}
.chat-send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(99,102,241,0.5);
}
.chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* ── Footer hint ── */
.chat-footer-hint {
  font-size: 10px;
  color: rgba(167, 139, 250, 0.35);
  text-align: center;
  padding: 0 14px 10px;
  margin: 0;
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .chat-panel {
    width: calc(100vw - 20px);
    right: 10px;
    bottom: 80px;
    max-height: 70vh;
  }
  .chat-fab { right: 16px; bottom: 16px; }
}
`
