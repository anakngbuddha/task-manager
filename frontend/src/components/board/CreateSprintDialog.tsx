import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CalendarPlus } from 'lucide-react'

interface CreateSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManageRoles: boolean
  isPending: boolean
  onSubmit: (data: {
    name: string
    goal?: string
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

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sprintName.trim()) return

    await onSubmit({
      name: sprintName.trim(),
      goal: sprintGoal.trim() ? sprintGoal.trim() : undefined,
    })

    setSprintName('')
    setSprintGoal('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-9 gap-2 border-0 bg-muted text-foreground hover:bg-muted/80" disabled={!canManageRoles}>
          <CalendarPlus className="size-4" />
          Create Sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create sprint</DialogTitle>
          <DialogDescription>
            Create a new sprint in planning. Add tasks and start it when you're ready.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateSprint} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              className="h-10"
              placeholder="Sprint name (e.g. Sprint 1)"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Goal <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              className="h-10"
              placeholder="What are we aiming to deliver?"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Dates will be set when you start the sprint.
          </p>
          <Button
            type="submit"
            className="h-10 w-full"
            disabled={isPending || !sprintName.trim()}
          >
            {isPending ? 'Creating...' : 'Create sprint'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
