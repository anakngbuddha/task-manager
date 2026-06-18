import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { MessageSquare, X, Send, Bot, CheckSquare, Calendar, UserPlus, Zap, AlertCircle, Sparkles, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// ─── Quick prompt suggestions ─────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: <CheckSquare size={16} />, label: 'My pending tasks', prompt: 'Show me my pending tasks' },
  { icon: <Calendar size={16} />, label: 'This week\'s schedule', prompt: 'What schedules do I have this week?' },
  { icon: <Sparkles size={16} />, label: 'How to create a task', prompt: 'How do I create a task in this app?' },
  { icon: <UserPlus size={16} />, label: 'Invite a team member', prompt: 'How do I invite someone to my project?' },
  { icon: <Zap size={16} />, label: 'Set up automations', prompt: 'How do automations work?' },
  { icon: <AlertCircle size={16} />, label: 'Overdue tasks', prompt: 'Do I have any overdue tasks?' },
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
        <div className="chat-avatar chat-avatar--ai" aria-label="WeBot">
          <Bot size={16} />
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
      api.get<{ messages: Message[] }>(`/chat/history?limit=50&_t=${Date.now()}`)
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
        title="AI Assistant — WeBot"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <MessageSquare size={24} />
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
        aria-label="WeBot AI Assistant"
      >
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-avatar"><Bot size={22} /></div>
            <div>
              <p className="chat-header-title">WeBot</p>
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
              <Trash2 size={16} />
            </button>
            <button
              className="chat-icon-btn"
              onClick={() => setIsOpen(false)}
              title="Close"
              aria-label="Close chat"
            >
              <X size={18} />
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
                  <div className="chat-welcome-avatar"><Bot size={40} className="text-indigo-500" /></div>
                  <p className="chat-welcome-title">Hi {session.user?.name?.split(' ')[0] || 'there'}! I'm WeBot</p>
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
                  <div className="chat-avatar chat-avatar--ai"><Bot size={16} /></div>
                  <div className="chat-bubble chat-bubble--ai chat-bubble--typing">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="chat-error">
                  <span><AlertCircle size={14} className="inline mr-1" /> {error}</span>
                  <button onClick={() => setError(null)}><X size={14} /></button>
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
            <Send size={16} />
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
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.4), 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.chat-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 32px rgba(99, 102, 241, 0.5), 0 2px 12px rgba(0,0,0,0.15);
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 24px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.5) inset;
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
  color: #1f2937;
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
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}
.chat-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chat-header-avatar {
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-header-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1;
  letter-spacing: 0.01em;
}
.chat-header-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0 0;
  line-height: 1;
}
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.chat-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  transition: background 0.15s, color 0.15s;
}
.chat-icon-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

/* ── Confirm bar ── */
.chat-confirm-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #fef2f2;
  border-bottom: 1px solid #fee2e2;
  font-size: 13px;
  color: #ef4444;
  flex-shrink: 0;
}
.chat-confirm-bar span { flex: 1; font-weight: 500; }
.chat-confirm-yes {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.15s;
}
.chat-confirm-yes:hover { background: #dc2626; }
.chat-confirm-no {
  background: #fee2e2;
  color: #b91c1c;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-weight: 500;
}
.chat-confirm-no:hover { background: #fecaca; }

/* ── Messages area ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
  background: #f8fafc;
}
.chat-messages::-webkit-scrollbar { width: 6px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.chat-messages::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* ── Loading history ── */
.chat-loading-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
  font-size: 13px;
  padding: 40px 20px;
}
.chat-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e2e8f0;
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
  padding: 12px 4px;
  gap: 10px;
}
.chat-welcome-avatar {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  border-radius: 50%;
  width: 64px;
  height: 64px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.1);
}
.chat-welcome-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.chat-welcome-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}
.chat-quick-prompts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}
.chat-quick-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  line-height: 1.3;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.chat-quick-prompt:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
.chat-quick-prompt:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-quick-icon { color: #6366f1; flex-shrink: 0; display: flex; align-items: center; }

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
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #6366f1;
}
.chat-avatar--user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* ── Bubbles ── */
.chat-bubble {
  max-width: 82%;
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.chat-bubble--user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-bottom-right-radius: 4px;
  color: white;
}
.chat-bubble--ai {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-bottom-left-radius: 4px;
  color: #1e293b;
}
.chat-bubble--typing {
  padding: 14px 18px;
}
.chat-bubble-text {
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}
.chat-bubble-time {
  display: block;
  font-size: 11px;
  margin-top: 6px;
  opacity: 0.8;
  text-align: right;
}
.chat-bubble--ai .chat-bubble-time { text-align: left; color: #94a3b8; }
.chat-bubble--user .chat-bubble-time { color: rgba(255,255,255,0.8); }

/* ── AI markdown ── */
.chat-bubble-markdown {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.chat-bubble-markdown p { margin: 0 0 8px; }
.chat-bubble-markdown p:last-child { margin-bottom: 0; }
.chat-bubble-markdown ul, .chat-bubble-markdown ol { margin: 6px 0 8px 20px; padding: 0; }
.chat-bubble-markdown li { margin-bottom: 4px; }
.chat-bubble-markdown strong { color: #0f172a; font-weight: 600; }
.chat-bubble-markdown em { color: #475569; }
.chat-bubble-markdown code {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  color: #db2777;
}
.chat-bubble-markdown pre {
  background: #0f172a;
  border-radius: 10px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 8px 0;
}
.chat-bubble-markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 13px;
  color: #e2e8f0;
}
.chat-bubble-markdown h1, .chat-bubble-markdown h2, .chat-bubble-markdown h3 {
  color: #0f172a;
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 700;
}
.chat-bubble-markdown a { color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }
.chat-bubble-markdown a:hover { color: #4f46e5; }
.chat-bubble-markdown blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
  margin: 6px 0;
  color: #64748b;
  font-style: italic;
}
.chat-bubble-markdown hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 12px 0;
}

/* ── Typing indicator ── */
.chat-typing-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 18px;
}
.chat-typing-indicator span {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
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
  padding: 10px 14px;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  font-size: 13px;
  color: #ef4444;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.chat-error button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #f87171;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}
.chat-error button:hover { color: #dc2626; }

/* ── Input area ── */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  flex-shrink: 0;
}
.chat-textarea {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 20px;
  padding: 10px 16px;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  font-family: inherit;
  min-height: 42px;
  max-height: 120px;
  overflow-y: auto;
  transition: all 0.2s ease;
}
.chat-textarea::placeholder { color: #94a3b8; }
.chat-textarea:focus { 
  border-color: #818cf8; 
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.chat-textarea:disabled { opacity: 0.6; background: #f1f5f9; }
.chat-send-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 8px rgba(99,102,241,0.3);
}
.chat-send-btn:hover:not(:disabled) {
  transform: scale(1.08) translateY(-2px);
  box-shadow: 0 6px 16px rgba(99,102,241,0.4);
}
.chat-send-btn:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
  transform: none; 
  background: #cbd5e1;
  box-shadow: none;
}

/* ── Footer hint ── */
.chat-footer-hint {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  padding: 0 16px 12px;
  margin: 0;
  background: #ffffff;
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .chat-panel {
    width: calc(100vw - 20px);
    right: 10px;
    bottom: 80px;
    max-height: 75vh;
  }
  .chat-fab { right: 16px; bottom: 16px; }
}
`
