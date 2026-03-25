import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CalendarPlus } from 'lucide-react'

function getCurrentStartLocalForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

interface CreateSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManageRoles: boolean
  isPending: boolean
  onSubmit: (data: {
    name: string
    goal?: string
    startDate: string
    endDate: string
  }) => Promise<void>
}

export default function CreateSprintDialog({
  open,
  onOpenChange,
  canManageRoles,
  isPending,
  onSubmit,
}: CreateSprintDialogProps) {
  const [sprintName, setSprintName] = useState('')
  const [sprintGoal, setSprintGoal] = useState('')
  const [sprintStart, setSprintStart] = useState('')
  const [sprintEnd, setSprintEnd] = useState('')
  const [sprintError, setSprintError] = useState('')

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sprintName.trim() || !sprintStart || !sprintEnd) return

    const start = new Date(sprintStart)
    const end = new Date(sprintEnd)
    if (end <= start) {
      setSprintError('End date must be after start date')
      return
    }

    setSprintError('')
    await onSubmit({
      name: sprintName.trim(),
      goal: sprintGoal.trim() ? sprintGoal.trim() : undefined,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })

    setSprintName('')
    setSprintGoal('')
    setSprintStart('')
    setSprintEnd('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-2" disabled={!canManageRoles}>
          <CalendarPlus className="size-4" />
          Create Sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateSprint} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              className="h-10"
              placeholder="Sprint name"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Goal</Label>
            <Input
              className="h-10"
              placeholder="What are we aiming to deliver?"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="datetime-local"
                className="h-10"
                value={sprintStart}
                min={getCurrentStartLocalForInput()}
                onChange={(e) => setSprintStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input
                type="datetime-local"
                className="h-10"
                value={sprintEnd}
                min={sprintStart || getCurrentStartLocalForInput()}
                onChange={(e) => setSprintEnd(e.target.value)}
              />
            </div>
          </div>
          {sprintError && (
            <p className="text-xs text-red-500">{sprintError}</p>
          )}
          <Button
            type="submit"
            className="h-10 w-full"
            disabled={
              isPending ||
              !sprintName.trim() ||
              !sprintStart ||
              !sprintEnd
            }
          >
            {isPending ? 'Creating…' : 'Create sprint'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
