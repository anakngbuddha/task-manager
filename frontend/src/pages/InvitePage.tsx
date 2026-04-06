import { useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'
import { useInvite, useAcceptInvite } from '@/hooks/useInvites'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { data: invite, isLoading, isError } = useInvite(code)
  const acceptInvite = useAcceptInvite()

  const isLoggedIn = !!session

  const expiresLabel = useMemo(() => {
    if (!invite) return ''
    try {
      const d = new Date(invite.expiresAt)
      return d.toLocaleString()
    } catch {
      return ''
    }
  }, [invite])

  if (!code) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Invalid invite link.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </div>
    )
  }

  if (isError || !invite) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Card className="max-w-md border-border/60 bg-card/95 shadow-lg">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>
              This invite link is not valid anymore. Ask the project owner to generate a new invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (invite.isExpired) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Card className="max-w-md border-border/60 bg-card/95 shadow-lg">
          <CardHeader>
            <CardTitle>Invite expired</CardTitle>
            <CardDescription>
              This invite link has expired. Ask the project owner to generate a new invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
        <Card className="max-w-lg border-border/60 bg-card/95 shadow-xl">
          <CardHeader>
            <CardTitle>Join project “{invite.projectName}”</CardTitle>
            <CardDescription className="space-y-2">
              <p>
                You&apos;ve been invited to join this project, but you don&apos;t have an account yet.
              </p>
              <p>
                <span className="font-medium">Please register first</span>, then open this invite link
                again to join the project automatically.
              </p>
              {expiresLabel && (
                <p className="text-xs text-muted-foreground">
                  This invite expires on {expiresLabel}.
                </p>
              )}
            </CardDescription>
          </CardHeader>
          <div className="flex items-center justify-end gap-2 px-6 pb-5">
            <Button variant="outline" asChild>
              <Link to="/login">Already have an account? Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Create account to continue</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const handleJoin = async () => {
    if (!code) return
    const res = await acceptInvite.mutateAsync(code)
    navigate(`/projects/${res.projectId}`)
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.15),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_55%)]">
      <Card className="max-w-lg border-border/60 bg-card/95 shadow-xl">
        <CardHeader>
          <CardTitle>Project invite</CardTitle>
          <CardDescription className="space-y-2">
            <p>
              You&apos;ve been invited to join <span className="font-medium">“{invite.projectName}”</span>.
            </p>
            {expiresLabel && (
              <p className="text-xs text-muted-foreground">
                This invite expires on {expiresLabel}.
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <Button variant="outline" onClick={() => navigate('/')}>
            Not now
          </Button>
          <Button onClick={handleJoin} disabled={acceptInvite.isPending}>
            {acceptInvite.isPending ? 'Joining…' : 'Join project'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

