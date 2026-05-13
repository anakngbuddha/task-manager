import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, ListTodo, AlignLeft, ChevronDown } from 'lucide-react'
import { TASK_TYPE_CONFIG, VALID_PARENT_TYPES } from '@/lib/taskTypes'
import type { TaskType } from '@/lib/taskTypes'

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  READY: 'Ready',
}

function getCurrentStartLocalForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function isPastTime(value: string) {
  const selected = new Date(value)
  const now = new Date()
  return selected.getTime() < now.getTime()
}

function normalizeStatus(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '_')
}

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTriggerClick: () => void
  canCreateTask: boolean
  projectColumns: string[]
  members: any[]
  sprints: any[]
  isPending: boolean
  onSubmit: (data: {
    title: string
    description: string
    priority: string
    assigneeId: string
    status: string
    sprintId: string | null
    deadline: string
    type: TaskType
    parentId: string | null
  }, subtasks?: string[]) => Promise<void>
  defaultStatus: string
  /** All project tasks – used to populate parent picker */
  allTasks?: any[]
}

export default function CreateTaskDialog({
  open,
  onOpenChange,
  onTriggerClick,
  canCreateTask,
  projectColumns,
  members,
  sprints,
  isPending,
  onSubmit,
  defaultStatus,
  allTasks = [],
}: CreateTaskDialogProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newAssigneeId, setNewAssigneeId] = useState<string>('')
  const [newDeadline, setNewDeadline] = useState('')
  const [deadlineError, setDeadlineError] = useState('')
  const [newStatus, setNewStatus] = useState<string>(defaultStatus)
  const [newCustomStatus, setNewCustomStatus] = useState('')
  const [newSprintId, setNewSprintId] = useState<string>('')

  // Type & parent
  const [taskType, setTaskType] = useState<TaskType | ''>('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [parentSearch, setParentSearch] = useState('')
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false)
  const parentDropdownRef = useRef<HTMLDivElement>(null)

  const [subtasks, setSubtasks] = useState<string[]>([])
  const [subtaskInput, setSubtaskInput] = useState('')

  // Close parent dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(e.target as Node)) {
        setParentDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const validParentTypes = taskType ? VALID_PARENT_TYPES[taskType] : []
  const filteredParentTasks = allTasks.filter(
    (t: any) =>
      validParentTypes.includes(t.type as TaskType) &&
      (parentSearch === '' || t.title.toLowerCase().includes(parentSearch.toLowerCase()))
  )
  const selectedParentTask = allTasks.find((t: any) => t.id === parentId)

  const handleAddSubtask = () => {
    if (subtaskInput.trim()) {
      setSubtasks([...subtasks, subtaskInput.trim()])
      setSubtaskInput('')
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const resolvedStatus = newStatus === '__CUSTOM__'
      ? normalizeStatus(newCustomStatus)
      : newStatus

    if (!newTitle.trim() || !newDescription.trim() || !newAssigneeId || !resolvedStatus || !newPriority || !newDeadline) {
      setDeadlineError('All task fields are required to be filled out.')
      return
    }
    if (!taskType) {
      setDeadlineError('Please select a task type (Epic, Story, or Task).')
      return
    }
    if (!newSprintId) {
      setDeadlineError('Please select Sprint or No sprint.')
      return
    }

    if (newDeadline) {
      const selected = new Date(newDeadline)
      const now = new Date()
      if (selected.getTime() < now.getTime()) {
        setDeadlineError('Deadline cannot be in the past')
        return
      }
    }

    setDeadlineError('')
    await onSubmit({
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
      assigneeId: newAssigneeId,
      status: resolvedStatus,
      sprintId: newSprintId === 'NONE' ? null : newSprintId,
      deadline: new Date(newDeadline).toISOString(),
      type: taskType,
      parentId,
    }, subtasks)

    // Reset
    setNewTitle('')
    setNewDescription('')
    setNewPriority('MEDIUM')
    setNewAssigneeId('')
    setNewDeadline('')
    setNewStatus(defaultStatus)
    setNewCustomStatus('')
    setNewSprintId('')
    setSubtasks([])
    setSubtaskInput('')
    setTaskType('')
    setParentId(null)
    setParentSearch('')
    onOpenChange(false)
  }

  const TASK_TYPES: TaskType[] = ['EPIC', 'STORY', 'TASK']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="h-9 gap-2 shadow-sm"
          disabled={!canCreateTask}
          onClick={onTriggerClick}
        >
          <Plus className="size-4" />
          Create Task
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl xl:max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-xl border border-border shadow-lg">

        <DialogHeader className="shrink-0 px-6 py-4 border-b bg-muted/20">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateTask} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-muted">

            {/* Core Details */}
            <div className="space-y-5">
              <div>
                <Label className="sr-only">Task Title</Label>
                <Input
                  autoFocus
                  placeholder="Task title..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="h-12 text-lg sm:text-xl font-semibold bg-transparent border-0 border-b border-input shadow-none px-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary placeholder:text-muted-foreground/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <AlignLeft className="size-3.5" /> Description
                </Label>
                <textarea
                  placeholder="What needs to be done?"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="min-h-[100px] sm:min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 resize-y"
                />
              </div>
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 p-5 rounded-lg bg-muted/20 border border-border/50 shadow-sm">

              {/* Type — segmented control (full width) */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Type *</Label>
                <div className="flex gap-2 flex-wrap">
                  {TASK_TYPES.map((type) => {
                    const cfg = TASK_TYPE_CONFIG[type]
                    const isSelected = taskType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        id={`task-type-${type.toLowerCase()}`}
                        onClick={() => {
                          setTaskType(type)
                          setParentId(null)
                          setParentSearch('')
                        }}
                        className={[
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-all',
                          isSelected
                            ? `${cfg.badgeColor} ${cfg.textColor} ${cfg.borderColor} shadow-sm`
                            : 'bg-background text-muted-foreground border-border hover:bg-muted/50',
                        ].join(' ')}
                      >
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
                {/* Epic notice */}
                {taskType === 'EPIC' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚡ Epics typically span multiple sprints and are not assigned to a single sprint.
                  </p>
                )}
              </div>

              {/* Parent picker — only for STORY and TASK */}
              {validParentTypes.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2" ref={parentDropdownRef}>
                  <Label className="text-xs font-semibold text-muted-foreground tracking-wide">
                    {taskType === 'STORY' ? 'Parent Epic' : 'Parent Epic / Story'}
                  </Label>
                  <div className="relative">
                    <button
                      type="button"
                      id="parent-task-picker"
                      onClick={() => setParentDropdownOpen((v) => !v)}
                      className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm shadow-sm hover:bg-muted/30 transition-colors"
                    >
                      {selectedParentTask ? (
                        <span className="flex items-center gap-1.5">
                          <span>{TASK_TYPE_CONFIG[selectedParentTask.type as TaskType]?.icon}</span>
                          <span className="truncate">{selectedParentTask.title}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select {taskType === 'STORY' ? 'an Epic' : 'a parent'}... (optional)
                        </span>
                      )}
                      <ChevronDown className="size-3.5 text-muted-foreground ml-2 shrink-0" />
                    </button>

                    {parentDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-lg">
                        <div className="p-2 border-b border-border">
                          <Input
                            autoFocus
                            placeholder="Search..."
                            value={parentSearch}
                            onChange={(e) => setParentSearch(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {/* Clear option */}
                          {parentId && (
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
                              onClick={() => { setParentId(null); setParentDropdownOpen(false) }}
                            >
                              <X className="size-3.5" /> Clear selection
                            </button>
                          )}
                          {filteredParentTasks.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                              No {validParentTypes.join(' / ')} tasks found.
                            </p>
                          ) : (
                            filteredParentTasks.map((t: any) => (
                              <button
                                key={t.id}
                                type="button"
                                className={[
                                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                                  parentId === t.id ? 'bg-muted/60 font-medium' : '',
                                ].join(' ')}
                                onClick={() => { setParentId(t.id); setParentDropdownOpen(false); setParentSearch('') }}
                              >
                                <span>{TASK_TYPE_CONFIG[t.type as TaskType]?.icon}</span>
                                <span className="truncate">{t.title}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Optional — Epics span multiple sprints
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9 bg-background shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projectColumns.map((s: string) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                    <SelectItem value="__CUSTOM__">Custom status...</SelectItem>
                  </SelectContent>
                </Select>
                {newStatus === '__CUSTOM__' && (
                  <Input
                    className="mt-2 h-9 text-sm shadow-sm"
                    placeholder="e.g. QA_TESTING"
                    value={newCustomStatus}
                    onChange={(e) => setNewCustomStatus(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="h-9 bg-background shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Assignee</Label>
                <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                  <SelectTrigger className="h-9 bg-background shadow-sm"><SelectValue placeholder="Select assignee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVERYONE">Everyone (Shared task)</SelectItem>
                    {members
                      .map((m: any) => m?.user)
                      .filter(Boolean)
                      .map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Sprint *</Label>
                <Select value={newSprintId} onValueChange={setNewSprintId}>
                  <SelectTrigger className="h-9 bg-background shadow-sm"><SelectValue placeholder="Select sprint scope" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No sprint</SelectItem>
                    {(sprints as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide">Deadline</Label>
                <Input
                  type="datetime-local"
                  className="h-9 bg-background text-sm shadow-sm"
                  value={newDeadline}
                  min={getCurrentStartLocalForInput()}
                  onChange={e => {
                    const v = e.target.value
                    if (!v) {
                      setNewDeadline('')
                      setDeadlineError('')
                      return
                    }
                    if (isPastTime(v)) {
                      setDeadlineError('Deadline cannot be in the past')
                      return
                    }
                    setDeadlineError('')
                    setNewDeadline(v)
                  }}
                />
              </div>
            </div>

            {/* Subtasks Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListTodo className="size-4 text-muted-foreground" />
                Subtasks
              </div>

              <div className="space-y-2">
                {subtasks.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-muted/50 p-2 sm:p-3 bg-muted/10">
                    {subtasks.map((st, i) => (
                      <div key={i} className="flex items-center justify-between group rounded-md border px-3 py-2 bg-background text-sm shadow-sm">
                        <span className="font-medium text-foreground">{st}</span>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Add a subtask..."
                    value={subtaskInput}
                    onChange={e => setSubtaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSubtask()
                      }
                    }}
                    className="h-9 shadow-sm"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddSubtask} className="h-9 shrink-0 px-4 rounded-md">
                    <Plus className="size-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

          </div>

          <DialogFooter className="shrink-0 px-5 sm:px-6 py-4 border-t bg-muted/20">
             <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-auto text-center sm:text-left">
                  {deadlineError && <p className="text-sm font-medium text-destructive">{deadlineError}</p>}
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  <Button type="button" variant="outline" className="w-full sm:w-auto min-w-[100px] shadow-sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" disabled={isPending} className="w-full sm:w-auto px-6 font-medium shadow-sm">
                    {isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
             </div>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  )
}
