import { useEffect, useState, type FormEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ArrowLeft, Ban, CheckCircle, UserPlus } from 'lucide-react'
import { signOut } from '../../lib/auth-client'
import { useOnlineUsers } from '../../hooks/useOnlineUsers'
import { cn } from '../../lib/utils'
import axios from 'axios'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

interface UserItem {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  accountStatus?: 'active' | 'banned'
  bannedAt?: string | null
  createdAt: string
  lastSeenAt: string
}

interface AdminUsersResponse {
  users: UserItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type SystemRole = 'USER' | 'AI_TESTER' | 'ADMIN'

const AI_TESTER_CAP = 5
const SYSTEM_ROLES: SystemRole[] = ['USER', 'AI_TESTER', 'ADMIN']

function extractUsers(data: unknown): UserItem[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray((data as AdminUsersResponse).users)) {
    return (data as AdminUsersResponse).users
  }
  return []
}

function normalizeRole(role: string): SystemRole {
  const upper = String(role ?? 'USER').toUpperCase()
  if (upper === 'ADMIN' || upper === 'AI_TESTER') return upper
  return 'USER'
}

function roleLabel(role: SystemRole): string {
  if (role === 'AI_TESTER') return 'AI Tester'
  if (role === 'ADMIN') return 'Admin'
  return 'User'
}

const isBanned = (u: UserItem) =>
  u.accountStatus === 'banned' ||
  !!u.bannedAt ||
  String(u.role).toLowerCase() === 'banned'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [addTesterOpen, setAddTesterOpen] = useState(false)
  const [testerName, setTesterName] = useState('')
  const [testerEmail, setTesterEmail] = useState('')
  const [testerPassword, setTesterPassword] = useState('')
  const [addTesterError, setAddTesterError] = useState<string | null>(null)
  const [isCreatingTester, setIsCreatingTester] = useState(false)
  const navigate = useNavigate()
  const onlineUsers = useOnlineUsers(true)

  const aiTesterCount = users.filter((u) => normalizeRole(u.role) === 'AI_TESTER').length
  const canAddAiTester = aiTesterCount < AI_TESTER_CAP

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const res = await api.get<AdminUsersResponse>('/admin/users')
      setUsers(extractUsers(res.data))
    } catch (err) {
      console.error('Failed to fetch users', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const toggleBan = async (user: UserItem) => {
    if (normalizeRole(user.role) === 'ADMIN') {
      alert('Cannot ban an admin.')
      return
    }
    const newStatus = isBanned(user) ? 'active' : 'banned'
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status: newStatus })
      fetchUsers()
    } catch (err) {
      console.error('Failed to toggle ban status', err)
    }
  }

  const changeRole = async (user: UserItem, newRole: SystemRole) => {
    const currentRole = normalizeRole(user.role)
    if (currentRole === newRole) return

    if (isBanned(user)) {
      setRoleError('Cannot change role of a banned user.')
      return
    }

    setRoleError(null)
    setUpdatingUserId(user.id)

    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: newRole })
      await fetchUsers()
    } catch (err) {
      let message = 'Failed to update role.'
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.error
        if (typeof serverMessage === 'string' && serverMessage.trim()) {
          message = serverMessage
        }
      }
      setRoleError(message)
    } finally {
      setUpdatingUserId(null)
    }
  }

  const resetAddTesterForm = () => {
    setTesterName('')
    setTesterEmail('')
    setTesterPassword('')
    setAddTesterError(null)
  }

  const handleAddTesterOpenChange = (open: boolean) => {
    setAddTesterOpen(open)
    if (!open) resetAddTesterForm()
  }

  const createAiTester = async (e: FormEvent) => {
    e.preventDefault()
    if (!canAddAiTester || isCreatingTester) return

    setAddTesterError(null)
    setIsCreatingTester(true)

    try {
      await api.post('/admin/users/ai-tester', {
        name: testerName.trim(),
        email: testerEmail.trim(),
        password: testerPassword,
      })
      handleAddTesterOpenChange(false)
      await fetchUsers()
    } catch (err) {
      let message = 'Failed to create AI Tester account.'
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.error
        if (typeof serverMessage === 'string' && serverMessage.trim()) {
          message = serverMessage
        }
      }
      setAddTesterError(message)
    } finally {
      setIsCreatingTester(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Manage platform users, roles, and access. AI Testers: {aiTesterCount}/{AI_TESTER_CAP}.
            </p>
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

        {roleError && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {roleError}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>All Users</CardTitle>
            <Button
              size="sm"
              disabled={!canAddAiTester}
              title={
                canAddAiTester
                  ? 'Create a new AI Tester account'
                  : `AI Tester cap reached (${AI_TESTER_CAP}/${AI_TESTER_CAP})`
              }
              onClick={() => setAddTesterOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add AI Tester
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Seen</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const liveStatus = onlineUsers[user.id]?.status ?? 'OFFLINE'
                      const banned = isBanned(user)
                      const role = normalizeRole(user.role)
                      return (
                        <tr key={user.id} className="border-b border-border/50">
                          <td className="px-4 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-left hover:text-primary"
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                            >
                              <span
                                className={cn(
                                  'size-2.5 rounded-full',
                                  liveStatus === 'ONLINE' && 'bg-emerald-500',
                                  liveStatus === 'IDLE' && 'bg-amber-400',
                                  liveStatus === 'OFFLINE' && 'bg-muted-foreground/40',
                                )}
                                title={liveStatus}
                              />
                              {user.name || '—'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-left hover:text-primary"
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                            >
                              {user.email}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {!banned ? (
                              <select
                                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                                value={role}
                                disabled={updatingUserId === user.id}
                                onChange={(e) => changeRole(user, e.target.value as SystemRole)}
                              >
                                {SYSTEM_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabel(r)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                {roleLabel(role)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center',
                                banned
                                  ? 'text-destructive'
                                  : liveStatus === 'ONLINE'
                                    ? 'text-emerald-500'
                                    : liveStatus === 'IDLE'
                                      ? 'text-amber-500'
                                      : 'text-muted-foreground',
                              )}
                            >
                              {banned ? 'BANNED' : liveStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.lastSeenAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Button
                              variant={banned ? 'secondary' : 'destructive'}
                              size="sm"
                              onClick={() => toggleBan(user)}
                              disabled={role === 'ADMIN'}
                            >
                              {banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={addTesterOpen} onOpenChange={handleAddTesterOpenChange}>
          <DialogContent>
            <form onSubmit={createAiTester}>
              <DialogHeader>
                <DialogTitle>Add AI Tester</DialogTitle>
                <DialogDescription>
                  Create a dedicated account with the AI Tester role. These users can submit global
                  knowledge for admin review. Slots remaining: {AI_TESTER_CAP - aiTesterCount} of{' '}
                  {AI_TESTER_CAP}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tester-name">Name</Label>
                  <Input
                    id="tester-name"
                    value={testerName}
                    onChange={(e) => setTesterName(e.target.value)}
                    placeholder="Jane Tester"
                    required
                    maxLength={100}
                    disabled={isCreatingTester}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tester-email">Email</Label>
                  <Input
                    id="tester-email"
                    type="email"
                    value={testerEmail}
                    onChange={(e) => setTesterEmail(e.target.value)}
                    placeholder="tester@example.com"
                    required
                    disabled={isCreatingTester}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tester-password">Temporary password</Label>
                  <Input
                    id="tester-password"
                    type="password"
                    value={testerPassword}
                    onChange={(e) => setTesterPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={isCreatingTester}
                  />
                </div>
                {addTesterError && (
                  <p className="text-sm text-destructive">{addTesterError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddTesterOpenChange(false)}
                  disabled={isCreatingTester}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreatingTester || !canAddAiTester}>
                  {isCreatingTester ? 'Creating…' : 'Create AI Tester'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
