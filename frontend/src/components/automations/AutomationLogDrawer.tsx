import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ScrollText, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ACTION_LABELS: Record<string, string> = {
  SET_STATUS: 'Set Status',
  SET_PRIORITY: 'Set Priority',
  ASSIGN_TO_MEMBER: 'Assign to Member',
  UNASSIGN_TASK: 'Unassign Task',
  ADD_TAG: 'Add Tag',
  SEND_NOTIFICATION: 'Send Notification',
  MOVE_TO_SPRINT: 'Move to Sprint',
  REMOVE_FROM_SPRINT: 'Remove from Sprint',
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  ruleId: string | null
  ruleName?: string
}

function formatRelative(date: string) {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString()
}

function LogEntry({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false)
  const actions = (log.actionsRun as any[]) ?? []
  const successCount = actions.filter((a) => a.success).length

  return (
    <div
      className={cn(
        'rounded-lg border p-3.5 transition-colors cursor-pointer select-none',
        log.success
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
          : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center gap-3">
        {log.success ? (
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="size-4 text-red-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {successCount}/{actions.length} actions succeeded
            </span>
            {log.taskId && (
              <span className="text-xs text-muted-foreground truncate">
                · Task {log.taskId.slice(-6)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatRelative(log.createdAt)}
          </div>
        </div>
        {expanded
          ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
              {actions.map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {action.success
                    ? <CheckCircle2 className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle className="size-3.5 text-red-400 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{ACTION_LABELS[action.type] ?? action.type}</span>
                    {action.params && Object.keys(action.params).length > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({Object.entries(action.params).map(([k, v]) => `${k}: ${v}`).join(', ')})
                      </span>
                    )}
                    {!action.success && action.error && (
                      <p className="text-red-400 mt-0.5">{action.error}</p>
                    )}
                  </div>
                </div>
              ))}

              {log.errorMessage && (
                <p className="text-xs text-red-400 mt-1">Engine error: {log.errorMessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AutomationLogDrawer({ open, onClose, projectId, ruleId, ruleName }: Props) {
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    if (open) setPage(1)
  }, [open, ruleId])

  const { data, isLoading } = useQuery({
    queryKey: ['automation-logs', ruleId, page],
    queryFn: async () => {
      const r = await api.get(`/projects/${projectId}/automations/${ruleId}/logs?page=${page}&limit=${limit}`)
      return r.data
    },
    enabled: !!ruleId && open,
  })

  const logs: any[] = data?.logs ?? []
  const total: number = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 shrink-0">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 border border-primary/25">
                <ScrollText className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold truncate">Execution Logs</h2>
                {ruleName && (
                  <p className="text-xs text-muted-foreground truncate">{ruleName}</p>
                )}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} id="btn-close-log-drawer">
                <X className="size-4" />
              </Button>
            </div>

            {/* Stats bar */}
            {!isLoading && (
              <div className="px-5 py-2.5 bg-muted/30 border-b border-border/50 text-xs text-muted-foreground">
                {total} total execution{total !== 1 ? 's' : ''}
                {total > 0 && ` · Page ${page} of ${totalPages}`}
              </div>
            )}

            {/* Log list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                ))
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
                  <ScrollText className="size-10 opacity-30" />
                  <p className="text-sm">No executions yet</p>
                  <p className="text-xs">Logs will appear here when the rule fires.</p>
                </div>
              ) : (
                logs.map((log: any) => <LogEntry key={log.id} log={log} />)
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  id="btn-logs-prev"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  id="btn-logs-next"
                >
                  Next
                </Button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
