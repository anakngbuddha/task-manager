import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject, useUpdateProject } from '@/hooks/useProject'
import {
  useGithubInstallation,
  useGithubRepos,
} from '@/hooks/useGithub'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  GitBranch,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Lock,
  Globe,
} from 'lucide-react'

export default function ProjectSettingsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const {
    data: installation,
    isLoading: installLoading,
    isError: installError,
  } = useGithubInstallation(projectId!)
  const { data: reposData, isLoading: reposLoading } = useGithubRepos(
    projectId!,
    !!installation,
  )
  const updateProject = useUpdateProject()
  const [boardColumns, setBoardColumns] = useState<string[]>([])
  const [newColumn, setNewColumn] = useState('')
  const [isEditingColumns, setIsEditingColumns] = useState(false)

  useEffect(() => {
    if (project?.boardColumns) {
      setBoardColumns(project.boardColumns)
    } else {
      setBoardColumns(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY'])
    }
  }, [project])

  const isConnected = !!installation && !installError

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <PageHeader
          breadcrumb={
            <span className="text-muted-foreground">
              Projects / {project?.name ?? 'Project'} / Settings
            </span>
          }
          title="Project Settings"
          subtitle="Manage integrations and project configuration."
          actions={
            <Button variant="outline" className="h-9 gap-2" asChild>
              <Link to={`/projects/${projectId}`}>
                <ArrowLeft className="size-4" />
                Back to Board
              </Link>
            </Button>
          }
        />

        <div className="h-[calc(100vh-5rem)] overflow-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 sm:px-8">
            {/* GitHub Integration Card */}
            <div className="overflow-hidden border border-border/60 bg-card">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-[oklch(0.15_0.02_250)]">
                    <svg
                      viewBox="0 0 16 16"
                      className="size-5 fill-white"
                      aria-hidden="true"
                    >
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      GitHub Integration
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Connect a GitHub App to sync PRs with tasks
                    </p>
                  </div>
                </div>
                {isConnected ? (
                  <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
                    <CheckCircle2 className="size-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <AlertCircle className="size-3" />
                    Not connected
                  </Badge>
                )}
              </div>

              {/* Card Body */}
              <div className="px-6 py-5">
                {installLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">
                      Checking GitHub connection…
                    </span>
                  </div>
                ) : isConnected ? (
                  /* ── Connected state ─────────────────────────── */
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                      <GitBranch className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Installation ID</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {installation.installationId}
                        </p>
                      </div>
                    </div>

                    {/* Repos */}
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Repositories
                      </p>
                      {reposLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground py-3">
                          <Loader2 className="size-3.5 animate-spin" />
                          <span className="text-sm">
                            Loading repositories…
                          </span>
                        </div>
                      ) : reposData?.repositories?.length ? (
                        <div className="space-y-1.5">
                          {reposData.repositories.map((repo) => (
                            <a
                              key={repo.repoId}
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40 group"
                            >
                              {repo.private ? (
                                <Lock className="size-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <Globe className="size-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="flex-1 truncate font-medium">
                                {repo.fullName}
                              </span>
                              <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No repositories found for this installation.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border/40 pt-4">
                      <p className="text-xs text-muted-foreground">
                        Manage your GitHub connection from <span className="font-medium text-foreground">Profile</span>.
                      </p>
                      <div className="mt-3">
                        <Button asChild variant="outline" size="sm" className="h-8 rounded-none">
                          <Link to="/profile">Go to Profile</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Not connected state ────────────────────── */
                  <div className="space-y-5">
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-5 py-8 text-center">
                      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/60">
                        <GitBranch className="size-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">
                        No GitHub App connected
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                        Install the GitHub App to automatically sync pull
                        request events with your tasks.
                      </p>
                      <div className="mt-4 flex justify-center">
                        <Button asChild className="h-9 gap-2 rounded-none" size="sm">
                          <Link to="/profile">Connect in Profile</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Board Columns Card */}
            <div className="overflow-hidden border border-border/60 bg-card mt-6">
              <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Board Columns</h3>
                  <p className="text-xs text-muted-foreground">Customize the task statuses available for this project</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="space-y-4">
                  {boardColumns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                       <Input 
                         value={col} 
                         disabled={!isEditingColumns}
                         onChange={(e) => {
                           const newCols = [...boardColumns]
                           newCols[idx] = e.target.value.toUpperCase().replace(/\s+/g, '_')
                           setBoardColumns(newCols)
                         }}
                         className="h-9 font-mono text-sm"
                       />
                       {isEditingColumns && (
                         <Button variant="ghost" size="icon-sm" className="text-destructive shrink-0" onClick={() => {
                           setBoardColumns(boardColumns.filter((_, i) => i !== idx))
                         }}>
                           <X className="size-4" />
                         </Button>
                       )}
                    </div>
                  ))}
                  {isEditingColumns && (
                    <div className="flex items-center gap-2 pt-2">
                      <Input 
                        placeholder="Add new column (e.g. QA_TESTING)" 
                        value={newColumn}
                        onChange={(e) => setNewColumn(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                        className="h-9 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newColumn.trim()) {
                            e.preventDefault()
                            if (!boardColumns.includes(newColumn.trim())) {
                              setBoardColumns([...boardColumns, newColumn.trim()])
                              setNewColumn('')
                            }
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={!newColumn.trim() || boardColumns.includes(newColumn.trim())}
                        onClick={() => {
                          setBoardColumns([...boardColumns, newColumn.trim()])
                          setNewColumn('')
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  
                  <div className="pt-4 flex justify-end gap-2 border-t border-border/40">
                    {isEditingColumns ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => {
                          setIsEditingColumns(false)
                          setBoardColumns(project?.boardColumns || ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY'])
                          setNewColumn('')
                        }}>Cancel</Button>
                        <Button size="sm" onClick={async () => {
                          await updateProject.mutateAsync({ id: projectId!, data: { boardColumns } })
                          setIsEditingColumns(false)
                          setNewColumn('')
                        }} disabled={updateProject.isPending || boardColumns.length === 0}>
                          {updateProject.isPending ? 'Saving...' : 'Save Columns'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setIsEditingColumns(true)}>
                        Edit Columns
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
