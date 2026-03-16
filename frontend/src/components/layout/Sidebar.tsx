import { Link, useNavigate } from 'react-router-dom'
import { useSession, signOut } from '@/lib/auth-client'
import { useProjects } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export default function Sidebar() {
  const { data: session } = useSession()
  const { data: projects = [] } = useProjects()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-background px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-semibold">TaskFlow</h1>
        <p className="text-xs text-muted-foreground">Project Manager</p>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Projects
        </p>
        {projects.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">No projects yet</p>
        )}
        {projects.map((project: any) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <span className="truncate">{project.name}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {project._count?.tasks ?? 0}
            </Badge>
          </Link>
        ))}
      </nav>

      <div className="border-t pt-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{session?.user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>
    </aside>
  )
}