/**
 * analytics.ts
 * Lightweight client-side event tracker. Sends typed analytics events
 * to the backend /api/analytics/event endpoint (fire-and-forget).
 *
 * Usage:
 *   import { trackEvent } from '@/lib/analytics'
 *   trackEvent('TASK_CREATED', { metadata: { projectId } })
 *   trackEvent('FEATURE_USED', { elementId: 'github_integration' })
 */

import { api } from './api'

export type AnalyticsEventType =
  | 'PAGE_VIEW'
  | 'CLICK'
  | 'ERROR'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'FEATURE_USED'
  | 'SEARCH'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'

interface TrackOptions {
  /** The page/route where the event happened. Defaults to window.location.pathname */
  pageUrl?: string
  /** Element ID or feature name for CLICK / FEATURE_USED events */
  elementId?: string
  /** Any extra serialisable data to attach */
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget analytics event. Never throws — failures are silently
 * swallowed so tracking bugs never surface to the user.
 */
export function trackEvent(type: AnalyticsEventType, options: TrackOptions = {}): Promise<void> {
  const payload = {
    eventType: type,
    pageUrl: options.pageUrl ?? window.location.pathname,
    elementId: options.elementId ?? null,
    metadata: options.metadata ?? null,
  }

  return api.post('/analytics/event', payload).then(() => {}).catch(() => {
    // intentionally silent — analytics should never break the app
  })
}

/**
 * Call once on app mount to track application sessions.
 * Sends SESSION_START and attaches a beforeunload listener for SESSION_END.
 */
export function initSessionTracking(): void {
  trackEvent('SESSION_START', {
    metadata: {
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  })

  const handleUnload = () => {
    // Use the tracked API to send SESSION_END. On browsers that support
    // keepalive fetch, this survives page unload while preserving cookies.
    // Falls back to sendBeacon (which may lack cookie context) as a last resort.
    const payload = {
      eventType: 'SESSION_END',
      pageUrl: window.location.pathname,
    }
    const apiBase =
      (import.meta.env.VITE_API_URL as string | undefined) ??
      'http://localhost:3000/api'
    const url = `${apiBase}/analytics/event`

    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        keepalive: true,
      })
    } catch {
      navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    }
  }

  window.addEventListener('beforeunload', handleUnload)
}
