import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState({
    topPages: [] as any[],
    topClicks: [] as any[],
    topErrors: [] as any[]
  })

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await api.get('/admin/analytics')
        const json = res.data
        setData({
          topPages: json.topPages || [],
          topClicks: json.topClicks || [],
          topErrors: json.topErrors || []
        })
      } catch (err) {
        console.error('Failed to fetch admin analytics', err)
      }
    }
    fetchAnalytics()
  }, [])

  return (
    <div className="flex flex-col min-h-screen w-full bg-background p-8">
      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Business Analytics</h2>
          <p className="text-muted-foreground">Track user behavior, engagement, and operational issues.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="outline">
            <Link to="/admin/dashboard">Back to KPI Dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Most Visited Pages */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Most Visited Pages</CardTitle>
            <CardDescription>What pages users visit the most</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topPages}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
                <XAxis 
                  dataKey="url" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val.length > 20 ? val.substring(0,20)+'...' : val}
                />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip cursor={{fill: '#888888', opacity: 0.1}} />
                <Bar dataKey="count" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Interactions */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Top Interactions</CardTitle>
            <CardDescription>What features users usually click</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topClicks} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888888" opacity={0.2} />
                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <YAxis width={120} dataKey="element" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#888888', opacity: 0.1}} />
                <Bar dataKey="count" fill="currentColor" className="fill-primary" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detected Issues */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Detected User Issues</CardTitle>
            <CardDescription>What users are having problem or trouble with</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topErrors.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No recorded errors or issues found. System looks healthy!
              </div>
            ) : (
              <div className="space-y-4">
                {data.topErrors.map((error, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-none md:rounded-lg">
                    <div className="space-y-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate" title={error.problem}>{error.problem}</p>
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
