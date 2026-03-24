import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

const STORAGE_KEY = 'github_installation_id'

export default function GitHubCallbackPage() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id') || searchParams.get('github_installation_id')
  const error = searchParams.get('github_error')

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        window.location.href = '/profile'
      }, 3000)
      return () => clearTimeout(timer)
    }

    if (installationId) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          installationId,
          timestamp: Date.now(),
        }))
      } catch {
        // localStorage unavailable — fall through to manual
      }

      // Give the storage event time to fire in the opener tab, then close or redirect
      const timer = setTimeout(() => {
        if (window.opener) {
          window.close()
        } else {
          window.location.href = `/profile?github_installation_id=${installationId}`
        }
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [installationId, error])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-destructive">GitHub connection failed</p>
          <p className="text-xs text-muted-foreground">
            {error === 'missing_id' ? 'No installation ID was provided by GitHub.' : `Error: ${error}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Redirecting to profile…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Linking GitHub installation…</p>
        <p className="text-xs text-muted-foreground">
          This window will close automatically.
        </p>
      </div>
    </div>
  )
}
