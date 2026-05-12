import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, ArrowLeft, ToggleLeft, ToggleRight, Trash2,
  ChevronRight, CheckCircle2, XCircle, Clock, Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import RuleBuilderModal from '@/components/automations/RuleBuilderModal'
import AutomationLogDrawer from '@/components/automations/AutomationLogDrawer'

const TRIGGER_LABELS: Record<string, string> = {
  TASK_CREATED: 'Task Created',
  TASK_STATUS_CHANGED: 'Status Changed',
  TASK_ASSIGNED: 'Task Assigned',
  TASK_PRIORITY_CHANGED: 'Priority Changed',
  TASK_DEADLINE_APPROACHING: 'Deadline Approaching',
  SPRINT_STARTED: 'Sprint Started',
  SPRINT_COMPLETED: 'Sprint Completed',
}

const TRIGGER_COLORS: Record<string, string> = {
  TASK_CREATED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TASK_STATUS_CHANGED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  TASK_ASSIGNED: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  TASK_PRIORITY_CHANGED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  TASK_DEADLINE_APPROACHING: 'bg-red-500/15 text-red-400 border-red-500/30',
  SPRINT_STARTED: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  SPRINT_COMPLETED: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}

export default function ProjectAutomationsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editRule, setEditRule] = useState<any | null>(null)
  const [logDrawerRuleId, setLogDrawerRuleId] = useState<string | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automations', projectId],
    queryFn: async () => {
      const r = await api.get(`/projects/${projectId}/automations`)
      return r.data
    },
    enabled: !!projectId,
  })

  const toggleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const r = await api.post(`/projects/${projectId}/automations/${ruleId}/toggle`)
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/projects/${projectId}/automations/${ruleId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations', projectId] }),
  })

  const logDrawerRule = logDrawerRuleId ? rules.find((r: any) => r.id === logDrawerRuleId) : null

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ── Header ── */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Project
          </Link>
          <span className="text-border/60">·</span>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 border border-primary/25">
              <Zap className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Workflow Automations</h1>
              <p className="text-xs text-muted-foreground">
                {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <Button
            id="btn-new-automation"
            size="sm"
            onClick={() => { setEditRule(null); setBuilderOpen(true) }}
            className="gap-2 shadow-sm"
          >
            <Plus className="size-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-5 py-24 text-center"
          >
            <div className="flex items-center justify-center size-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
              <Zap className="size-10 text-primary/70" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">No automations yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create your first rule to automate repetitive work. Rules run instantly when their trigger fires.
              </p>
            </div>
            <Button
              id="btn-create-first-automation"
              size="lg"
              onClick={() => { setEditRule(null); setBuilderOpen(true) }}
              className="gap-2 shadow-md"
            >
              <Plus className="size-4" />
              Create First Rule
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {rules.map((rule: any, idx: number) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: idx * 0.04 }}
                  className={cn(
                    'group relative flex items-center gap-4 rounded-xl border px-5 py-4 transition-all duration-200',
                    'bg-card/60 hover:bg-card/90 backdrop-blur-sm',
                    rule.isEnabled
                      ? 'border-border/60 hover:border-border shadow-sm hover:shadow-md'
                      : 'border-border/30 opacity-60 hover:opacity-80'
                  )}
                >
                  {/* Enabled indicator strip */}
                  <div
                    className={cn(
                      'absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-colors',
                      rule.isEnabled ? 'bg-primary' : 'bg-muted'
                    )}
                  />

                  {/* Icon */}
                  <div className="flex items-center justify-center size-10 rounded-lg bg-muted/60 shrink-0">
                    <Zap className="size-4 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-medium text-sm truncate">{rule.name}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-[0.65rem] px-2 py-0 border shrink-0', TRIGGER_COLORS[rule.trigger])}
                      >
                        {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                      </Badge>
                      {!rule.isEnabled && (
                        <Badge variant="outline" className="text-[0.65rem] px-2 py-0 text-muted-foreground shrink-0">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ChevronRight className="size-3" />
                        {(rule.actions as any[])?.length ?? 0} action{(rule.actions as any[])?.length !== 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>{rule._count?.logs ?? 0} runs</span>
                      {rule.description && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-xs">{rule.description}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions (show on hover) */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="View logs"
                      id={`btn-logs-${rule.id}`}
                      onClick={() => setLogDrawerRuleId(rule.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Clock className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit rule"
                      id={`btn-edit-${rule.id}`}
                      onClick={() => { setEditRule(rule); setBuilderOpen(true) }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={rule.isEnabled ? 'Disable rule' : 'Enable rule'}
                      id={`btn-toggle-${rule.id}`}
                      onClick={() => toggleMutation.mutate(rule.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {rule.isEnabled
                        ? <ToggleRight className="size-4 text-primary" />
                        : <ToggleLeft className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Delete rule"
                      id={`btn-delete-${rule.id}`}
                      onClick={() => {
                        if (confirm(`Delete "${rule.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(rule.id)
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Last run status pill */}
                  <div className="shrink-0">
                    {rule._count?.logs > 0 ? (
                      <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                        <XCircle className="size-3 text-muted-foreground/40" />
                        Never run
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Rule Builder Modal ── */}
      <RuleBuilderModal
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditRule(null) }}
        projectId={projectId!}
        existingRule={editRule}
      />

      {/* ── Log Drawer ── */}
      <AutomationLogDrawer
        open={!!logDrawerRuleId}
        onClose={() => setLogDrawerRuleId(null)}
        projectId={projectId!}
        ruleId={logDrawerRuleId}
        ruleName={logDrawerRule?.name}
      />
    </div>
  )
}
