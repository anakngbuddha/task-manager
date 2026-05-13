import { Fragment, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { api } from '../../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import {
  LogOut,
  ArrowLeft,
  Bug,
  Search,
  CheckCircle,
  Zap,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
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

type AnalysisFilter = 'all' | 'unanalyzed' | 'analyzed'

function getIssueTitle(issue: AnalyticsEvent) {
  return issue.elementId || issue.metadata?.message || 'Unknown error'
}

function getSeverity(issue: AnalyticsEvent): 'high' | 'medium' | 'low' {
  const message = String(issue.metadata?.message ?? '').toLowerCase()
  const status = Number(issue.metadata?.status ?? issue.metadata?.statusCode ?? 0)
  if (status >= 500 || message.includes('fatal') || message.includes('uncaught')) return 'high'
  if (status >= 400 || message.includes('failed')) return 'medium'
  return 'low'
}

const severityStyles: Record<ReturnType<typeof getSeverity>, string> = {
  high: 'bg-red-500/15 text-red-600 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  low: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<AnalyticsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
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

  const filteredIssues = useMemo(() => {
    const query = search.trim().toLowerCase()
    return issues.filter((issue) => {
      if (analysisFilter === 'analyzed' && !issue.issueAnalysis) return false
      if (analysisFilter === 'unanalyzed' && issue.issueAnalysis) return false
      if (!query) return true
      const haystack = [
        getIssueTitle(issue),
        issue.pageUrl ?? '',
        issue.user?.email ?? '',
        issue.user?.name ?? '',
        issue.metadata?.message ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [analysisFilter, issues, search])

  const analyzeIssue = async (id: string) => {
    setAnalyzingId(id)
    setAnalysisError(null)
    try {
      const res = await api.post(`/admin/issues/${id}/analyze`)
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id ? { ...issue, issueAnalysis: res.data } : issue,
        ),
      )
      setExpandedId(id)
    } catch (err) {
      console.error('Failed to analyze issue', err)
      let message = 'Failed to analyze issue.'
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.error
        if (typeof serverMessage === 'string' && serverMessage.trim()) {
          message = serverMessage
        } else if (err.response?.status === 503) {
          message =
            'AI diagnosis is unavailable. Add GEMINI_API_KEY to the backend deployment environment.'
        } else if (err.response?.status === 502) {
          message = 'The AI provider rejected the request. Verify the Gemini API key and model access.'
        }
      }
      setAnalysisError(message)
    } finally {
      setAnalyzingId(null)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Detected Issues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review application errors, filter by status, and run AI diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search errors, users, or URLs"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'unanalyzed', 'analyzed'] as AnalysisFilter[]).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={analysisFilter === filter ? 'default' : 'outline'}
                  onClick={() => setAnalysisFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter === 'unanalyzed' ? 'Needs diagnosis' : 'Diagnosed'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {analysisError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {analysisError}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading issues...</p>
        ) : filteredIssues.length === 0 ? (
          <Card>
            <CardContent className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <CheckCircle className="mb-4 h-10 w-10 text-emerald-500" />
              <p>No issues match the current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Error</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">URL</th>
                      <th className="px-4 py-3">Occurred</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue) => {
                      const severity = getSeverity(issue)
                      const isExpanded = expandedId === issue.id
                      return (
                        <Fragment key={issue.id}>
                          <tr className="border-b border-border/50 align-top">
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {issue.issueAnalysis ? 'Diagnosed' : 'Open'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={severityStyles[severity]}>
                                {severity}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="flex items-start gap-2 text-left font-medium hover:text-primary"
                                onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                                )}
                                <span className="inline-flex items-start gap-2">
                                  <Bug className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                  {getIssueTitle(issue)}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {issue.user?.email ?? 'Anonymous'}
                            </td>
                            <td className="max-w-[12rem] truncate px-4 py-3 text-muted-foreground">
                              {issue.pageUrl ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(issue.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!issue.issueAnalysis && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => analyzeIssue(issue.id)}
                                  disabled={analyzingId === issue.id}
                                >
                                  <Zap className="mr-2 h-4 w-4 text-amber-500" />
                                  {analyzingId === issue.id ? 'Analyzing...' : 'Diagnose'}
                                </Button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-border/50 bg-muted/10">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="space-y-4">
                                  <div className="rounded-md border bg-background p-3 text-xs font-mono text-red-500">
                                    <div className="mb-2 flex items-center gap-2 font-sans text-sm font-medium text-foreground">
                                      <AlertTriangle className="h-4 w-4 text-red-500" />
                                      Error details
                                    </div>
                                    <p>{issue.metadata?.message || 'No specific error message provided.'}</p>
                                    {issue.metadata?.stack && (
                                      <pre className="mt-3 whitespace-pre-wrap text-muted-foreground">
                                        {issue.metadata.stack}
                                      </pre>
                                    )}
                                  </div>

                                  {issue.issueAnalysis && (
                                    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                      <h4 className="flex items-center font-semibold text-amber-600">
                                        <Search className="mr-2 h-4 w-4" />
                                        AI diagnosis
                                      </h4>
                                      <div>
                                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                                          Possible cause
                                        </span>
                                        <p className="mt-1 text-sm">{issue.issueAnalysis.cause}</p>
                                      </div>
                                      <div>
                                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                                          Suggested fix
                                        </span>
                                        <p className="mt-1 text-sm">{issue.issueAnalysis.fix}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
