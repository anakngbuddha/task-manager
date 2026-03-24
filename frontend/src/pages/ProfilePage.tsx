import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { useSession } from '@/lib/auth-client'
import { ContributionHeatmap } from '@/components/contributions/ContributionHeatmap'
import { useMyContributions } from '@/hooks/useMyContributions'
import { useProjects } from '@/hooks/useProjects'
import {
  useGithubConnect,
  useGithubInstallation,
  useGithubRepos,
  useDisconnectGithub,
  useLinkGithubInstallation,
  useGithubPendingInstallation,
} from '@/hooks/useGithub'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { GitBranch, Unplug, Loader2, Lock, Globe, ExternalLink, Link2 } from 'lucide-react'

const GITHUB_STORAGE_KEY = 'github_installation_id'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: contrib } = useMyContributions(365)
  const { data: projects = [] } = useProjects()
  const githubProjectId = projects[0]?.id
  const [searchParams] = useSearchParams()

  const { data: connectData } = useGithubConnect()
  const {
    data: installation,
    isLoading: installLoading,
    isError: installError,
    refetch: refetchInstallation,
  } = useGithubInstallation(githubProjectId)

  const { data: reposData, isLoading: reposLoading } = useGithubRepos(githubProjectId, !!installation)
  const disconnect = useDisconnectGithub()
  const linkInstallation = useLinkGithubInstallation()

  const isConnected = !!installation && !installError

  const githubConnectedFlag = searchParams.get('github_connected')
  const githubInstallationIdParam = searchParams.get('github_installation_id')

  const [manualId, setManualId] = useState('')
  const [manualError, setManualError] = useState('')
  const [autoLinking, setAutoLinking] = useState(false)
  const [polling, setPolling] = useState(false)
  const [pollTimeoutId, setPollTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null)

  const doAutoLink = async (installationId: number) => {
    if (!githubProjectId || autoLinking) return
    setAutoLinking(true)
    try {
      await linkInstallation.mutateAsync({ projectId: githubProjectId, installationId })
      setPolling(false)
      if (pollTimeoutId) clearTimeout(pollTimeoutId)
      refetchInstallation()
      setManualError('')
      const url = new URL(window.location.href)
      url.searchParams.delete('github_installation_id')
      window.history.replaceState({}, '', url.pathname + (url.search || ''))
    } catch {
      setManualId(String(installationId))
      setManualError('Auto-link failed. You can try linking manually below.')
    } finally {
      setAutoLinking(false)
      try { localStorage.removeItem(GITHUB_STORAGE_KEY) } catch {}
    }
  }

  useEffect(() => {
    if (!githubConnectedFlag) return
    refetchInstallation()
  }, [githubConnectedFlag, refetchInstallation])

  useEffect(() => {
    const onFocus = () => { refetchInstallation() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetchInstallation])

  // Path 1: Auto-link from URL query param (direct redirect to this page)
  useEffect(() => {
    if (!githubInstallationIdParam || !githubProjectId || autoLinking) return
    const instId = parseInt(githubInstallationIdParam, 10)
    if (Number.isNaN(instId)) return
    doAutoLink(instId)
  }, [githubInstallationIdParam, githubProjectId])

  // Path 2: Cross-tab communication via localStorage
  // When the GitHub callback page (opened in a new tab) writes the installation ID
  // to localStorage, this tab picks it up via the 'storage' event.
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key !== GITHUB_STORAGE_KEY || !e.newValue) return
      try {
        const { installationId } = JSON.parse(e.newValue)
        const instId = parseInt(installationId, 10)
        if (!Number.isNaN(instId)) {
          doAutoLink(instId)
        }
      } catch {}
    }

    window.addEventListener('storage', handleStorageEvent)
    return () => window.removeEventListener('storage', handleStorageEvent)
  }, [githubProjectId, autoLinking])

  // Path 2b: Check localStorage on mount/focus in case the storage event was missed
  useEffect(() => {
    const checkLocalStorage = () => {
      try {
        const raw = localStorage.getItem(GITHUB_STORAGE_KEY)
        if (!raw) return
        const { installationId, timestamp } = JSON.parse(raw)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          localStorage.removeItem(GITHUB_STORAGE_KEY)
          return
        }
        const instId = parseInt(installationId, 10)
        if (!Number.isNaN(instId) && !isConnected) {
          doAutoLink(instId)
        }
      } catch {}
    }

    checkLocalStorage()

    const onFocus = () => checkLocalStorage()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [githubProjectId, isConnected, autoLinking])

  // Path 3: Webhook polling fallback
  const { data: pendingInstall } = useGithubPendingInstallation(polling && !isConnected)

  useEffect(() => {
    if (!pendingInstall || !githubProjectId || autoLinking) return
    doAutoLink(pendingInstall.installationId)
  }, [pendingInstall, githubProjectId])

  const handleConnect = () => {
    if (!connectData?.url) return
    window.open(connectData.url, '_blank', 'noreferrer')
    setPolling(true)
    setManualError('')
    const tid = setTimeout(() => {
      setPolling(false)
      setManualError('Auto-detection timed out. Please paste your GitHub Installation ID below.')
    }, 90_000)
    setPollTimeoutId(tid)
  }

  const handleDisconnect = async () => {
    if (!githubProjectId) return
    await disconnect.mutateAsync(githubProjectId)
  }

  const handleManualLink = async () => {
    setManualError('')
    const parsed = parseInt(manualId.trim(), 10)
    if (!parsed || Number.isNaN(parsed)) {
      setManualError('Please enter a valid numeric Installation ID.')
      return
    }
    if (!githubProjectId) {
      setManualError('Create a project first.')
      return
    }
    try {
      await linkInstallation.mutateAsync({ projectId: githubProjectId, installationId: parsed })
      setManualId('')
      refetchInstallation()
    } catch (err: any) {
      setManualError(err?.response?.data?.error || err?.message || 'Failed to link installation.')
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold leading-tight">Profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account details and activity.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/settings">
                  <Button variant="outline" className="h-10">Settings</Button>
                </Link>
                <Link to="/change-password">
                  <Button variant="outline" className="h-10">Change password</Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-4">
          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
            <p className="text-sm font-medium">Account</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{session?.user?.name ?? '—'}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{session?.user?.email ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
            <p className="text-sm font-medium">Contributions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tasks completed per day (last 12 months).
            </p>
            <div className="mt-4">
              <ContributionHeatmap countsByDay={contrib?.countsByDay ?? {}} days={365} />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4">
            <p className="text-sm font-medium">GitHub Integration</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect your GitHub App to automatically update tasks from pull requests.
            </p>

            <div className="mt-4">
              {installLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Checking GitHub connection…</span>
                </div>
              ) : isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
                      Connected
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      Installation ID: {installation.installationId}
                    </span>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Repositories
                    </p>
                    {reposLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-3">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Loading repositories…</span>
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
                            <span className="flex-1 truncate font-medium">{repo.fullName}</span>
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

                  <div className="pt-2 border-t border-border/40">
                    <Button
                      variant="destructive"
                      className="h-9 gap-2 rounded-none"
                      onClick={handleDisconnect}
                      disabled={disconnect.isPending}
                    >
                      {disconnect.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Unplug className="size-4" />
                      )}
                      Disconnect GitHub (all projects)
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Disconnecting will stop GitHub → task syncing everywhere.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 1 – Install button */}
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-5 py-6 text-center">
                    <div className={`mx-auto mb-3 grid size-12 place-items-center rounded-full ${polling ? 'bg-blue-500/15' : 'bg-muted/60'}`}>
                      {polling ? (
                        <Loader2 className="size-5 text-blue-500 animate-spin" />
                      ) : (
                        <GitBranch className="size-5 text-muted-foreground" />
                      )}
                    </div>

                    {polling ? (
                      <>
                        <p className="text-sm font-medium">Waiting for GitHub…</p>
                        <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                          Finish the installation on GitHub, then come back here. We'll detect it automatically.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4 h-9 rounded-none"
                          onClick={() => { setPolling(false); if (pollTimeoutId) clearTimeout(pollTimeoutId) }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">No GitHub App connected</p>
                        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                          Install the GitHub App to automatically sync pull request events with your tasks across projects.
                        </p>
                        <Button
                          className="mt-4 h-9 gap-2 rounded-none"
                          disabled={!connectData?.url || projects.length === 0}
                          onClick={handleConnect}
                        >
                          <span className="inline-flex items-center gap-2">
                            Install GitHub App
                          </span>
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Opens GitHub in a new tab. We'll auto-detect when you finish.
                        </p>
                        {projects.length === 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Create a project first to connect GitHub.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Step 2 – Manual fallback */}
                  <div className="rounded-lg border border-border/60 bg-muted/10 px-5 py-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Manual link</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      If auto-detect doesn't work, paste the{' '}
                      <span className="font-medium text-foreground">Installation ID</span> here.
                      Find it in{' '}
                      <a
                        href="https://github.com/settings/installations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        GitHub → Settings → Applications → Installed GitHub Apps → Configure
                      </a>{' '}
                      — the number at the end of the URL.
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Installation ID</Label>
                        <Input
                          value={manualId}
                          onChange={(e) => setManualId(e.target.value)}
                          placeholder="e.g. 12345678"
                          className="h-9 font-mono"
                        />
                      </div>
                      <Button
                        className="h-9 gap-2 rounded-none"
                        onClick={handleManualLink}
                        disabled={!manualId.trim() || linkInstallation.isPending || projects.length === 0}
                      >
                        {linkInstallation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                        Link
                      </Button>
                    </div>
                    {manualError && (
                      <p className="mt-2 text-xs text-destructive">{manualError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

