import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Zap, ChevronRight, Plus, Trash2, GripVertical, ArrowLeft, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIGGERS = [
  { value: 'TASK_CREATED', label: 'Task Created', desc: 'When any task is created in this project', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  { value: 'TASK_STATUS_CHANGED', label: 'Status Changed', desc: 'When a task is moved to a different column', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  { value: 'TASK_ASSIGNED', label: 'Task Assigned', desc: 'When a task is assigned to a member', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  { value: 'TASK_PRIORITY_CHANGED', label: 'Priority Changed', desc: 'When a task priority is updated', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  { value: 'TASK_DEADLINE_APPROACHING', label: 'Deadline Approaching', desc: 'When a task deadline is 24 hours away', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  { value: 'SPRINT_STARTED', label: 'Sprint Started', desc: 'When a sprint is started', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  { value: 'SPRINT_COMPLETED', label: 'Sprint Completed', desc: 'When a sprint is completed', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
]

const ACTION_TYPES = [
  { value: 'SET_STATUS', label: 'Set Status', fields: [{ key: 'status', label: 'New Status', type: 'text' }] },
  { value: 'SET_PRIORITY', label: 'Set Priority', fields: [{ key: 'priority', label: 'Priority', type: 'priority-select' }] },
  { value: 'ASSIGN_TO_MEMBER', label: 'Assign to Member', fields: [{ key: 'userId', label: 'Member', type: 'member-select' }] },
  { value: 'UNASSIGN_TASK', label: 'Unassign Task', fields: [] },
  { value: 'ADD_TAG', label: 'Add Tag', fields: [{ key: 'tagName', label: 'Tag Name', type: 'text' }] },
  { value: 'SEND_NOTIFICATION', label: 'Send Notification', fields: [{ key: 'to', label: 'Send To', type: 'recipient-select' }, { key: 'message', label: 'Message', type: 'text' }] },
  { value: 'MOVE_TO_SPRINT', label: 'Move to Sprint', fields: [{ key: 'sprintId', label: 'Sprint', type: 'sprint-select' }] },
  { value: 'REMOVE_FROM_SPRINT', label: 'Remove from Sprint', fields: [] },
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const RECIPIENTS = ['ASSIGNEE', 'MANAGERS', 'ALL']
const CONDITION_FIELDS = ['fromStatus', 'toStatus', 'priority', 'hasAssignee', 'tagName']

const STEP_LABELS = ['Trigger', 'Conditions', 'Actions', 'Name & Save']

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionForm { type: string; params: Record<string, string> }
interface FormData {
  name: string
  description: string
  trigger: string
  conditions: Record<string, string>
  actions: ActionForm[]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionParamField({ field, value, onChange, projectId }: {
  field: { key: string; label: string; type: string }
  value: string
  onChange: (v: string) => void
  projectId: string
}) {
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const r = await axios.get(`${API}/api/projects/${projectId}/members`, { withCredentials: true })
      return r.data
    },
    enabled: field.type === 'member-select',
  })

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const r = await axios.get(`${API}/api/projects/${projectId}/sprints`, { withCredentials: true })
      return r.data
    },
    enabled: field.type === 'sprint-select',
  })

  if (field.type === 'priority-select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">Select priority...</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    )
  }

  if (field.type === 'recipient-select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">Send to...</option>
        {RECIPIENTS.map((r) => <option key={r} value={r}>{r === 'ASSIGNEE' ? 'Task Assignee' : r === 'MANAGERS' ? 'Managers' : 'All Members'}</option>)}
      </select>
    )
  }

  if (field.type === 'member-select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">Select member...</option>
        {members.map((m: any) => (
          <option key={m.userId} value={m.userId}>{m.user?.name ?? m.user?.email ?? m.userId}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'sprint-select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">Select sprint...</option>
        {sprints.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    )
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
      className="h-8 text-sm"
    />
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  existingRule?: any | null
}

export default function RuleBuilderModal({ open, onClose, projectId, existingRule }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const isEdit = !!existingRule

  const defaultValues: FormData = {
    name: '',
    description: '',
    trigger: '',
    conditions: {},
    actions: [],
  }

  const { handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<FormData>({
    defaultValues,
  })

  const { fields: actionFields, append, remove } = useFieldArray({ control, name: 'actions' })

  // Populate form when editing
  useEffect(() => {
    if (open && existingRule) {
      reset({
        name: existingRule.name ?? '',
        description: existingRule.description ?? '',
        trigger: existingRule.trigger ?? '',
        conditions: (existingRule.conditions as Record<string, string>) ?? {},
        actions: (existingRule.actions as ActionForm[]) ?? [],
      })
      setStep(0)
    } else if (open && !existingRule) {
      reset(defaultValues)
      setStep(0)
    }
  }, [open, existingRule])

  const selectedTrigger = watch('trigger')
  const conditions = watch('conditions')
  const actions = watch('actions')

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        trigger: data.trigger,
        conditions: Object.keys(data.conditions).length ? data.conditions : undefined,
        actions: data.actions,
      }
      const r = await axios.post(`${API}/api/projects/${projectId}/automations`, payload, { withCredentials: true })
      return r.data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations', projectId] }); onClose() },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        trigger: data.trigger,
        conditions: Object.keys(data.conditions).length ? data.conditions : null,
        actions: data.actions,
      }
      const r = await axios.patch(`${API}/api/projects/${projectId}/automations/${existingRule.id}`, payload, { withCredentials: true })
      return r.data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations', projectId] }); onClose() },
  })

  const onSubmit = handleSubmit((data) => {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  })

  const canNextStep0 = !!selectedTrigger
  const canNextStep2 = actions.length > 0

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border shrink-0">
                <div className="flex items-center justify-center size-9 rounded-xl bg-primary/15 border border-primary/25">
                  <Zap className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">{isEdit ? 'Edit Rule' : 'New Automation Rule'}</h2>
                  <p className="text-xs text-muted-foreground">Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose} id="btn-close-rule-builder">
                  <X className="size-4" />
                </Button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border/50 shrink-0">
                {STEP_LABELS.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-1">
                    <div className={cn(
                      'flex items-center justify-center size-5 rounded-full text-xs font-medium shrink-0 transition-colors',
                      i < step ? 'bg-primary text-primary-foreground' :
                        i === step ? 'bg-primary/20 text-primary border border-primary/40' :
                          'bg-muted text-muted-foreground'
                    )}>
                      {i < step ? <Check className="size-3" /> : i + 1}
                    </div>
                    <span className={cn('text-xs hidden sm:block', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {label}
                    </span>
                    {i < STEP_LABELS.length - 1 && (
                      <ChevronRight className="size-3 text-muted-foreground/40 ml-auto" />
                    )}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
                <AnimatePresence mode="wait">
                  {/* Step 0: Trigger */}
                  {step === 0 && (
                    <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <p className="text-sm text-muted-foreground mb-4">Choose what event triggers this automation:</p>
                      <div className="grid grid-cols-1 gap-2.5">
                        {TRIGGERS.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            id={`trigger-${t.value}`}
                            onClick={() => setValue('trigger', t.value)}
                            className={cn(
                              'flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all',
                              selectedTrigger === t.value
                                ? `${t.bg} border-current shadow-sm`
                                : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                            )}
                          >
                            <div className={cn('shrink-0 font-bold text-lg', selectedTrigger === t.value ? t.color : 'text-muted-foreground')}>⚡</div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{t.label}</div>
                              <div className="text-xs text-muted-foreground">{t.desc}</div>
                            </div>
                            {selectedTrigger === t.value && (
                              <Check className={cn('size-4 ml-auto shrink-0', t.color)} />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1: Conditions */}
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <p className="text-sm text-muted-foreground mb-4">
                        Optionally narrow when this rule fires. Leave all blank to match every event.
                      </p>
                      <div className="space-y-3">
                        {CONDITION_FIELDS.map((field) => (
                          <div key={field} className="grid grid-cols-[120px_1fr] gap-3 items-center">
                            <label className="text-xs font-medium text-muted-foreground capitalize">
                              {field.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            {field === 'priority' ? (
                              <select
                                value={(conditions as any)[field] ?? ''}
                                onChange={(e) => setValue(`conditions.${field}` as any, e.target.value || undefined as any)}
                                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                              >
                                <option value="">Any priority</option>
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            ) : field === 'hasAssignee' ? (
                              <select
                                value={(conditions as any)[field] ?? ''}
                                onChange={(e) => setValue(`conditions.${field}` as any, e.target.value as any)}
                                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                              >
                                <option value="">Either</option>
                                <option value="true">Has assignee</option>
                                <option value="false">Unassigned</option>
                              </select>
                            ) : (
                              <Input
                                value={(conditions as any)[field] ?? ''}
                                onChange={(e) => setValue(`conditions.${field}` as any, e.target.value as any)}
                                placeholder={`e.g. ${field === 'fromStatus' ? 'IN_REVIEW' : field === 'toStatus' ? 'DONE' : field === 'tagName' ? 'bug' : '...'}`}
                                className="h-8 text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Actions */}
                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <p className="text-sm text-muted-foreground mb-4">Define what happens when this rule fires. Actions run in order.</p>
                      <div className="space-y-3 mb-4">
                        {actionFields.map((field, idx) => {
                          const actionDef = ACTION_TYPES.find((a) => a.value === actions[idx]?.type)
                          return (
                            <div key={field.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Action {idx + 1}
                                </span>
                                <div className="flex-1" />
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(idx)}>
                                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>

                              <Controller
                                control={control}
                                name={`actions.${idx}.type`}
                                render={({ field: f }) => (
                                  <select
                                    value={f.value}
                                    onChange={(e) => {
                                      f.onChange(e.target.value)
                                      setValue(`actions.${idx}.params`, {})
                                    }}
                                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  >
                                    <option value="">Choose action type...</option>
                                    {ACTION_TYPES.map((a) => (
                                      <option key={a.value} value={a.value}>{a.label}</option>
                                    ))}
                                  </select>
                                )}
                              />

                              {actionDef?.fields.map((paramField) => (
                                <Controller
                                  key={paramField.key}
                                  control={control}
                                  name={`actions.${idx}.params.${paramField.key}` as any}
                                  render={({ field: f }) => (
                                    <div>
                                      <label className="text-xs text-muted-foreground mb-1 block">{paramField.label}</label>
                                      <ActionParamField
                                        field={paramField}
                                        value={f.value ?? ''}
                                        onChange={f.onChange}
                                        projectId={projectId}
                                      />
                                    </div>
                                  )}
                                />
                              ))}
                            </div>
                          )
                        })}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 w-full"
                        id="btn-add-action"
                        onClick={() => append({ type: '', params: {} })}
                      >
                        <Plus className="size-3.5" />
                        Add Action
                      </Button>
                    </motion.div>
                  )}

                  {/* Step 3: Name & Save */}
                  {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Rule Name <span className="text-destructive">*</span></label>
                          <Controller
                            control={control}
                            name="name"
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input
                                id="input-rule-name"
                                {...field}
                                placeholder="e.g. Auto-notify on DONE"
                                className={errors.name ? 'border-destructive' : ''}
                              />
                            )}
                          />
                          {errors.name && <p className="text-xs text-destructive mt-1">Name is required</p>}
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Description <span className="text-muted-foreground text-xs">(optional)</span></label>
                          <Controller
                            control={control}
                            name="description"
                            render={({ field }) => (
                              <Input
                                id="input-rule-description"
                                {...field}
                                placeholder="Briefly describe what this rule does..."
                              />
                            )}
                          />
                        </div>

                        {/* Summary */}
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
                          <div className="text-sm space-y-1.5">
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">Trigger:</span>
                              <span className="font-medium">{TRIGGERS.find(t => t.value === selectedTrigger)?.label ?? '—'}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">Conditions:</span>
                              <span>{Object.values(conditions).filter(Boolean).length} active</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">Actions:</span>
                              <span>{actions.length} defined</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
                  id="btn-step-back"
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  {step === 0 ? 'Cancel' : 'Back'}
                </Button>

                {step < STEP_LABELS.length - 1 ? (
                  <Button
                    size="sm"
                    id="btn-step-next"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={(step === 0 && !canNextStep0) || (step === 2 && !canNextStep2)}
                    className="gap-1.5"
                  >
                    Continue
                    <ChevronRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    id="btn-save-rule"
                    onClick={onSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="gap-1.5"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
                    <Check className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
