import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from '../../lib/auth-client'
import { LogOut } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────
interface BaseAnalytics {
  topPages: { url: string; count: number }[]
  topClicks: { element: string; count: number; text?: string; path?: string }[]
  topErrors: { problem: string; count: number; source?: string; stack?: string }[]
  performance?: { avgLoadTime: number }
}

interface ExtendedAnalytics {
  // High priority (existing)
  completionTrend: { date: string; count: number }[]
  priorityDistribution: { priority: string; count: number }[]
  statusDistribution: { status: string; count: number }[]
  peakHours: { hour: number; label: string; count: number }[]
  notificationReadTrend: { date: string; readRate: number }[]
  // Medium priority (new)
  sprintCompletionRate?: number
  mostCommentedTasks?: { taskId: string; title: string; count: number }[]
  avgTasksPerUser?: number
  tagUsage?: { tagId: string; name: string; color: string; count: number }[]
  subtaskUsageRate?: number
  chatRatio?: { directMessages: number; groupMessages: number }
  deviceBreakdown?: { name: string; value: number }[]
  topLocations?: { name: string; value: number }[]
  topEmailDomains?: { name: string; value: number }[]
}

// ─── Colours ──────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  URGENT: '#ef4444',
}

const STATUS_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6'
]

export default function AdminAnalyticsPage() {
  const [base, setBase] = useState<BaseAnalytics>({ topPages: [], topClicks: [], topErrors: [] })
  const [ext, setExt] = useState<ExtendedAnalytics>({
    completionTrend: [],
    priorityDistribution: [],
    statusDistribution: [],
    peakHours: [],
    notificationReadTrend: [],
    sprintCompletionRate: undefined,
    mostCommentedTasks: undefined,
    avgTasksPerUser: undefined,
    tagUsage: undefined,
    subtaskUsageRate: undefined,
    chatRatio: undefined,
    deviceBreakdown: undefined,
    topLocations: undefined,
    topEmailDomains: undefined,
  })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    async function fetchAll() {
      try {
        const [baseRes, extRes] = await Promise.all([
          api.get('/admin/analytics'),
          api.get('/admin/analytics/extended'),
        ])
        setBase(baseRes.data)
        setExt(extRes.data)
      } catch (err) {
        console.error('Failed to fetch analytics', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex h-[250px] items-center justify-center text-muted-foreground border border-dashed rounded-lg text-sm">
      {label}
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen w-full bg-background p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Business Analytics</h2>
          <p className="text-muted-foreground">Track user behavior, engagement, and operational insights.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="outline">
            <Link to="/admin/dashboard">Back to KPI Dashboard</Link>
          </Button>
          <Button variant="destructive" onClick={handleSignOut} title="Sign Out">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* ── Section: Platform Health ──────────────────────────────────── */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Platform Health</p>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Page Load Time</CardTitle>
              <CardDescription>From user performance events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '—' : base.performance?.avgLoadTime ? `${base.performance.avgLoadTime}ms` : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section: Team & Collaboration Insights (medium priority) ─ */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Team &amp; Collaboration Insights</p>

        {/* Stat row */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">

          {/* Sprint Completion Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sprint Completion Rate</CardTitle>
              <CardDescription>Sprints fully completed vs total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${
                (ext.sprintCompletionRate ?? 0) >= 70 ? 'text-emerald-500'
                : (ext.sprintCompletionRate ?? 0) >= 40 ? 'text-amber-400'
                : 'text-red-500'
              }`}>
                {loading ? '—' : `${ext.sprintCompletionRate ?? 0}%`}
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    (ext.sprintCompletionRate ?? 0) >= 70 ? 'bg-emerald-500'
                    : (ext.sprintCompletionRate ?? 0) >= 40 ? 'bg-amber-400'
                    : 'bg-red-500'
                  }`}
                  style={{ width: `${ext.sprintCompletionRate ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Subtask Usage Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Subtask Usage Rate</CardTitle>
              <CardDescription>Tasks that have a parent task</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '—' : `${ext.subtaskUsageRate ?? 0}%`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">of all tasks are subtasks</p>
            </CardContent>
          </Card>

          {/* Avg Tasks Per User */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Tasks Per Member</CardTitle>
              <CardDescription>Across all project memberships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '—' : ext.avgTasksPerUser ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">assigned tasks per project member</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart row */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">

          {/* Most Commented Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Most Discussed Tasks</CardTitle>
              <CardDescription>Tasks with the highest comment activity</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.mostCommentedTasks?.length ? (
                <EmptyState label="No comments recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ext.mostCommentedTasks} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.15} />
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      width={130}
                      dataKey="title"
                      type="category"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v}
                    />
                    <Tooltip cursor={{ fill: '#888888', opacity: 0.08 }} />
                    <Bar dataKey="count" name="Comments" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tag Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Tag Usage</CardTitle>
              <CardDescription>Most frequently applied task tags</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.tagUsage?.length ? (
                <EmptyState label="No tags have been used yet" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ext.tagUsage} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.15} />
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      width={100}
                      dataKey="name"
                      type="category"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: '#888888', opacity: 0.08 }} />
                    {ext.tagUsage.map(tag => (
                      <Bar key={tag.tagId} dataKey="count" name="Tasks" fill={tag.color} radius={[0, 4, 4, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Device Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
              <CardDescription>Mobile vs desktop usage from sessions (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.deviceBreakdown || ext.deviceBreakdown.length === 0 ? (
                <EmptyState label="No session data available" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={ext.deviceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                    >
                      {ext.deviceBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* DM vs Group Chat */}
          <Card>
            <CardHeader>
              <CardTitle>Communication Style</CardTitle>
              <CardDescription>Direct messages vs group project chat (all time)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.chatRatio || (ext.chatRatio.directMessages + ext.chatRatio.groupMessages) === 0 ? (
                <EmptyState label="No messages recorded yet" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Direct Messages', value: ext.chatRatio.directMessages },
                          { name: 'Group Chat', value: ext.chatRatio.groupMessages },
                        ].filter(d => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#14b8a6" />
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-center">
                    <div>
                      <p className="text-2xl font-bold">{ext.chatRatio.directMessages.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Direct messages</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{ext.chatRatio.groupMessages.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Group messages</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section: Audience Demographics (new) ───────────────────────── */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Audience Demographics</p>
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* User Locations */}
          <Card>
            <CardHeader>
              <CardTitle>Top User Locations</CardTitle>
              <CardDescription>Based on timezone from recent sessions</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.topLocations || ext.topLocations.length === 0 ? (
                <EmptyState label="No location data available" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ext.topLocations} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.15} />
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      width={120}
                      dataKey="name"
                      type="category"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v}
                    />
                    <Tooltip cursor={{ fill: '#888888', opacity: 0.08 }} />
                    <Bar dataKey="value" name="Sessions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Email Domains */}
          <Card>
            <CardHeader>
              <CardTitle>Top Email Domains</CardTitle>
              <CardDescription>Most common domains used for registration</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {loading ? (
                <EmptyState label="Loading…" />
              ) : !ext.topEmailDomains || ext.topEmailDomains.length === 0 ? (
                <EmptyState label="No domain data available" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={ext.topEmailDomains}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                    >
                      {ext.topEmailDomains.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Row 1: High-priority charts – trends & priorities ──────── */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">

        {/* Task Completion Trend */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Task Completion Trend</CardTitle>
            <CardDescription>Tasks marked as done per day — last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : ext.completionTrend.every(d => d.count === 0) ? (
              <EmptyState label="No completed tasks in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ext.completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v.slice(5)} // MM-DD
                    interval={4}
                  />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Completed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>How tasks are spread across priority levels</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyState label="Loading…" />
            ) : ext.priorityDistribution.length === 0 ? (
              <EmptyState label="No task data available" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={ext.priorityDistribution}
                    dataKey="count"
                    nameKey="priority"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(props: any) =>
                      `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {ext.priorityDistribution.map(entry => (
                      <Cell
                        key={entry.priority}
                        fill={PRIORITY_COLORS[entry.priority] ?? '#6366f1'}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Board Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Board Status Usage</CardTitle>
            <CardDescription>Which board columns users put tasks in most</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : ext.statusDistribution.length === 0 ? (
              <EmptyState label="No task data available" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ext.statusDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.15} />
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    width={100}
                    dataKey="status"
                    type="category"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: '#888888', opacity: 0.08 }} />
                  {ext.statusDistribution.map((entry, index) => (
                    <Bar
                      key={entry.status}
                      dataKey="count"
                      name="Tasks"
                      fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      radius={[0, 4, 4, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Peak hours & notification read ───────────────── */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">

        {/* Peak Usage Hours */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Peak Usage Hours</CardTitle>
            <CardDescription>When users are most active (24-hour, last 30 days)</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : ext.peakHours.every(h => h.count === 0) ? (
              <EmptyState label="No analytics events recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ext.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.15} />
                  <XAxis
                    dataKey="label"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#888888', opacity: 0.08 }} />
                  <Bar dataKey="count" name="Events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Notification Read Rate Trend */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Notification Engagement</CardTitle>
            <CardDescription>Daily % of notifications that were read</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : ext.notificationReadTrend.length === 0 ? (
              <EmptyState label="No notification data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ext.notificationReadTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v.slice(5)}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Read Rate']} />
                  <Line
                    type="monotone"
                    dataKey="readRate"
                    name="Read Rate"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Original charts (pages, clicks, errors) ──────── */}
      <div className="grid gap-6 md:grid-cols-2">

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Most Visited Pages</CardTitle>
            <CardDescription>What pages users visit the most</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : base.topPages.length === 0 ? (
              <EmptyState label="No page view data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={base.topPages}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
                  <XAxis
                    dataKey="url"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => val.length > 20 ? val.substring(0, 20) + '...' : val}
                  />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#888888', opacity: 0.1 }} />
                  <Bar dataKey="count" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Top Interactions</CardTitle>
            <CardDescription>What features users usually click</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <EmptyState label="Loading…" />
            ) : base.topClicks.length === 0 ? (
              <EmptyState label="No click data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={base.topClicks} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.2} />
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis width={140} dataKey="element" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => val && val.length > 20 ? val.substring(0, 20) + '...' : val} />
                  <Tooltip cursor={{ fill: '#888888', opacity: 0.1 }} />
                  <Bar dataKey="count" fill="currentColor" className="fill-primary" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Detected User Issues</CardTitle>
            <CardDescription>What users are having problems with</CardDescription>
          </CardHeader>
          <CardContent>
            {base.topErrors.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No recorded errors or issues found. System looks healthy! 🎉
              </div>
            ) : (
              <div className="space-y-4">
                {base.topErrors.map((error, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate" title={error.problem}>{error.problem}</p>
                      <p className="text-xs text-muted-foreground truncate" title={error.source}>Source: {error.source}</p>
                    </div>
                    <div className="ml-auto font-medium bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs">
                      {error.count} occurrences
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
