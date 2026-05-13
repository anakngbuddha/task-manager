import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ArrowLeft, Bug, Search, CheckCircle, Zap } from 'lucide-react'
import { signOut } from '../../lib/auth-client'

interface IssueAnalysis {
  cause: string
  fix: string
}

interface AnalyticsEvent {
  id: string
  eventType: string
  pageUrl: string | null
  elementId: string | null
  metadata: any
  createdAt: string
  user: { name: string | null; email: string } | null
  issueAnalysis?: IssueAnalysis
}

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<AnalyticsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchIssues()
  }, [])

  async function fetchIssues() {
    try {
      const res = await api.get('/admin/issues')
      setIssues(res.data)
    } catch (err) {
      console.error('Failed to fetch issues', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const analyzeIssue = async (id: string) => {
    setAnalyzingId(id)
    try {
      const res = await api.post(`/admin/issues/${id}/analyze`)
      // Update local state with analysis
      setIssues(prev => prev.map(issue => 
        issue.id === id ? { ...issue, issueAnalysis: res.data } : issue
      ))
    } catch (err) {
      console.error('Failed to analyze issue', err)
      alert('Failed to analyze issue. Ensure Gemini API key is configured.')
    } finally {
      setAnalyzingId(null)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Detected Issues</h2>
            <p className="text-muted-foreground text-sm mt-1">Review system errors and get AI-powered diagnostics.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button asChild variant="outline">
              <Link to="/admin/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {loading ? (
            <p className="text-muted-foreground">Loading issues...</p>
          ) : issues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mb-4 text-emerald-500" />
                <p>No issues detected! System is running smoothly.</p>
              </CardContent>
            </Card>
          ) : (
            issues.map(issue => (
              <Card key={issue.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Bug className="h-5 w-5 mr-2 text-red-500" />
                        {issue.elementId || 'Unknown Error'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Occurred at {new Date(issue.createdAt).toLocaleString()} 
                        {issue.user && ` • User: ${issue.user.email}`}
                        {issue.pageUrl && ` • URL: ${issue.pageUrl}`}
                      </CardDescription>
                    </div>
                    {!issue.issueAnalysis && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => analyzeIssue(issue.id)}
                        disabled={analyzingId === issue.id}
                      >
                        {analyzingId === issue.id ? (
                          <span className="flex items-center">Analyzing...</span>
                        ) : (
                          <span className="flex items-center">
                            <Zap className="h-4 w-4 mr-2 text-amber-500" />
                            Diagnose with AI
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono text-red-400">
                    {issue.metadata?.message || 'No specific error message provided.'}
                    {issue.metadata?.stack && (
                      <div className="mt-2 text-muted-foreground whitespace-pre-wrap">
                        {issue.metadata.stack}
                      </div>
                    )}
                  </div>
                  
                  {issue.issueAnalysis && (
                    <div className="mt-4 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
                      <h4 className="flex items-center font-semibold text-amber-500">
                        <Search className="h-4 w-4 mr-2" />
                        AI Diagnosis
                      </h4>
                      <div>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Possible Cause</span>
                        <p className="text-sm mt-1">{issue.issueAnalysis.cause}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Suggested Fix</span>
                        <p className="text-sm mt-1">{issue.issueAnalysis.fix}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
