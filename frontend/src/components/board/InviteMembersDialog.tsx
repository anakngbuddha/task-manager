import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { UserPlus } from 'lucide-react'

interface InviteMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerateInvite: () => Promise<string>
}

export default function InviteMembersDialog({
  open,
  onOpenChange,
  onGenerateInvite,
}: InviteMembersDialogProps) {
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="h-9 gap-2 border-0 bg-muted text-foreground hover:bg-muted/80"
          onClick={async () => {
            const url = await onGenerateInvite()
            setGeneratedInviteUrl(url)
            onOpenChange(true)
          }}
        >
          <UserPlus className="size-4" />
          Invite members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members to this project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Share this link with teammates. If they don&apos;t have an account yet,
            they&apos;ll be asked to register first and can then join this project
            using the same link.
          </p>
          <div className="space-y-1">
            <Label>Invite link</Label>
            <Input
              readOnly
              value={generatedInviteUrl}
              className="h-10"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
