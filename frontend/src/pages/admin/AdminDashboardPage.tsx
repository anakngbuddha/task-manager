import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Users, Folder, CheckCircle, TrendingUp, AlertTriangle,
  Clock, UserX, Activity, Mail, UserCheck, MessageSquare, LogOut
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from '../../lib/auth-client'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'

interface AdminMetrics {
  // Existing
  totalUsers: number
  activeProjects: number
  totalTasks: number
  recentSignups: number
  // What users need
  taskCompletionRate: number
  overdueTasks: number
  avgCompletionDays: number
  inviteAcceptanceRate: number
  notificationReadRate: number
  // Engagement
  dauCount: number
  wauCount: number
  churnRiskUsers: number
  // Medium priority
  projectsWithUnreadChats: number
}

function RateBar({ value }: { value: number }) {
  const color =
    value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function RateColor(value: number) {
  if (value >= 70) return 'text-emerald-500'
  if (value >= 40) return 'text-amber-400'
  return 'text-red-500'
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    activeProjects: 0,
    totalTasks: 0,
    recentSignups: 0,
    taskCompletionRate: 0,
    overdueTasks: 0,
    avgCompletionDays: 0,
    inviteAcceptanceRate: 0,
    notificationReadRate: 0,
    dauCount: 0,
    wauCount: 0,
    churnRiskUsers: 0,
    projectsWithUnreadChats: 0,
  })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await api.get('/admin/metrics')
        setMetrics(res.data)
      } catch (err) {
        console.error('Failed to fetch admin metrics', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">Platform health, user needs & engagement overview</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to App</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/analytics">View Detailed Analytics</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/admin/audit-logs">Audit Logs</Link>
            </Button>
            <Button variant="destructive" onClick={handleSignOut} title="Sign Out">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* ── Section 1: Core KPIs ─────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Platform Overview</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : metrics.totalUsers}</div>
              <p className="text-xs text-muted-foreground">+{metrics.recentSignups} this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Folder className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : metrics.activeProjects}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : metrics.totalTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">Healthy</div>
              <p className="text-xs text-muted-foreground">All services running</p>
            </CardContent>
          </Card>

          <Card className={metrics.projectsWithUnreadChats > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Project Chats</CardTitle>
              <MessageSquare className={`h-4 w-4 ${metrics.projectsWithUnreadChats > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.projectsWithUnreadChats > 0 ? 'text-amber-500' : ''}`}>
                {loading ? '—' : metrics.projectsWithUnreadChats}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.projectsWithUnreadChats === 0 ? 'All chats are up to date' : 'projects have unread messages'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Section 2: What Users Need ──────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What Users Need</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Task Completion Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
              <CheckCircle className={`h-4 w-4 ${RateColor(metrics.taskCompletionRate)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${RateColor(metrics.taskCompletionRate)}`}>
                {loading ? '—' : `${metrics.taskCompletionRate}%`}
              </div>
              <p className="text-xs text-muted-foreground">of all tasks completed</p>
              <RateBar value={metrics.taskCompletionRate} />
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card className={metrics.overdueTasks > 0 ? 'border-red-500/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${metrics.overdueTasks > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.overdueTasks > 0 ? 'text-red-500' : ''}`}>
                {loading ? '—' : metrics.overdueTasks}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.overdueTasks === 0 ? 'No overdue tasks 🎉' : 'past deadline, not done'}
              </p>
            </CardContent>
          </Card>

          {/* Invite Acceptance Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invite Acceptance</CardTitle>
              <UserCheck className={`h-4 w-4 ${RateColor(metrics.inviteAcceptanceRate)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${RateColor(metrics.inviteAcceptanceRate)}`}>
                {loading ? '—' : `${metrics.inviteAcceptanceRate}%`}
              </div>
              <p className="text-xs text-muted-foreground">of invites accepted</p>
              <RateBar value={metrics.inviteAcceptanceRate} />
            </CardContent>
          </Card>

          {/* Notification Read Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notification Read Rate</CardTitle>
              <Mail className={`h-4 w-4 ${RateColor(metrics.notificationReadRate)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${RateColor(metrics.notificationReadRate)}`}>
                {loading ? '—' : `${metrics.notificationReadRate}%`}
              </div>
              <p className="text-xs text-muted-foreground">notifications opened</p>
              <RateBar value={metrics.notificationReadRate} />
            </CardContent>
          </Card>
        </div>

        {/* ── Section 3: User Engagement ──────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">User Engagement</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* DAU */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : metrics.dauCount}</div>
              <p className="text-xs text-muted-foreground">sessions started today</p>
            </CardContent>
          </Card>

          {/* WAU */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : metrics.wauCount}</div>
              <p className="text-xs text-muted-foreground">active in the last 7 days</p>
            </CardContent>
          </Card>

          {/* Avg Completion Days */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Task Completion</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : `${metrics.avgCompletionDays}d`}</div>
              <p className="text-xs text-muted-foreground">average days to finish a task</p>
            </CardContent>
          </Card>

          {/* Churn Risk */}
          <Card className={metrics.churnRiskUsers > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Risk Users</CardTitle>
              <UserX className={`h-4 w-4 ${metrics.churnRiskUsers > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.churnRiskUsers > 0 ? 'text-amber-500' : ''}`}>
                {loading ? '—' : metrics.churnRiskUsers}
              </div>
              <p className="text-xs text-muted-foreground">inactive for 7+ days</p>
            </CardContent>
          </Card>
        </div>

        {/* Welcome note */}
        <Card>
          <CardHeader>
            <CardTitle>How to read these metrics</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p><span className="text-emerald-500 font-medium">Green</span> rates (≥70%) are healthy. <span className="text-amber-400 font-medium">Amber</span> (40–70%) needs attention. <span className="text-red-500 font-medium">Red</span> (&lt;40%) requires action.</p>
            <p>Overdue tasks and churn risk are highlighted in orange/red to prompt investigation.</p>
            <p>For trends, priority breakdown, and peak usage charts, view <Link to="/admin/analytics" className="underline">Detailed Analytics</Link>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
