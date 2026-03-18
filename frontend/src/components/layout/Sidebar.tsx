import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { useProjects } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  PanelLeft,
  Settings,
  Users,
} from 'lucide-react'

export default function Sidebar() {
  const { data: session } = useSession()
  const { data: projects = [] } = useProjects()
  const navigate = useNavigate()
  const location = useLocation()

  const [expanded, setExpanded] = useState(true)
  const [openSections, setOpenSections] = useState({
    projects: true,
    members: false,
    profile: false,
  })

  useEffect(() => {
    const raw = localStorage.getItem('sidebar:expanded')
    if (raw === '0') setExpanded(false)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar:expanded', expanded ? '1' : '0')
  }, [expanded])

  const activeRoot = useMemo(() => {
    if (location.pathname.startsWith('/projects/')) return 'projects'
    if (location.pathname.startsWith('/members')) return 'members'
    if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/change-password')) return 'profile'
    if (location.pathname === '/') return 'dashboard'
    return ''
  }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((curr) => ({ ...curr, [section]: !curr[section] }))
  }

  return (
    <aside
      className={[
        'relative flex h-screen shrink-0 flex-col overflow-x-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        'transition-[width] duration-200',
        expanded ? 'w-64' : 'w-14',
      ].join(' ')}
    >
      <div className={['flex h-13 items-center', expanded ? 'px-3' : 'px-2'].join(' ')}>
        {expanded ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <div className="grid size-9 place-items-center rounded-xl bg-sidebar-accent text-sidebar-foreground">
                <FolderKanban className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">Task Manager</h1>
                <p className="truncate text-xs text-sidebar-foreground/70">Workspace</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setExpanded((v) => !v)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setExpanded(true)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
            <div className="grid size-9 place-items-center rounded-xl bg-sidebar-accent text-sidebar-foreground">
              <FolderKanban className="size-5" />
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 pb-3 pt-2">
        {/* Dashboard (no dropdown) */}
        <Link
          to="/"
          className={[
            'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'dashboard'
              ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="size-4" />
            {expanded && <span className="font-medium">Dashboard</span>}
          </span>
        </Link>

        <Link
          to="/activity"
          className={[
            'mt-1.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            location.pathname === '/activity'
              ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="size-4" />
            {expanded && <span className="font-medium">Activity</span>}
          </span>
        </Link>

        {expanded && (
          <div className="mt-4 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Projects
          </div>
        )}

        {/* Projects */}
        <button
          type="button"
          onClick={() => toggleSection('projects')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'projects'
              ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <FolderKanban className="size-4" />
            {expanded && <span className="font-medium">Projects</span>}
          </span>
          {expanded && (
            openSections.projects ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && openSections.projects && (
          <div className="mt-1 space-y-1 pl-2">
            {projects.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No projects yet</p>
            ) : (
              projects.map((project: any) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={[
                    'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    location.pathname === `/projects/${project.id}`
                      ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  ].join(' ')}
                >
                  <span className="truncate">{project.name}</span>
                  <Badge variant="secondary" className="ml-2 bg-sidebar-accent text-sidebar-foreground text-[0.7rem]">
                    {project._count?.tasks ?? 0}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        )}

        {expanded && (
          <div className="mt-4 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Team
          </div>
        )}

        {/* Members */}
        <button
          type="button"
          onClick={() => toggleSection('members')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'members'
              ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <Users className="size-4" />
            {expanded && <span className="font-medium">Members</span>}
          </span>
          {expanded && (
            openSections.members ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && openSections.members && (
          <div className="mt-1 space-y-1 pl-2">
            <Link
              to="/members?mode=view"
              className="block rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              View members
            </Link>
            <Link
              to="/members?mode=add"
              className="block rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Add members
            </Link>
            <Link
              to="/members?mode=remove"
              className="block rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Remove members
            </Link>
          </div>
        )}

        {/* Profile */}
        <button
          type="button"
          onClick={() => toggleSection('profile')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'profile'
              ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <Settings className="size-4" />
            {expanded && <span className="font-medium">Profile</span>}
          </span>
          {expanded && (
            openSections.profile ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && openSections.profile && (
          <div className="mt-1 space-y-1 pl-2">
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings className="size-4" />
              Settings
            </Link>
            <Link
              to="/change-password"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <KeyRound className="size-4" />
              Change password
            </Link>
          </div>
        )}
      </nav>

      {/* Profile info fixed at bottom */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {expanded ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
                {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{session?.user?.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/70">{session?.user?.email}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto h-8"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
                {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="destructive"
              size="icon-sm"
              className="w-full"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              ⏻
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}