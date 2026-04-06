import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { authClient, useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name)
    }
  }, [session])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await authClient.updateUser({ name })
      if (res?.error) {
        setError(res.error.message || 'Failed to update profile')
      } else {
        setSuccess('Profile updated successfully.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile')
    }
    setLoading(false)
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Profile / Settings</span>}
          title="Settings"
          subtitle="Manage your account preferences."
        />

        <section className="mx-auto max-w-2xl px-6 py-6 sm:px-8">
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="gap-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="size-4" />
                </div>
                <CardTitle className="text-xl">Profile</CardTitle>
              </div>
              <CardDescription>
                Update your personal information.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateProfile}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={session?.user?.email || ''}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your email address cannot be changed at this time.
                  </p>
                </div>

                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                {success && <p className="text-sm font-medium text-[oklch(0.65_0.15_150)]">{success}</p>}
              </CardContent>
              <CardFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
                <Button type="submit" disabled={loading || name === session?.user?.name}>
                  {loading ? 'Saving...' : 'Save changes'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>
      </main>
    </div>
  )
}
