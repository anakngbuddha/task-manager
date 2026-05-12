import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getConsent, setConsent } from '@/lib/consent'

interface CookiePreferencesProps {
  open: boolean
  onClose: () => void
}

export default function CookiePreferences({ open, onClose }: CookiePreferencesProps) {
  const [analytics, setAnalytics] = useState(false)
  const [preferences, setPreferences] = useState(false)

  useEffect(() => {
    if (open) {
      setAnalytics(getConsent('analytics'))
      setPreferences(getConsent('preferences'))
    }
  }, [open])

  const handleSave = async () => {
    await setConsent({ analytics, preferences })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
          <DialogDescription>
            Manage how we use cookies and tracking technologies.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex items-start justify-between space-x-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Essential (Strictly Necessary)</h4>
              <p className="text-sm text-muted-foreground">
                Required for the app to function properly, including secure login and session management. Cannot be disabled.
              </p>
            </div>
            <div className="shrink-0 pt-1">
              {/* Always on toggle */}
              <div className="w-9 h-5 bg-primary rounded-full relative opacity-50 cursor-not-allowed">
                <div className="absolute right-0.5 top-0.5 bg-white w-4 h-4 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between space-x-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Analytics & Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Helps us understand how you use the app by tracking page visits and clicks so we can improve the experience.
              </p>
            </div>
            <div className="shrink-0 pt-1">
              <button 
                type="button"
                role="switch"
                aria-checked={analytics}
                onClick={() => setAnalytics(!analytics)}
                className={`w-9 h-5 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${analytics ? 'bg-primary' : 'bg-input'}`}
              >
                <div className="absolute top-0.5 bg-white w-4 h-4 rounded-full transition-transform" style={{ transform: analytics ? 'translateX(16px)' : 'translateX(2px)' }} />
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between space-x-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Preferences</h4>
              <p className="text-sm text-muted-foreground">
                Remembers your customized UI layout and settings, like whether your sidebar is open or closed.
              </p>
            </div>
            <div className="shrink-0 pt-1">
              <button 
                type="button"
                role="switch"
                aria-checked={preferences}
                onClick={() => setPreferences(!preferences)}
                className={`w-9 h-5 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${preferences ? 'bg-primary' : 'bg-input'}`}
              >
                <div className="absolute top-0.5 bg-white w-4 h-4 rounded-full transition-transform" style={{ transform: preferences ? 'translateX(16px)' : 'translateX(2px)' }} />
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
