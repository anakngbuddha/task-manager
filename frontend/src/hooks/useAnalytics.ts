import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Simple helper to post an event to our backend
export async function trackEvent(eventType: string, data: { pageUrl?: string; elementId?: string; metadata?: any } = {}) {
  try {
    const session = localStorage.getItem('__better-auth-session') || sessionStorage.getItem('__better-auth-session')
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Attempt extracting token if better-auth stores it locally, otherwise rely on cookies.
    if (session) {
       try {
         const parsed = JSON.parse(session)
         if (parsed.token) {
           headers['Authorization'] = `Bearer ${parsed.token}`
         }
       } catch (e) {}
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    await fetch(`${API_URL}/analytics/event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventType,
        pageUrl: window.location.pathname,
        elementId: data.elementId,
        metadata: data.metadata,
      }),
    })
  } catch (error) {
    console.error('Failed to track event', error)
  }
}

export function useAnalytics() {
  const location = useLocation()

  // Track page views automatically on route change
  useEffect(() => {
    trackEvent('PAGE_VIEW', { pageUrl: location.pathname })
  }, [location.pathname])

  // Optional: Global click tracking could be added here,
  // but to only track meaningful interactions, we export `trackEvent` 
  // and use it on specific buttons (like create project, complete task, etc)
}

// Global click listener for elements with data-analytic-id
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    // Travel up the dom tree to find the nearest tracked element
    const trackedElement = target.closest('[data-analytic-id]')
    if (trackedElement) {
      const elementId = trackedElement.getAttribute('data-analytic-id')
      if (elementId) {
        trackEvent('CLICK', { elementId })
      }
    }
  })

  // Global error listener
  window.addEventListener('error', (e) => {
    trackEvent('ERROR', { 
      elementId: e.message,
      metadata: { source: e.filename, lineno: e.lineno } 
    })
  })
}
