import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const onGenerateInviteRef = useRef(onGenerateInvite)

  useEffect(() => {
    onGenerateInviteRef.current = onGenerateInvite
  }, [onGenerateInvite])

  const generateInvite = async () => {
    setIsGenerating(true)
    setGenerateError('')
    try {
      const url = await onGenerateInviteRef.current()
      setGeneratedInviteUrl(url)
    } catch {
      setGeneratedInviteUrl('')
      setGenerateError('Failed to generate invite link. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void generateInvite()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members to this project</DialogTitle>
          <DialogDescription>
            Generate and share a join link for this project.
          </DialogDescription>
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
              value={isGenerating ? 'Generating invite link...' : generatedInviteUrl}
              className="h-10"
              onFocus={(e) => e.target.select()}
            />
            {generateError && (
              <p className="text-xs text-destructive">{generateError}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={isGenerating}
              onClick={async () => {
                await generateInvite()
              }}
            >
              Regenerate link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
