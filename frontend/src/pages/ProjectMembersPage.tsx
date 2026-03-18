import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useSession } from '@/lib/auth-client'
import { useProject } from '@/hooks/useProject'
import { useProjectMembers, useUpdateMemberRole } from '@/hooks/useProjectMembers'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutGrid } from 'lucide-react'

export default function ProjectMembersPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: project } = useProject(projectId!)
  const { data: members = [], isLoading } = useProjectMembers(projectId!)
  const updateRole = useUpdateMemberRole(projectId!)

  const myId = session?.user?.id
  const effectiveMyRole =
    (project?.members ?? []).find((m: any) => m.userId === myId)?.role
    ?? (members ?? []).find((m: any) => m.userId === myId)?.role

  const canManageRoles = effectiveMyRole === 'MASTER_ADMIN' || effectiveMyRole === 'PROJECT_MANAGER'

  const list = useMemo(() => members ?? project?.members ?? [], [members, project?.members])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
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
            <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur">
              <div className="divide-y">
                {list.map((m: any) => {
                  const display = m.user?.name ?? m.user?.email ?? m.userId
                  const isMe = m.userId === session?.user?.id
                  return (
                    <div key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{display}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.user?.email ?? ''}</p>
                      </div>
                      {canManageRoles && !isMe ? (
                        <Select
                          value={m.role}
                          onValueChange={(role) => updateRole.mutate({ userId: m.userId, role: role as any })}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                            <SelectItem value="MASTER_ADMIN">Master Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">{m.role}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

