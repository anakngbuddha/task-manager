/**
 * DashboardTerminal — workspace-level terminal for the dashboard.
 *
 * Unlike ProjectTerminal (which operates in a projectId scope),
 * this terminal runs without a specific project context. It supports
 * workspace-level commands: touch project, ls projects, whoami.
 *
 * The same keyboard shortcut (Ctrl+`) toggles it.
 * Position is persisted separately from the project terminal.
 */
import { useEffect, useCallback, useState } from 'react'
import { TerminalPanel } from './TerminalPanel'
import { useSession } from '@/lib/auth-client'

const DASHBOARD_KEY = 'vfs-terminal-dashboard-open'

interface DashboardTerminalProps {
  /** The user's name for the welcome message */
  userName?: string | null
}

export default function DashboardTerminal({ userName }: DashboardTerminalProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(DASHBOARD_KEY) === 'true' }
    catch { return false }
  })

  const toggle = useCallback(() => setIsOpen(v => !v), [])

  // Keyboard shortcut Ctrl+`
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  useEffect(() => {
    try { localStorage.setItem(DASHBOARD_KEY, String(isOpen)) }
    catch {}
  }, [isOpen])

  return (
    <>
      {/* Terminal toggle button */}
      <button
        onClick={toggle}
        className="terminal-toggle-btn"
        title="Open terminal (Ctrl+`)"
        aria-label="Toggle terminal"
        style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', zIndex: 50 }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {isOpen ? '✕ Terminal' : '>_ Terminal'}
        </span>
      </button>

      {isOpen && (
        <TerminalPanel
          projectId="__dashboard__"
          projectName="Workspace"
          userRole={null}
          user={
            session?.user
              ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
              : null
          }
          onClose={() => setIsOpen(false)}
          storageKey="terminal-geo-dashboard"
        />
      )}
    </>
  )
}
