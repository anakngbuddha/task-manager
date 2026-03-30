import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Sprint } from '@/hooks/useSprints'

function toLocalDatetimeInput(date?: Date | string | null) {
  if (!date) {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60_000)
    return local.toISOString().slice(0, 16)
  }
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function addWeeks(date: Date, weeks: number) {
  return new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
}

interface StartSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sprint: Sprint
  isPending: boolean
  onSubmit: (data: { startDate: string; endDate: string }) => Promise<void>
}

export default function StartSprintDialog({
  open,
  onOpenChange,
  sprint,
  isPending,
  onSubmit,
}: StartSprintDialogProps) {
  const defaultStart = toLocalDatetimeInput()
  const defaultEnd = toLocalDatetimeInput(addWeeks(new Date(), 2))

  const [startDate, setStartDate] = useState(sprint.startDate ? toLocalDatetimeInput(sprint.startDate) : defaultStart)
  const [endDate, setEndDate] = useState(sprint.endDate ? toLocalDatetimeInput(sprint.endDate) : defaultEnd)
  const [error, setError] = useState('')

  const taskCount = sprint.tasks?.length ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) return

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) {
      setError('End date must be after start date')
      return
    }

    setError('')
    await onSubmit({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Sprint: {sprint.name}</DialogTitle>
          <DialogDescription>
            {taskCount} task{taskCount !== 1 ? 's' : ''} will be included in this sprint.
            {sprint.goal && (
              <span className="block mt-1 italic text-muted-foreground">Goal: {sprint.goal}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="datetime-local"
                className="h-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input
                type="datetime-local"
                className="h-10"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={isPending || !startDate || !endDate}>
            {isPending ? 'Starting...' : 'Start Sprint'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
