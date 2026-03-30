import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { Sprint } from '@/hooks/useSprints'

const DONE_STATUSES = ['DONE', 'READY']

interface CompleteSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sprint: Sprint
  allSprints: Sprint[]
  isPending: boolean
  onSubmit: (data: { moveIncompleteTasksTo: string }) => Promise<void>
}

export default function CompleteSprintDialog({
  open,
  onOpenChange,
  sprint,
  allSprints,
  isPending,
  onSubmit,
}: CompleteSprintDialogProps) {
  const [moveTarget, setMoveTarget] = useState('BACKLOG')

  const completedTasks = useMemo(
    () => (sprint.tasks ?? []).filter((t) => DONE_STATUSES.includes(t.status)),
    [sprint.tasks]
  )
  const incompleteTasks = useMemo(
    () => (sprint.tasks ?? []).filter((t) => !DONE_STATUSES.includes(t.status)),
    [sprint.tasks]
  )

  const availableSprints = useMemo(
    () => allSprints.filter((s) => s.id !== sprint.id && s.status !== 'COMPLETED'),
    [allSprints, sprint.id]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({ moveIncompleteTasksTo: moveTarget })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Sprint: {sprint.name}</DialogTitle>
          <DialogDescription>
            This sprint will be marked as completed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>{completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''} completed</span>
            </div>

            {incompleteTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  <span>{incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''} incomplete</span>
                </div>

                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {incompleteTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs py-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase font-semibold shrink-0">
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Move incomplete tasks to:</Label>
                  <Select value={moveTarget} onValueChange={setMoveTarget}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACKLOG">Backlog (no sprint)</SelectItem>
                      {availableSprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.status.toLowerCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="h-10 w-full" disabled={isPending}>
            {isPending ? 'Completing...' : 'Complete Sprint'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
