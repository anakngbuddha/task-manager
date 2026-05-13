import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, LogOut, MousePointerClick, Route } from 'lucide-react'
import { api } from '@/lib/api'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration, useOnlineUsers } from '@/hooks/useOnlineUsers'

type UserAnalyticsResponse = {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    status: string
    createdAt: string
    lastSeenAt: string
  }
  currentStatus: 'ONLINE' | 'IDLE' | 'OFFLINE'
  totalTimeSeconds: number
  totalIdleSeconds: number
  topPages: Array<{ url: string | null; count: number }>
  topClicks: Array<{ element: string | null; count: number }>
  hourlyActivity: Array<{ hour: number; label: string; count: number }>
  sessions: Array<{
    id: string
    startedAt: string
    endedAt: string | null
    duration: number | null
    idleTime: number
  }>
}

const statusStyles: Record<string, string> = {
  ONLINE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  IDLE: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  OFFLINE: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const onlineUsers = useOnlineUsers(true)
  const [data, setData] = useState<UserAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function fetchAnalytics() {
      try {
        const res = await api.get<UserAnalyticsResponse>(`/admin/users/${id}/analytics`)
        setData(res.data)
      } catch (error) {
        console.error('Failed to fetch user analytics', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const liveStatus = id ? onlineUsers[id]?.status ?? data?.currentStatus ?? 'OFFLINE' : 'OFFLINE'

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">User analytics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review activity, time in app, and current presence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/users">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to users
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading user analytics...</p>
        ) : !data ? (
          <p className="text-muted-foreground">User analytics could not be loaded.</p>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-3">
                  <span>{data.user.name || data.user.email}</span>
                  <Badge variant="outline" className={statusStyles[liveStatus]}>
                    {liveStatus}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm">{data.user.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Role</p>
                  <p className="mt-1 text-sm">{data.user.role}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Last seen</p>
                  <p className="mt-1 text-sm">{new Date(data.user.lastSeenAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Joined</p>
                  <p className="mt-1 text-sm">{new Date(data.user.createdAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Time in app</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatDuration(data.totalTimeSeconds)}</p>
                  <p className="text-xs text-muted-foreground">Tracked across recorded sessions</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Idle time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatDuration(data.totalIdleSeconds)}</p>
                  <p className="text-xs text-muted-foreground">Time with no recent activity</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Most visited pages</CardTitle>
                  <Route className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.topPages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No page views recorded.</p>
                  ) : (
                    data.topPages.map((page) => (
                      <div key={page.url} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{page.url}</span>
                        <Badge variant="secondary">{page.count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Most used actions</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.topClicks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No click activity recorded.</p>
                  ) : (
                    data.topClicks.map((click) => (
                      <div key={click.element} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{click.element}</span>
                        <Badge variant="secondary">{click.count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity by hour</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {data.hourlyActivity.map((bucket) => (
                  <div key={bucket.hour} className="rounded-md border px-3 py-2 text-sm">
                    <p className="text-muted-foreground">{bucket.label}</p>
                    <p className="font-medium">{bucket.count} events</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session history</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Ended</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">Idle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                          No sessions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      data.sessions.map((session) => (
                        <tr key={session.id} className="border-b border-border/50">
                          <td className="px-3 py-2">{new Date(session.startedAt).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {session.endedAt ? new Date(session.endedAt).toLocaleString() : 'Active'}
                          </td>
                          <td className="px-3 py-2">{formatDuration(session.duration ?? 0)}</td>
                          <td className="px-3 py-2">{formatDuration(session.idleTime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
