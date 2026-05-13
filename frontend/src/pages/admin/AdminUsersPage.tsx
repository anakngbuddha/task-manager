import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ArrowLeft, Shield, User, Ban, CheckCircle } from 'lucide-react'
import { signOut } from '../../lib/auth-client'

interface UserItem {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  createdAt: string
  lastSeenAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data)
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

  const toggleBan = async (id: string, currentRole: string) => {
    if (currentRole === 'admin') {
      alert('Cannot ban an admin.')
      return
    }
    const newStatus = currentRole === 'banned' ? 'active' : 'banned'
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus })
      fetchUsers()
    } catch (err) {
      console.error('Failed to toggle ban status', err)
    }
  }

  const toggleRole = async (id: string, currentRole: string) => {
    if (currentRole === 'banned') {
      alert('Cannot change role of a banned user.')
      return
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole })
      fetchUsers()
    } catch (err) {
      console.error('Failed to toggle role', err)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage platform users, roles, and access.</p>
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

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
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
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-border/50">
                        <td className="px-4 py-3 font-medium">{user.name || '—'}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center ${user.status === 'ONLINE' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                            {user.role === 'banned' ? 'BANNED' : user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(user.lastSeenAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {user.role !== 'banned' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => toggleRole(user.id, user.role)}
                            >
                              {user.role === 'admin' ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button 
                            variant={user.role === 'banned' ? 'secondary' : 'destructive'} 
                            size="sm"
                            onClick={() => toggleBan(user.id, user.role)}
                            disabled={user.role === 'admin'}
                          >
                            {user.role === 'banned' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
