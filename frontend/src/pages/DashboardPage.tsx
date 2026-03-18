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
import { FolderPlus, LayoutGrid, Plus, Sparkles } from 'lucide-react'

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
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Dashboard</span>
                </div>
                <h2 className="mt-1 text-2xl font-semibold leading-tight">Projects</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a project, then manage tasks with a simple kanban flow.
                </p>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 gap-2">
                    <Plus className="size-4" />
                    New project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a new project</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4 pt-2">
                    <div className="relative">
                      <FolderPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Project name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-10 pl-10"
                        autoFocus
                      />
                    </div>
                    <Button type="submit" className="h-10 w-full" disabled={createProject.isPending}>
                      {createProject.isPending ? 'Creating...' : 'Create project'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <section className="px-6 py-7 sm:px-8">
          {isLoading && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Loading projects…
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: any) => (
              <Card
                key={project.id}
                className="cursor-pointer border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_14px_50px_-35px_rgba(0,0,0,.35)]"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader className="gap-2">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{project.name}</CardTitle>
                      <CardDescription>
                        {project._count?.tasks ?? 0} tasks · {project.members?.length ?? 0} members
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {!isLoading && projects.length === 0 && (
              <div className="col-span-full rounded-2xl border border-border/60 bg-card p-8 sm:p-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 text-primary">
                      <FolderPlus className="size-5" />
                      <p className="text-sm font-medium">Start here</p>
                    </div>
                    <h3 className="mt-2 text-xl font-semibold">Create your first project</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Projects group tasks, members, and deadlines. You can add more later—this is the fastest way to get moving.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="h-10 gap-2" onClick={() => setOpen(true)}>
                      <Plus className="size-4" />
                      Create project
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}