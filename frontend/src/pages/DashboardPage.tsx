import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useProjects, useCreateProject } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createProject.mutateAsync(name.trim())
    setName('')
    setOpen(false)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold">Projects</h2>
            <p className="text-muted-foreground">Select a project to manage tasks</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <Input
                  placeholder="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <Button type="submit" className="w-full" disabled={createProject.isPending}>
                  {createProject.isPending ? 'Creating...' : 'Create project'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && (
          <p className="text-muted-foreground">Loading projects...</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: any) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <CardDescription>
                  {project._count?.tasks ?? 0} tasks · {project.members?.length ?? 0} members
                </CardDescription>
              </CardHeader>
            </Card>
          ))}

          {!isLoading && projects.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
              <p className="text-muted-foreground mb-4">No projects yet. Create your first one!</p>
              <Button onClick={() => setOpen(true)}>Create project</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}