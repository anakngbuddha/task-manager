import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useSession } from '@/lib/auth-client'
import { useProject } from '@/hooks/useProject'
import { useProjectMembers, useRemoveProjectMember, useUpdateMemberRole } from '@/hooks/useProjectMembers'
import { cn } from '@/lib/utils'
import { useProjectContributions } from '@/hooks/useProjectContributions'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, MoreHorizontal } from 'lucide-react'
import { ContributionHeatmap } from '@/components/contributions/ContributionHeatmap'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ProjectMembersPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: project } = useProject(projectId!)
  const { data: members = [], isLoading } = useProjectMembers(projectId!)
  const { data: contributions } = useProjectContributions(projectId!, 365)
  const updateRole = useUpdateMemberRole(projectId!)
  const removeMember = useRemoveProjectMember(projectId!)
  const [activeTab, setActiveTab] = useState<'members' | 'contributions'>('members')

  const myId = session?.user?.id
  const effectiveMyRole =
    (project?.members ?? []).find((m: any) => m.userId === myId)?.role
    ?? (members ?? []).find((m: any) => m.userId === myId)?.role

  const canRemoveMembers = effectiveMyRole === 'MASTER_ADMIN'

  const list = useMemo(() => members ?? project?.members ?? [], [members, project?.members])
  const [expandedContrib, setExpandedContrib] = useState<Record<string, boolean>>(() => {
    // Start with all expanded
    const initial: Record<string, boolean> = {}
    const src = members ?? project?.members ?? []
    for (const m of src) {
      const id = m.userId ?? m.user?.id
      if (id) initial[id] = true
    }
    return initial
  })

  // When members load, ensure all are expanded
  useEffect(() => {
    setExpandedContrib((curr) => {
      const next = { ...curr }
      for (const m of list) {
        const id = m.userId ?? m.user?.id
        if (id && curr[id] === undefined) next[id] = true
      }
      return next
    })
  }, [list])

  const roleBadge = (role: string) => {
    const r = String(role ?? '').toUpperCase()
    if (r === 'MASTER_ADMIN') {
      return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">Master Admin</Badge>
    }
    if (r === 'PROJECT_MANAGER') {
      return <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-300">Project Manager</Badge>
    }
    return <Badge variant="secondary" className="text-muted-foreground">Member</Badge>
  }

  const initialsFor = (name?: string | null, email?: string | null) => {
    const n = (name ?? '').trim()
    if (n) return n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    if (email) return email[0]?.toUpperCase?.() ?? 'U'
    return 'U'
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Project</span>
                </div>
                <h2 className="mt-1 text-2xl font-semibold leading-tight">Members</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  View project members and roles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/projects/${projectId}`}>
                  <Button variant="outline" className="h-10">
                    Back to tasks
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="h-[calc(100vh-5rem)] overflow-auto px-4 py-5 sm:px-6 sm:py-6">
          {isLoading ? (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading members…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex space-x-4 border-b border-border/60 pb-2">
                <button 
                  onClick={() => setActiveTab('members')}
                  className={cn("px-4 py-2 font-medium text-sm rounded-md transition-colors", activeTab === 'members' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  Team Members
                </button>
                <button 
                  onClick={() => setActiveTab('contributions')}
                  className={cn("px-4 py-2 font-medium text-sm rounded-md transition-colors", activeTab === 'contributions' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  Contributions
                </button>
              </div>

              {/* Contributions */}
              {activeTab === 'contributions' && (
              <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
                <p className="text-sm font-medium">Team contributions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tasks completed per day (last 12 months).
                </p>

                <div className="mt-4 space-y-4">
                  {(contributions?.members ?? list).map((m: any) => {
                    const display = m.name ?? m.user?.name ?? m.email ?? m.user?.email ?? m.userId
                    const countsByDay = m.countsByDay ?? {}
                    const total = Object.values(countsByDay).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                    const expanded = !!expandedContrib[m.userId]
                    return (
                      <div key={m.userId} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{display}</div>
                            <span className="text-[0.68rem] text-muted-foreground">
                              {total} task{total !== 1 ? 's' : ''} completed
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground shrink-0"
                            onClick={() => setExpandedContrib((curr) => ({ ...curr, [m.userId]: !expanded }))}
                          >
                            {expanded ? 'Hide' : 'Show chart'}
                          </Button>
                        </div>

                        {/* Always render heatmap, even with 0 contributions */}
                        {expanded ? (
                          <ContributionHeatmap countsByDay={countsByDay} days={365} showHeader={false} cellSizePx={10} gapPx={3} />
                        ) : (
                          <div className="overflow-auto rounded-lg border border-dashed border-border/50 bg-muted/20 px-3 py-2">
                            <ContributionHeatmap countsByDay={countsByDay} days={365} showHeader={false} cellSizePx={8} gapPx={2} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )}

              {/* Members list */}
              {activeTab === 'members' && (
              <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur">
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Team Members <span className="text-muted-foreground">({list.length})</span></p>
                  </div>
                  <div className="mt-3 h-px w-full bg-border/60" />
                </div>
                <div className="divide-y">
                  {list.map((m: any) => {
                    const display = m.user?.name ?? m.user?.email ?? m.userId
                    const isMe = m.userId === session?.user?.id
                    const myRole = String(effectiveMyRole ?? '').toUpperCase()
                    const targetRole = String(m.role ?? '').toUpperCase()

                    const canEditRole =
                      !isMe &&
                      (
                        myRole === 'MASTER_ADMIN' ||
                        (myRole === 'PROJECT_MANAGER' && targetRole === 'MEMBER')
                      )

                    const showMenu = !isMe && (canEditRole || canRemoveMembers)
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initialsFor(m.user?.name, m.user?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{display}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.user?.email ?? ''}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {roleBadge(m.role)}

                          {showMenu && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {canEditRole && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      Change role
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem
                                        onSelect={() => updateRole.mutate({ userId: m.userId, role: 'MEMBER' as any })}
                                      >
                                        Member
                                      </DropdownMenuItem>
                                      {myRole === 'MASTER_ADMIN' && (
                                        <DropdownMenuItem
                                          onSelect={() => updateRole.mutate({ userId: m.userId, role: 'PROJECT_MANAGER' as any })}
                                        >
                                          Project Manager
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}

                                {canEditRole && canRemoveMembers && <DropdownMenuSeparator />}

                                {canRemoveMembers && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      if (window.confirm('Are you sure you want to remove this member?')) {
                                        removeMember.mutate(m.userId)
                                      }
                                    }}
                                    disabled={removeMember.isPending}
                                  >
                                    Remove from project
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

