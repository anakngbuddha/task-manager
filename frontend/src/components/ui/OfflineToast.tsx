import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { WifiOff, CheckCircle2, X } from 'lucide-react'

type ToastType = 'success' | 'offline' | 'error'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface OfflineToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const OfflineToastContext = createContext<OfflineToastContextValue>({
  showToast: () => {},
})

export function useOfflineToast() {
  return useContext(OfflineToastContext)
}

export function OfflineToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'offline') => {
    const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <OfflineToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </OfflineToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))

    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const icon = toast.type === 'offline' ? (
    <WifiOff className="size-4 shrink-0 text-amber-400" />
  ) : toast.type === 'error' ? (
    <X className="size-4 shrink-0 text-red-400" />
  ) : (
    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
  )

  const borderColor = toast.type === 'offline'
    ? 'border-amber-500/30'
    : toast.type === 'error'
      ? 'border-red-500/30'
      : 'border-emerald-500/30'

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 rounded-lg border
        ${borderColor} bg-background/95 px-4 py-3 shadow-xl backdrop-blur-sm
        transition-all duration-300 ease-out max-w-[340px]
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}
      `}
    >
      {icon}
      <p className="text-sm text-foreground/90">{toast.message}</p>
      <button
        type="button"
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        className="ml-auto shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
