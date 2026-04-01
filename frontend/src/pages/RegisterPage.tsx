import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { signUp } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Eye, EyeOff, Mail, UserRound } from 'lucide-react'

export default function RegisterPage() {
 
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email), [email])
  const isPasswordValid = useMemo(() => {
    return password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter, and a number.')
      setLoading(false)
      return
    }
  
    try {
      const result = await signUp.email({ name, email, password })
      if (result?.error) {
        setError(result.error.message ?? 'Registration failed')
        setLoading(false)
        return
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-[oklch(0.18_0.04_250)] lg:block">
          <div className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(900px_circle_at_80%_25%,oklch(0.64_0.12_192)_0%,transparent_55%),radial-gradient(700px_circle_at_25%_75%,oklch(0.64_0.12_192/.25)_0%,transparent_60%),linear-gradient(180deg,oklch(0.18_0.04_250)_0%,oklch(0.22_0.04_250)_100%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-[oklch(0.99_0_0)]">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[oklch(0.64_0.12_192)] text-[oklch(0.99_0_0)] shadow-sm">
                <UserRound className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium tracking-wide">Task Manager</p>
                <p className="text-xs text-[oklch(0.85_0.02_245)]">Your work, organized.</p>
              </div>
            </div>

            <div className="max-w-md">
              <h1 className="text-3xl font-semibold leading-tight">
                Create your account.
                <span className="block text-[oklch(0.85_0.02_245)]">Be up and running in a minute.</span>
              </h1>
              <p className="mt-4 text-sm text-[oklch(0.85_0.02_245)]">
                Start with one project, invite teammates later, and keep momentum with a simple kanban flow.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 rounded-xl bg-[oklch(1_0_0)]/95" />
              <div className="h-10 rounded-xl bg-[oklch(0.64_0.12_192)]" />
              <div className="h-10 rounded-xl bg-[oklch(1_0_0)]/15" />
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <Card className="border-border/60 bg-card/95 shadow-[0_20px_70px_-35px_rgba(0,0,0,.35)] backdrop-blur">
              <CardHeader className="gap-2">
                <CardTitle className="text-2xl">Create account</CardTitle>
                <CardDescription>One login for all your projects and tasks.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        autoComplete="name"
                        placeholder="John Doe"
                        className="h-10 pl-10"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

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
                      <ArrowRight className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Create a strong password"
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
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters, including a lowercase letter, an uppercase letter, and a number. You can update it later in your profile.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="h-10 w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Sign in
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