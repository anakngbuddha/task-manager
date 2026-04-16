/**
 * GlobalTerminal — the single, app-wide terminal instance.
 *
 * Mounted once in the authenticated layout (Sidebar.tsx) so it is always
 * present regardless of which page the user is on.
 *
 * Features:
 *  - Floating mode: draggable + resizable overlay (free-form, like a window)
 *  - Pinned mode: full-width panel docked to the bottom (VS Code style)
 *  - Minimized: slim title bar at the bottom — history is preserved
 *  - Closed: panel gone, history cleared on next open
 *
 * The toggle button lives at bottom-RIGHT so it never blocks the sidebar
 * profile footer area.
 *
 * Keyboard shortcut: Ctrl+` toggles open/minimized.
 */
import { useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { useProject } from '@/hooks/useProject'
import { useTerminalContext } from '@/contexts/TerminalContext'
import { TerminalPanel } from './TerminalPanel'
import type { CommandContext } from '@/lib/vfs/commandTypes'

type EffectiveRole = CommandContext['userRole']

/**
 * Derives the effective VFS role for a user.
 * Priority:
 *  1. Their membership role in the current project (if they are a member)
 *  2. Their system-level role from better-auth session (admin → MASTER_ADMIN)
 *  3. Fallback to MEMBER
 */
function deriveRole(
  members: Array<{ userId: string; role: string }>,
  userId: string,
  systemRole?: string | null
): EffectiveRole {
  // Check explicit project membership first
  const m = members.find((m) => m.userId === userId)
  if (m) {
    if (m.role === 'MASTER_ADMIN') return 'MASTER_ADMIN'
    if (m.role === 'PROJECT_MANAGER') return 'PROJECT_MANAGER'
    return 'MEMBER'
  }
  // Fall back to system-level role (better-auth stores 'admin' on session.user.role)
  if (systemRole === 'admin' || systemRole === 'MASTER_ADMIN') return 'MASTER_ADMIN'
  return 'MEMBER'
}

export default function GlobalTerminal() {
  const { mode, open, minimize, restore, close, setProjectContext } = useTerminalContext()
  const { data: session } = useSession()

  // Read projectId from route if we are inside a project page
  const { id: projectId } = useParams<{ id?: string }>()
  const { data: project } = useProject(projectId ?? '')

  const myId = session?.user?.id ?? ''
  const systemRole = (session?.user as any)?.role ?? null
  const members = project?.members ?? []
  // Pass the system role so MASTER_ADMIN is recognized even without explicit project membership
  const effectiveRole = projectId ? deriveRole(members, myId, systemRole) : (systemRole === 'admin' || systemRole === 'MASTER_ADMIN' ? 'MASTER_ADMIN' : null)
  const resolvedName = project?.name ?? 'Workspace'
  const resolvedId = projectId ?? '__workspace__'

  // Keep global context in sync with current page's project.
  // IMPORTANT: Only update when the ROUTE changes — not when the terminal
  // switches project internally via `cd projects/<name>`.
  // We track the last route-driven projectId to avoid clobbering terminal switches.
  const prevRouteIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevRouteIdRef.current !== resolvedId) {
      prevRouteIdRef.current = resolvedId
      setProjectContext(resolvedId, resolvedName, effectiveRole)
    }
  }, [resolvedId, resolvedName, effectiveRole, setProjectContext])

  // Ctrl+` keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        if (mode === 'closed') {
          open('floating')
        } else if (mode === 'minimized') {
          restore()
        } else {
          minimize()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, open, minimize, restore])

  const user = session?.user
    ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
    : null

  const isVisible = mode === 'floating' || mode === 'pinned'
  const isMinimized = mode === 'minimized'

  return (
    <>
      {/* ── Toggle button (bottom-right, never near sidebar) ── */}
      {mode === 'closed' && (
        <button
          id="terminal-toggle-btn"
          type="button"
          onClick={() => open('floating')}
          title="Open Terminal (Ctrl+`)"
          aria-label="Open VFS Terminal"
          className="term-toggle-btn"
        >
          <span className="term-toggle-btn-icon">&gt;_</span>
          <span>Terminal</span>
          <span className="term-toggle-btn-shortcut">Ctrl+`</span>
        </button>
      )}

      {/* ── Minimized bar (click to restore) ── */}
      {isMinimized && (
        <div
          className="term-minimized-bar"
          onClick={restore}
          role="button"
          tabIndex={0}
          aria-label="Restore terminal"
          onKeyDown={(e) => e.key === 'Enter' && restore()}
        >
          <span className="term-minimized-bar-dot" />
          <span className="term-minimized-bar-label">&gt;_ vfs — {resolvedName}</span>
          <span className="term-minimized-bar-hint">click to restore</span>
          {/* Close button in minimized bar */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close() }}
            title="Close terminal (clears history)"
            aria-label="Close terminal"
            style={{
              marginLeft: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--term-red)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '0 2px',
              lineHeight: 1,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── The actual terminal panel ── */}
      {isVisible && (
        <TerminalPanel
          projectId={resolvedId}
          projectName={resolvedName}
          userRole={effectiveRole}
          user={user}
        />
      )}
    </>
  )
}
