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

  // Track session start
  useEffect(() => {
    if (!sessionStorage.getItem('__analytics_session_started')) {
      sessionStorage.setItem('__analytics_session_started', 'true')
      
      let timeZone = 'Unknown'
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch (e) {}

      trackEvent('SESSION_START', {
        metadata: { 
          userAgent: navigator.userAgent,
          timeZone
        }
      })
    }
  }, [])

  // Optional: Global click tracking could be added here,
  // but to only track meaningful interactions, we export `trackEvent` 
  // and use it on specific buttons (like create project, complete task, etc)
}

// Helper to generate a short CSS selector path
function getDomPath(el: HTMLElement | null): string {
  const stack = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let nodeName = el.nodeName.toLowerCase();
    if (el.id) {
      stack.unshift(`${nodeName}#${el.id}`);
      break; 
    } else {
      let sibCount = 0;
      let sibIndex = 0;
      for (let i = 0; i < (el.parentNode?.childNodes.length || 0); i++) {
        const sib: ChildNode = el.parentNode!.childNodes[i];
        if (sib.nodeName === el.nodeName) {
          if (sib === el) {
            sibIndex = sibCount;
          }
          sibCount++;
        }
      }
      if (el.hasAttribute('class') && typeof el.className === 'string' && el.className.trim() !== '') {
          nodeName += '.' + el.className.trim().split(/\\s+/).join('.');
      }
      if (sibCount > 1) {
        stack.unshift(`${nodeName}:nth-of-type(${sibIndex + 1})`);
      } else {
        stack.unshift(nodeName);
      }
    }
    el = el.parentNode as HTMLElement;
  }
  return stack.slice(-3).join(' > '); 
}

// Global click listener for elements
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    
    // 1. Try explicit ID first
    let trackedElement = target.closest('[data-analytic-id]')
    let elementId = trackedElement ? trackedElement.getAttribute('data-analytic-id') : null

    // 2. Fallback to interactive elements
    if (!trackedElement) {
      trackedElement = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]')
      if (trackedElement) {
        const tagName = trackedElement.tagName.toLowerCase()
        const textContent = trackedElement.textContent ? trackedElement.textContent.trim().substring(0, 30) : ''
        
        // Generate a fallback ID
        elementId = trackedElement.getAttribute('data-analytic-id') || 
                    trackedElement.getAttribute('id') ||
                    trackedElement.getAttribute('aria-label') ||
                    trackedElement.getAttribute('name')

        // If no explicit identifier, use smart fallbacks
        if (!elementId) {
          if (tagName === 'a') {
             let href = trackedElement.getAttribute('href')
             if (href) {
               // Mask IDs in the URL for better aggregation (e.g. /projects/cm2b39... -> /projects/[id])
               href = href.replace(/\/[a-zA-Z0-9_-]{20,}/g, '/[id]')
               elementId = `Link: ${href}`
             }
          }
        }

        // If still no ID, use short text content for buttons
        if (!elementId && textContent && textContent.length < 25) {
          elementId = `Button: ${textContent}`
        }

        // Ultimate fallback
        if (!elementId) {
          elementId = `Generic ${tagName}`
        }
      }
    }

    if (trackedElement && elementId) {
      // Gather rich metadata
      const classes = typeof trackedElement.className === 'string' ? trackedElement.className : ''
      const tagName = trackedElement.tagName.toLowerCase()
      const path = getDomPath(trackedElement as HTMLElement)

      trackEvent('CLICK', { 
        elementId: elementId, 
        metadata: {
          originalText: trackedElement.textContent?.trim().substring(0, 50) || null,
          tagName,
          classes,
          domPath: path,
        }
      })
    }
  })

  // Global error listener
  window.addEventListener('error', (e) => {
    trackEvent('ERROR', { 
      elementId: e.message || 'Unknown Error',
      metadata: { 
        source: e.filename, 
        lineno: e.lineno,
        stack: e.error?.stack
      } 
    })
  })

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    trackEvent('ERROR', {
      elementId: e.reason?.message || 'Unhandled Promise Rejection',
      metadata: {
        stack: e.reason?.stack,
        reason: String(e.reason)
      }
    })
  })

  // Basic Page Load Performance
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.performance && window.performance.timing) {
        const t = window.performance.timing
        const loadTime = t.loadEventEnd - t.navigationStart
        const domReadyTime = t.domContentLoadedEventEnd - t.navigationStart
        
        if (loadTime > 0) {
          trackEvent('PERFORMANCE', {
            elementId: 'PAGE_LOAD',
            metadata: {
              loadTimeMs: loadTime,
              domReadyTimeMs: domReadyTime
            }
          })
        }
      }
    }, 0)
  })
}
