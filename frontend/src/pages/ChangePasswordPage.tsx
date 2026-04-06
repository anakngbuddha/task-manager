import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    try {
      const res = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      })

      if (res?.error) {
        setError(res.error.message || 'Failed to change password')
      } else {
        setSuccess('Password changed successfully.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to change password')
    }
    setLoading(false)
  }

  return (
    <div className="flex h-dvh bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Profile / Security</span>}
          title="Change Password"
          subtitle="Update your password to keep your account secure."
        />

        <section className="mx-auto max-w-2xl px-6 py-6 sm:px-8">
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="gap-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="size-4" />
                </div>
                <CardTitle className="text-xl">Security</CardTitle>
              </div>
              <CardDescription>
                Ensure your account is using a long, random password to stay secure.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    <span>{showPasswords ? 'Hide passwords' : 'Show passwords'}</span>
                  </button>
                </div>

                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                {success && <p className="text-sm font-medium text-[oklch(0.65_0.15_150)]">{success}</p>}
              </CardContent>
              <CardFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
                <Button type="submit" disabled={loading || !currentPassword || !newPassword}>
                  {loading ? 'Updating...' : 'Update password'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>
      </main>
    </div>
  )
}
