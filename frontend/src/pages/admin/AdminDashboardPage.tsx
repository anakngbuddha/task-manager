import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Users, Folder, CheckCircle, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeProjects: 0,
    totalTasks: 0,
    recentSignups: 0
  })
  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await api.get('/admin/metrics')
        setMetrics(res.data)
      } catch (err) {
        console.error('Failed to fetch admin metrics', err)
      }
    }
    fetchMetrics()
  }, [])

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Basic Sidebar Override for Admin Space, or we can use the app's default sidebar. 
          Assuming this renders inside standard layout or standalone. */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between space-y-2 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to App</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/analytics">View Detailed Analytics</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                +{metrics.recentSignups} this week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Folder className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeProjects}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks Tracking</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTasks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">Okay</div>
              <p className="text-xs text-muted-foreground">All services running smoothly</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Admin System</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This dashboard gives you a high level overview of the operation metrics. For detailed interaction analytics and tracking, click the button in the top right.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
