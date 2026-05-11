import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuditLogs, useAuditLogExport } from '@/hooks/useAuditLogs'

const ENTITY_TYPES = ['TASK', 'PROJECT', 'SPRINT', 'MEMBER', 'AUTOMATION', 'SETTINGS', 'FILE', 'SCHEDULE'] as const
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE'] as const

export default function AdminAuditLogsPage() {
  const [entityType, setEntityType] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  const filters = useMemo(() => {
    return {
      entityType: entityType === 'all' ? undefined : entityType,
      action: action === 'all' ? undefined : action,
      search: search.trim() ? search.trim() : undefined,
      projectId: projectId.trim() ? projectId.trim() : undefined,
      userId: userId.trim() ? userId.trim() : undefined,
      page,
      pageSize: 50,
    }
  }, [action, entityType, page, projectId, search, userId])

  const { data, isPending, isError } = useAuditLogs(filters)
  const exportMutation = useAuditLogExport()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Immutable admin trail of changes.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link to="/admin/dashboard">Back</Link>
              </Button>
              <Button
                onClick={() => exportMutation.mutate(filters)}
                disabled={exportMutation.isPending}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="md:col-span-1">
              <Select value={entityType} onValueChange={(v) => { setPage(1); setEntityType(v) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Select value={action} onValueChange={(v) => { setPage(1); setAction(v) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="md:col-span-1"
              placeholder="Project ID"
              value={projectId}
              onChange={(e) => { setPage(1); setProjectId(e.target.value) }}
            />
            <Input
              className="md:col-span-1"
              placeholder="User ID"
              value={userId}
              onChange={(e) => { setPage(1); setUserId(e.target.value) }}
            />
            <Input
              className="md:col-span-1"
              placeholder="Search (entity name)"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">When</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Entity</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Project</th>
                </tr>
              </thead>
              <tbody>
                {isPending && (
                  <tr><td className="p-3 text-muted-foreground" colSpan={6}>Loading…</td></tr>
                )}
                {isError && (
                  <tr><td className="p-3 text-destructive" colSpan={6}>Failed to load audit logs.</td></tr>
                )}
                {!isPending && !isError && (data?.items?.length ?? 0) === 0 && (
                  <tr><td className="p-3 text-muted-foreground" colSpan={6}>No results.</td></tr>
                )}
                {(data?.items ?? []).map((it) => (
                  <tr key={it.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">{new Date(it.createdAt).toLocaleString()}</td>
                    <td className="p-2">
                      <div className="font-medium">{it.userName || it.userEmail}</div>
                      <div className="text-xs text-muted-foreground">{it.userId}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">{it.action}</td>
                    <td className="p-2 whitespace-nowrap">{it.entityType}</td>
                    <td className="p-2">
                      <div className="font-medium">{it.entityName || it.entityId}</div>
                      <div className="text-xs text-muted-foreground">{it.entityId}</div>
                      {it.changes && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">Changes</summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/30 p-2 text-xs">
{JSON.stringify(it.changes, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">{it.projectId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data ? `Page ${data.page} of ${data.totalPages} • ${data.total} total` : ''}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!data || data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!data || data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

