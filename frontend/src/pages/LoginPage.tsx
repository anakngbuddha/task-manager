import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { signIn } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'

export default function LoginPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email), [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn.email({ email, password })
      if (result?.error) {
        setError(result.error.message ?? 'Login failed')
        setLoading(false)
        return
      }
      // Force hard redirect to ensure session is picked up
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await signIn.social({
      provider: 'google',
      // after successful Google sign-in, go back to the frontend app
      callbackURL: `${window.location.origin}/`,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-[oklch(0.18_0.04_250)] lg:block">
          <div className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(900px_circle_at_20%_20%,oklch(0.64_0.12_192)_0%,transparent_55%),radial-gradient(800px_circle_at_80%_30%,oklch(0.64_0.12_192/.25)_0%,transparent_60%),linear-gradient(180deg,oklch(0.18_0.04_250)_0%,oklch(0.22_0.04_250)_100%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-[oklch(0.99_0_0)]">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[oklch(0.64_0.12_192)] text-[oklch(0.99_0_0)] shadow-sm">
                <KeyRound className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium tracking-wide">Task Manager</p>
                <p className="text-xs text-[oklch(0.85_0.02_245)]">Plan. Build. Ship.</p>
              </div>
            </div>

            <div className="max-w-md">
              <h1 className="text-3xl font-semibold leading-tight">
                Welcome back.
                <span className="block text-[oklch(0.85_0.02_245)]">Let’s pick up where you left off.</span>
              </h1>
              <p className="mt-4 text-sm text-[oklch(0.85_0.02_245)]">
                Sign in to see your projects, track progress, and keep tasks moving.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="h-2 w-24 rounded-full bg-[oklch(1_0_0)]/90" />
              <div className="h-2 w-16 rounded-full bg-[oklch(0.64_0.12_192)]" />
              <div className="h-2 w-10 rounded-full bg-[oklch(1_0_0)]/20" />
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <Card className="border-border/60 bg-card/95 shadow-[0_20px_70px_-35px_rgba(0,0,0,.35)] backdrop-blur">
              <CardHeader className="gap-2">
                <CardTitle className="text-2xl">Sign in</CardTitle>
                <CardDescription>Use your email and password to continue.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="h-10 pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={email.length > 3 && !isValidEmail}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-10 pl-10 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="h-10 w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </form>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button variant="outline" className="h-10 w-full" onClick={handleGoogle}>
                  Continue with Google
                </Button>
              </CardContent>
              <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/register" className="font-medium text-primary hover:underline">
                    Sign up
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}