/**
 * ProjectTerminal — role-aware terminal wrapper injected into project pages.
 *
 * Reads the user's effective role for the current project,
 * passes it into TerminalPanel, and manages open/close state.
 *
 * Usage (in any project sub-page):
 *   <ProjectTerminal projectId={projectId} projectName={project?.name ?? ''} />
 */
import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useProject } from '@/hooks/useProject'
import { TerminalPanel } from './TerminalPanel'
import type { CommandContext } from '@/lib/vfs/commandTypes'

interface ProjectTerminalProps {
  projectId: string
  projectName?: string
  /** Optionally override — pass the already-fetched project members */
  projectMembers?: Array<{ userId: string; role: string }>
}

type EffectiveRole = CommandContext['userRole']

function deriveRole(members: Array<{ userId: string; role: string }>, userId: string): EffectiveRole {
  const member = members.find((m) => m.userId === userId)
  if (!member) return 'MEMBER'
  if (member.role === 'MASTER_ADMIN') return 'MASTER_ADMIN'
  if (member.role === 'PROJECT_MANAGER') return 'PROJECT_MANAGER'
  return 'MEMBER'
}

export default function ProjectTerminal({ projectId, projectName, projectMembers }: ProjectTerminalProps) {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()
  const { data: project } = useProject(projectId)

  const myId = session?.user?.id ?? ''
  const members = projectMembers ?? project?.members ?? []
  const effectiveRole = deriveRole(members, myId)
  const resolvedName = projectName || project?.name || 'Project'

  // Global keyboard shortcut: Ctrl+` to toggle terminal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <>
      {/* Floating toggle button — bottom-right of viewport */}
      <button
        id="terminal-toggle-btn"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Toggle Terminal (Ctrl+`)"
        aria-label="Toggle VFS Terminal"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '1.5rem',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          background: open ? 'rgba(63,185,80,0.18)' : 'rgba(13,17,23,0.92)',
          border: `1px solid ${open ? 'rgba(63,185,80,0.5)' : '#30363d'}`,
          borderRadius: '8px',
          color: open ? '#3fb950' : '#8b949e',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '12px',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: open
            ? '0 0 12px rgba(63,185,80,0.25), 0 4px 16px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '13px' }}>{'>'}_</span>
        <span>{open ? 'Hide Terminal' : 'Terminal'}</span>
        <span
          style={{
            fontSize: '10px',
            opacity: 0.5,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          Ctrl+`
        </span>
      </button>

      {/* Terminal overlay */}
      {open && (
        <TerminalPanel
          projectId={projectId}
          projectName={resolvedName}
          userRole={effectiveRole}
          onClose={handleClose}
        />
      )}
    </>
  )
}
