import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle2, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false)

  useEffect(() => {
    const v = searchParams.get('verified')
    if (v === '1' || v === 'true') {
      setShowVerifiedBanner(true)
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email), [email])

  // Forgot password
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotShowPassword, setForgotShowPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const resetForgotState = () => {
    setForgotStep('request')
    setForgotEmail(email)
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotError('')
    setForgotShowPassword(false)
  }

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: forgotEmail,
        type: 'forget-password'
      })
      if (res?.error) {
        setForgotError(res.error.message || 'Failed to send OTP')
      } else {
        setForgotStep('verify')
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to send OTP')
    }
    setForgotLoading(false)
  }

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    try {
      const res = await authClient.emailOtp.resetPassword({
        email: forgotEmail,
        otp: forgotOtp,
        password: forgotNewPassword
      })
      if (res?.error) {
        setForgotError(res.error.message || 'Failed to reset password')
      } else {
        setIsForgotOpen(false)
        setEmail(forgotEmail)
        setPassword('')
        resetForgotState()
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to reset password')
    }
    setForgotLoading(false)
  }

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
      window.location.href = '/dashboard'
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

  const handleGithub = async () => {
    await signIn.social({
      provider: 'github',
      callbackURL: `${window.location.origin}/`,
    })
  }

  return (
    <>
      <Card className="border border-border/40 shadow-2xl sm:rounded-2xl w-full bg-white/70 backdrop-blur-xl">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Use your email and password to continue.</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {showVerifiedBanner && (
            <div
              className="mb-4 flex gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-200"
              role="status"
            >
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div>
                <p className="font-medium">Your email is verified.</p>
                <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-100/80">
                  Sign in below to continue to your account.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 pl-10 rounded-xl bg-transparent border-input/60 hover:border-teal-500/50 focus-visible:ring-teal-500/20 focus-visible:border-teal-500 transition-colors shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={email.length > 3 && !isValidEmail}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-teal-600 hover:underline hover:text-teal-700"
                  onClick={() => {
                    resetForgotState()
                    setIsForgotOpen(true)
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 pl-10 pr-10 rounded-xl bg-transparent border-input/60 hover:border-teal-500/50 focus-visible:ring-teal-500/20 focus-visible:border-teal-500 transition-colors shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
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

            <Button type="submit" className="h-11 w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-base shadow-sm" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-muted-foreground">OR</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Login with</p>
            <div className="flex gap-4">
              <Button variant="outline" className="size-12 rounded-full p-0 shadow-sm hover:shadow hover:bg-white" onClick={handleGoogle}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-6">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                <span className="sr-only">Google</span>
              </Button>
              <Button variant="outline" className="size-12 rounded-full p-0 shadow-sm hover:shadow hover:bg-white" onClick={handleGithub}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-6">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="sr-only">GitHub</span>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-teal-600 hover:underline hover:text-teal-700">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isForgotOpen} onOpenChange={(open) => {
        setIsForgotOpen(open)
        if (!open) resetForgotState()
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{forgotStep === 'request' ? 'Reset password' : 'Enter security code'}</DialogTitle>
            <DialogDescription>
              {forgotStep === 'request'
                ? "Enter your email address and we'll send you a 6-digit code to reset your password."
                : `We sent a 6-digit code to ${forgotEmail}. Enter it below along with your new password.`}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 'request' ? (
            <form onSubmit={handleForgotRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={forgotLoading} className="w-full sm:w-auto">
                  {forgotLoading ? 'Sending...' : 'Send reset code'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleForgotVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-otp">6-digit Code</Label>
                <Input
                  id="forgot-otp"
                  type="text"
                  placeholder="123456"
                  value={forgotOtp}
                  onChange={e => setForgotOtp(e.target.value)}
                  required
                  maxLength={6}
                  pattern="[0-9]*"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="forgot-new-password"
                    type={forgotShowPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setForgotShowPassword(s => !s)}
                  >
                    {forgotShowPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={() => setForgotStep('request')} disabled={forgotLoading}>
                  Back
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting...' : 'Reset password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}