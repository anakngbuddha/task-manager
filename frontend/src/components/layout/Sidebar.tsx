import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { useProjects } from '@/hooks/useProjects'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  PanelLeft,
  Settings,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function NotificationBell({
  notifData,
  markAllRead,
  markRead,
  navigate,
}: {
  notifData: any
  markAllRead: { mutateAsync: () => Promise<any> }
  markRead: { mutateAsync: (id: string) => Promise<any> }
  navigate: (to: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative shrink-0" aria-label="Notifications">
          <Bell className="size-4" />
          {(notifData?.unread ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4 text-destructive-foreground">
              {Math.min(99, notifData!.unread)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-4rem)]"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-auto">
          {(notifData?.items ?? []).length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            (notifData?.items ?? []).map((n: any) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-1"
                onSelect={async () => {
                  if (!n.readAt) await markRead.mutateAsync(n.id)
                  navigate(n.href)
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                <span className="text-[0.65rem] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await markAllRead.mutateAsync()
          }}
        >
          Mark all as read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Sidebar() {
  const { data: session } = useSession()
  const { data: projects = [] } = useProjects()
  const { data: notifData } = useNotifications(20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
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
        'relative flex h-screen shrink-0 flex-col overflow-x-hidden border-r bg-background/85 backdrop-blur',
        'transition-[width] duration-200',
        expanded ? 'w-64' : 'w-14',
      ].join(' ')}
    >
      <Button
        variant="outline"
        size="icon-sm"
        className={[
          'absolute z-30',
          expanded ? 'right-2 top-3' : 'left-1/2 top-3 -translate-x-1/2',
          'bg-background/95 shadow-sm backdrop-blur',
        ].join(' ')}
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <PanelLeft className="size-4" />
      </Button>

      <div className={['py-4', expanded ? 'px-3' : 'px-2 pt-12'].join(' ')}>
        {expanded ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FolderKanban className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">Task Manager</h1>
                <p className="truncate text-xs text-muted-foreground">Workspace</p>
              </div>
            </div>

            <NotificationBell
              notifData={notifData}
              markAllRead={markAllRead}
              markRead={markRead}
              navigate={navigate}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="size-5" />
            </div>
            <NotificationBell
              notifData={notifData}
              markAllRead={markAllRead}
              markRead={markRead}
              navigate={navigate}
            />
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 pb-3">
        {/* Dashboard (no dropdown) */}
        <Link
          to="/"
          className={[
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'dashboard' ? 'bg-accent text-foreground' : 'hover:bg-accent',
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
            'mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            location.pathname === '/activity' ? 'bg-accent text-foreground' : 'hover:bg-accent',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="size-4" />
            {expanded && <span className="font-medium">Activity</span>}
          </span>
        </Link>

        {/* Projects */}
        <button
          type="button"
          onClick={() => toggleSection('projects')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'projects' ? 'bg-accent text-foreground' : 'hover:bg-accent',
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
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet</p>
            ) : (
              projects.map((project: any) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={[
                    'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    location.pathname === `/projects/${project.id}` ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  ].join(' ')}
                >
                  <span className="truncate">{project.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[0.7rem]">
                    {project._count?.tasks ?? 0}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Members */}
        <button
          type="button"
          onClick={() => toggleSection('members')}
          className={[
            'mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'members' ? 'bg-accent text-foreground' : 'hover:bg-accent',
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
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              View members
            </Link>
            <Link
              to="/members?mode=add"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Add members
            </Link>
            <Link
              to="/members?mode=remove"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
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
            'mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            expanded ? 'justify-between' : 'justify-center',
            activeRoot === 'profile' ? 'bg-accent text-foreground' : 'hover:bg-accent',
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
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings className="size-4" />
              Settings
            </Link>
            <Link
              to="/change-password"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <KeyRound className="size-4" />
              Change password
            </Link>
          </div>
        )}
      </nav>

      {/* Profile info fixed at bottom */}
      <div className="border-t border-border/60 px-3 py-3">
        {expanded ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{session?.user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
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
              <AvatarFallback className="text-xs">
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