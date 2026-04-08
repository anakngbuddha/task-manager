import { useEffect, useRef, useState, useCallback } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { useSession } from '@/lib/auth-client'
import { ContributionHeatmap } from '@/components/contributions/ContributionHeatmap'
import { useMyContributions } from '@/hooks/useMyContributions'
import {
  useGithubConnect,
  useGithubInstallation,
  useDisconnectGithub,
  useLinkGithubInstallation,
  useGithubPendingInstallation,
} from '@/hooks/useGithub'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { GitBranch, Unplug, Loader2, Link2, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: contrib } = useMyContributions(365)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const { data: connectData, refetch: refetchConnectUrl } = useGithubConnect()
  const {
    data: installation,
    isLoading: installLoading,
    isError: installError,
    refetch: refetchInstallation,
  } = useGithubInstallation()
  const disconnect = useDisconnectGithub()
  const linkInstallation = useLinkGithubInstallation()

  const isConnected = !!installation && !installError

  const githubConnectedFlag = searchParams.get('github_connected')
  const githubInstallationIdParam = searchParams.get('github_installation_id')
  const githubError = searchParams.get('github_error')

  const [manualId, setManualId] = useState('')
  const [manualError, setManualError] = useState('')
  const autoLinkingRef = useRef(false)
  const [polling, setPolling] = useState(false)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [justDisconnected, setJustDisconnected] = useState(false)

  // Clean up URL params after reading them
  useEffect(() => {
    if (githubConnectedFlag || githubError) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('github_connected')
      newParams.delete('github_error')
      setSearchParams(newParams, { replace: true })
      if (githubConnectedFlag) {
        refetchInstallation()
      }
    }
  }, [githubConnectedFlag, githubError, searchParams, setSearchParams, refetchInstallation])

  // Re-check installation when user switches back to this tab
  useEffect(() => {
    const onFocus = () => { refetchInstallation() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetchInstallation])

  // Auto-link when redirected from GitHub callback with installation_id.
  // Wait for githubProjectId to be available before attempting.
  useEffect(() => {
    if (!githubInstallationIdParam || autoLinkingRef.current) return

    const instId = parseInt(githubInstallationIdParam, 10)
    if (Number.isNaN(instId)) return

    autoLinkingRef.current = true

    // Clear the URL param immediately so navigation doesn't re-trigger
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('github_installation_id')
    setSearchParams(newParams, { replace: true })

    linkInstallation
      .mutateAsync({ projectId: 'profile', installationId: instId })
      .then(() => {
        setPolling(false)
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
        refetchInstallation()
      })
      .catch((err) => {
        setManualId(String(instId))
        const msg = err?.response?.data?.error || 'Auto-link failed. You can try linking manually below.'
        setManualError(msg)
      })
      .finally(() => { autoLinkingRef.current = false })
  }, [githubInstallationIdParam, linkInstallation, refetchInstallation, searchParams, setSearchParams])

  // Poll for pending installation (from webhook) while polling === true
  const { data: pendingInstall } = useGithubPendingInstallation(polling && !isConnected)

  // Auto-claim the pending installation when found via polling
  useEffect(() => {
    if (!pendingInstall || autoLinkingRef.current) return
    autoLinkingRef.current = true
    linkInstallation
      .mutateAsync({ projectId: 'profile', installationId: pendingInstall.installationId })
      .then(() => {
        setPolling(false)
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
        refetchInstallation()
      })
      .catch(() => {
        setManualId(String(pendingInstall.installationId))
        setManualError('Auto-link failed. The Installation ID has been filled in below — click Link.')
      })
      .finally(() => { autoLinkingRef.current = false })
  }, [pendingInstall, linkInstallation, refetchInstallation])

  // Cleanup poll timeout on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    }
  }, [])

  const handleConnect = useCallback(() => {
    if (!connectData?.url) return
    setJustDisconnected(false)
    setManualError('')
    refetchConnectUrl()
    window.open(connectData.url, '_blank', 'noopener,noreferrer')
    setPolling(true)
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    pollTimeoutRef.current = setTimeout(() => {
      setPolling(false)
      setManualError('Auto-detection timed out. Please paste your GitHub Installation ID below.')
    }, 90_000)
  }, [connectData?.url, refetchConnectUrl])

  const handleDisconnect = async () => {
    await disconnect.mutateAsync()
    setJustDisconnected(true)
    setManualError('')
    setManualId('')
    // Force clear all cached github state so the UI resets to "not connected"
    queryClient.removeQueries({ queryKey: ['github-installation'] })
    queryClient.removeQueries({ queryKey: ['github-repos'] })
    queryClient.removeQueries({ queryKey: ['github-pending-installation'] })
  }

  const handleManualLink = async () => {
    setManualError('')
    const parsed = parseInt(manualId.trim(), 10)
    if (!parsed || Number.isNaN(parsed)) {
      setManualError('Please enter a valid numeric Installation ID.')
      return
    }
    try {
      await linkInstallation.mutateAsync({ projectId: 'profile', installationId: parsed })
      setManualId('')
      setJustDisconnected(false)
      refetchInstallation()
    } catch (err: any) {
      setManualError(err?.response?.data?.error || err?.message || 'Failed to link installation.')
    }
  }

  return (
    <div className="flex h-dvh">
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
              ) : isConnected && !justDisconnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
                      Connected
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      Installation ID: {installation.installationId}
                    </span>
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
                      Disconnect GitHub account
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Disconnecting will remove this bound GitHub account from your profile.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {justDisconnected && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm text-amber-700 font-medium">GitHub disconnected</p>
                      <p className="mt-1 text-xs text-amber-600">
                        You can reconnect by clicking the button below. If the app is already installed
                        on your GitHub account, it will be detected automatically.
                      </p>
                    </div>
                  )}

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
                        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                          If you are installing for the first time, GitHub will redirect you back automatically.
                        </p>

                        <div className="mt-4 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-left max-w-sm mx-auto">
                          <p className="text-xs text-amber-700/90 dark:text-amber-500/90 font-medium">App already installed?</p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            GitHub doesn't redirect back if the app is already installed on your account.
                            If you are stuck on the GitHub settings page, simply copy the Installation ID from the GitHub URL (e.g., <code>installations/120269033</code>) and paste it into the <strong>Manual link</strong> box below.
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          className="mt-4 h-9 rounded-none"
                          onClick={() => { setPolling(false); if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current) }}
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
                          disabled={!connectData?.url}
                          onClick={handleConnect}
                        >
                          <span className="inline-flex items-center gap-2">
                            {justDisconnected ? (
                              <>
                                <RefreshCw className="size-4" />
                                Reconnect GitHub App
                              </>
                            ) : (
                              'Install GitHub App'
                            )}
                          </span>
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Opens GitHub in a new tab. We'll auto-detect when you finish.
                        </p>
                      </>
                    )}
                  </div>

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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleManualLink()
                            }
                          }}
                        />
                      </div>
                      <Button
                        className="h-9 gap-2 rounded-none"
                        onClick={handleManualLink}
                        disabled={!manualId.trim() || linkInstallation.isPending}
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
