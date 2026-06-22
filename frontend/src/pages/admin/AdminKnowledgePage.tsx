import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { api } from '../../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import {
  LogOut,
  ArrowLeft,
  Brain,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
} from 'lucide-react'
import { signOut } from '../../lib/auth-client'

interface KnowledgeUser {
  id: string
  name: string | null
  email: string
}

interface KnowledgeEntry {
  id: string
  fact: string
  scope: string
  status: string
  category: string | null
  sourceMessage: string | null
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
  user: KnowledgeUser
  reviewedBy?: KnowledgeUser | null
}

type Tab = 'pending' | 'approved'

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<KnowledgeEntry[]>([])
  const [approved, setApproved] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchEntries()
  }, [])

  async function fetchEntries() {
    setLoading(true)
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        api.get<{ entries: KnowledgeEntry[] }>('/admin/knowledge/pending'),
        api.get<{ entries: KnowledgeEntry[] }>('/admin/knowledge/approved'),
      ])
      setPending(pendingRes.data.entries)
      setApproved(approvedRes.data.entries)
    } catch (err) {
      console.error('Failed to fetch knowledge entries', err)
      setError('Failed to load knowledge entries.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const entries = tab === 'pending' ? pending : approved

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) => {
      const haystack = [
        entry.fact,
        entry.sourceMessage ?? '',
        entry.user.email,
        entry.user.name ?? '',
        entry.category ?? '',
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [entries, search])

  async function handleApprove(id: string) {
    setActionId(id)
    setError(null)
    try {
      await api.post(`/admin/knowledge/${id}/approve`)
      await fetchEntries()
    } catch {
      setError('Failed to approve entry.')
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }
    setActionId(id)
    setError(null)
    try {
      await api.post(`/admin/knowledge/${id}/reject`, { reason: rejectReason.trim() })
      setRejectId(null)
      setRejectReason('')
      await fetchEntries()
    } catch {
      setError('Failed to reject entry.')
    } finally {
      setActionId(null)
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm('Revoke this fact from the shared knowledge base?')) return
    setActionId(id)
    setError(null)
    try {
      await api.delete(`/admin/knowledge/${id}`)
      await fetchEntries()
    } catch {
      setError('Failed to revoke entry.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Chatbot Knowledge</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review user-submitted corrections before they become shared knowledge for all users.
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
                placeholder="Search facts, users, or messages"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={tab === 'pending' ? 'default' : 'outline'}
                onClick={() => setTab('pending')}
              >
                Pending ({pending.length})
              </Button>
              <Button
                size="sm"
                variant={tab === 'approved' ? 'default' : 'outline'}
                onClick={() => setTab('approved')}
              >
                Approved ({approved.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading knowledge entries…</p>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Brain className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">
                {tab === 'pending' ? 'No pending submissions' : 'No approved global facts'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === 'pending'
                  ? 'User corrections awaiting review will appear here.'
                  : 'Approved facts are indexed for all users via RAG.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{entry.category || 'unknown'}</Badge>
                        <Badge variant={entry.status === 'PENDING' ? 'secondary' : 'default'}>
                          {entry.status}
                        </Badge>
                      </div>
                      <p className="text-base font-medium">{entry.fact}</p>
                      {entry.sourceMessage && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Original message:</span> {entry.sourceMessage}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Submitted by {entry.user.name || entry.user.email} on{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.reviewedBy && entry.reviewedAt && (
                        <p className="text-xs text-muted-foreground">
                          Reviewed by {entry.reviewedBy.name || entry.reviewedBy.email} on{' '}
                          {new Date(entry.reviewedAt).toLocaleString()}
                        </p>
                      )}
                      {entry.rejectionReason && (
                        <p className="text-sm text-red-600">Rejected: {entry.rejectionReason}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tab === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(entry.id)}
                            disabled={actionId === entry.id}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectId(entry.id)
                              setRejectReason('')
                              setError(null)
                            }}
                            disabled={actionId === entry.id}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      {tab === 'approved' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevoke(entry.id)}
                          disabled={actionId === entry.id}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {rejectId === entry.id && (
                    <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                      <Input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(entry.id)}
                          disabled={actionId === entry.id}
                        >
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectId(null)
                            setRejectReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
