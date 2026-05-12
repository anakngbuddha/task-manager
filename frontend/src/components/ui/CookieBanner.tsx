import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { hasConsented, setConsent } from '@/lib/consent'
import CookiePreferences from './CookiePreferences'

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    // Slight delay to not flash on initial load
    const timer = setTimeout(() => {
      if (!hasConsented()) {
        setShow(true)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const handleAcceptAll = async () => {
    await setConsent({ analytics: true, preferences: true })
    setShow(false)
  }

  const handleEssentialOnly = async () => {
    await setConsent({ analytics: false, preferences: false })
    setShow(false)
  }

  if (!show) {
    if (showPreferences) {
      return <CookiePreferences open={true} onClose={() => setShowPreferences(false)} />
    }
    return null
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none md:p-6">
        <div className="mx-auto max-w-5xl pointer-events-auto bg-background/95 backdrop-blur-md border shadow-lg rounded-xl p-4 sm:p-6 flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-semibold">We value your privacy</h3>
            <p className="text-sm text-muted-foreground">
              We use cookies and similar technologies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              Read our <Link to="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link> to learn more.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
            <Button variant="outline" onClick={() => setShowPreferences(true)} className="w-full sm:w-auto shrink-0">
              Customize
            </Button>
            <Button variant="secondary" onClick={handleEssentialOnly} className="w-full sm:w-auto shrink-0">
              Essential Only
            </Button>
            <Button onClick={handleAcceptAll} className="w-full sm:w-auto shrink-0">
              Accept All
            </Button>
          </div>
        </div>
      </div>
      
      {showPreferences && (
        <CookiePreferences 
          open={showPreferences} 
          onClose={() => {
            setShowPreferences(false)
            if (hasConsented()) setShow(false)
          }} 
        />
      )}
    </>
  )
}
