import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { useProjects } from '@/hooks/useProjects'
import NotificationBell from '@/components/layout/NotificationBell'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications'
import { useMyStatus, useUpdateStatus, STATUS_CONFIG, type UserStatus } from '@/hooks/useUserStatus'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Activity as ActivityIcon,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  FolderArchive,
  LayoutGrid,
  LogOut,
  PanelLeft,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_ORDER: UserStatus[] = ['ONLINE', 'WORKING', 'BUSY', 'AWAY', 'IN_MEETING', 'OFFLINE']

export default function Sidebar() {
  const { data: session } = useSession()
  const { data: projects = [] } = useProjects()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: notifData } = useNotifications(20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const { data: myStatusInfo } = useMyStatus()
  const updateStatus = useUpdateStatus()

  const [expanded, setExpanded] = useState(true)
  const [openSections, setOpenSections] = useState({ projects: true })

  useEffect(() => {
    const raw = localStorage.getItem('sidebar:expanded')
    if (raw === '0') setExpanded(false)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar:expanded', expanded ? '1' : '0')
    document.documentElement.style.setProperty('--sidebar-width', expanded ? '18rem' : '3.5rem')
  }, [expanded])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width')
    }
  }, [])

  const activeRoot = useMemo(() => {
    if (location.pathname.startsWith('/projects/')) return 'projects'
    if (
      location.pathname.startsWith('/profile') ||
      location.pathname.startsWith('/settings') ||
      location.pathname.startsWith('/change-password')
    )
      return 'profile'
    if (location.pathname === '/calendar') return 'calendar'
    if (location.pathname === '/dashboard') return 'dashboard'
    if (location.pathname.startsWith('/admin')) return 'admin'
    return ''
  }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((curr) => ({ ...curr, [section]: !curr[section] }))
  }

  const currentStatus: UserStatus = (myStatusInfo?.status as UserStatus) ?? 'ONLINE'
  const statusCfg = STATUS_CONFIG[currentStatus]
  const userInitial = session?.user?.name?.charAt(0).toUpperCase() ?? 'U'

  const isAdmin = (session?.user as any)?.role === 'admin'

  const StatusAvatar = ({
    sizeCls = 'h-7 w-7',
    dotSizeCls = 'size-2.5',
  }: {
    sizeCls?: string
    dotSizeCls?: string
  }) => (
    <div className="relative shrink-0">
      <Avatar className={sizeCls}>
        <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
          {userInitial}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-sidebar',
          dotSizeCls,
          statusCfg.dotClass
        )}
        title={statusCfg.label}
      />
    </div>
  )

  const StatusDropdown = ({ side = 'top' as 'top' | 'right' | 'bottom' | 'left' }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-full outline-none ring-2 ring-transparent hover:ring-sidebar-accent/70 transition-all focus-visible:ring-sidebar-accent"
          title={`${statusCfg.label} — click to change`}
        >
          <StatusAvatar />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-52">
        <DropdownMenuLabel className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Set your status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s]
          const isActive = s === currentStatus
          return (
            <DropdownMenuItem
              key={s}
              className={cn('flex items-center gap-2.5 cursor-pointer', isActive && 'font-medium')}
              onSelect={() => updateStatus.mutate(s)}
            >
              <span className={cn('shrink-0 size-2.5 rounded-full', cfg.dotClass)} />
              {cfg.label}
              {isActive && (
                <span className="ml-auto text-[0.65rem] text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Shared nav-item style helper
  const navItemCls = (active: boolean, isExpanded: boolean) =>
    cn(
      'flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors',
      isExpanded ? 'gap-2.5 justify-start' : 'justify-center',
      active
        ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    )

  return (
    <aside
      className={cn(
        'relative flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        'transition-[width] duration-200',
        expanded ? 'w-72' : 'w-14'
      )}
    >
      {/* ── Header ── */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border/50 px-2 gap-1">
        {expanded ? (
          <>
            {/* Brand */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
              <img src="/logo.png" alt="Logo" className="size-8 shrink-0 object-contain drop-shadow" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold leading-tight">We Work IT</h1>
                <p className="truncate text-[0.7rem] text-sidebar-foreground/60">Workspace</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              <NotificationBell
                notifData={notifData}
                markAllRead={{ mutateAsync: () => markAllRead.mutateAsync() }}
                markRead={{ mutateAsync: (id: string) => markRead.mutateAsync(id) }}
                onNavigate={(to) => navigate(to)}
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => setExpanded(false)}
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          /* Collapsed — single centered toggle */
          <Button
            variant="ghost"
            size="icon-sm"
            className="mx-auto text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => setExpanded(true)}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="size-4 rotate-180" />
          </Button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-3 space-y-0.5">
        {/* Dashboard */}
        <Link
          to="/dashboard"
          title={!expanded ? 'Dashboard' : undefined}
          className={navItemCls(activeRoot === 'dashboard', expanded)}
        >
          <LayoutGrid className="size-4 shrink-0" />
          {expanded && <span className="font-medium">Dashboard</span>}
        </Link>

        {/* Activity */}
        <Link
          to="/activity"
          title={!expanded ? 'Activity' : undefined}
          className={navItemCls(location.pathname === '/activity', expanded)}
        >
          <ActivityIcon className="size-4 shrink-0" />
          {expanded && <span className="font-medium">Activity</span>}
        </Link>



        {/* ── Projects ── */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => {
              if (!expanded) {
                setExpanded(true)
                return
              }
              toggleSection('projects')
            }}
            title={!expanded ? 'Projects' : undefined}
            className={navItemCls(activeRoot === 'projects', expanded)}
          >
            <FolderKanban className="size-4 shrink-0" />
            {expanded && (
              <>
                <span className="font-medium flex-1 text-left">Projects</span>
                {openSections.projects ? (
                  <ChevronDown className="size-3.5 text-sidebar-foreground/50" />
                ) : (
                  <ChevronRight className="size-3.5 text-sidebar-foreground/50" />
                )}
              </>
            )}
          </button>

          {expanded && openSections.projects && (
            <div className="mt-1 ml-2 space-y-0.5 border-l border-sidebar-border/50 pl-3">
              <p className="px-2 pt-1 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                Archive
              </p>
              <Link
                to="/projects/archive"
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  location.pathname === '/projects/archive'
                    ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <FolderArchive className="size-3.5" />
                  Archived
                </span>
              </Link>
              <div className="my-1.5 h-px bg-sidebar-border/50" />
              <p className="px-2 pt-0.5 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                Projects
              </p>
              {projects.length === 0 ? (
                <p className="py-1.5 text-xs text-sidebar-foreground/50">No projects yet</p>
              ) : (
                projects.map((project: any) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      location.pathname === `/projects/${project.id}`
                        ? 'bg-primary/15 text-sidebar-foreground ring-1 ring-primary/25'
                        : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <span className="truncate">{project.name}</span>
                    <Badge
                      variant="secondary"
                      className="shrink-0 ml-1 bg-sidebar-accent/80 text-sidebar-foreground/70 text-[0.65rem] px-1.5 py-0"
                    >
                      {project._count?.tasks ?? 0}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <Link
          to="/calendar"
          title={!expanded ? 'Calendar' : undefined}
          className={navItemCls(activeRoot === 'calendar', expanded)}
        >
          <CalendarDays className="size-4 shrink-0" />
          {expanded && <span className="font-medium">Calendar</span>}
        </Link>

        {/* Profile */}
        <div className="pt-1">
          <Link
            to={isAdmin ? '/admin/dashboard' : '/profile'}
            title={!expanded ? (isAdmin ? 'Admin dashboard' : 'Profile & Settings') : undefined}
            className={navItemCls(isAdmin ? activeRoot === 'admin' : activeRoot === 'profile', expanded)}
          >
            <Settings className="size-4 shrink-0" />
            {expanded && <span className="font-medium">{isAdmin ? 'Admin dashboard' : 'Profile'}</span>}
          </Link>
        </div>

        {/* Admin System */}
        {(session?.user as any)?.role === 'admin' && (
          <div className="pt-1 space-y-1">
            <Link
              to="/admin/dashboard"
              title={!expanded ? 'Admin Dashboard' : undefined}
              className={navItemCls(activeRoot === 'admin', expanded)}
            >
              <ShieldAlert className="size-4 shrink-0" />
              {expanded && <span className="font-medium">Admin System</span>}
            </Link>

            <Link
              to="/admin/audit-logs"
              title={!expanded ? 'Audit Logs' : undefined}
              className={navItemCls(location.pathname === '/admin/audit-logs', expanded)}
            >
              <ShieldAlert className="size-4 shrink-0" />
              {expanded && <span className="font-medium">Audit Logs</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* ── Footer: user + sign out ── */}
      <div className="border-t border-sidebar-border px-2 py-2.5">
        {expanded ? (
          <div className="flex items-center gap-2.5 px-1">
            <StatusDropdown side="top" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{session?.user?.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60 mt-0.5">
                {statusCfg.label}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <StatusDropdown side="right" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}