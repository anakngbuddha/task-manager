import { api } from './api'

export const CONSENT_VERSION = '1.0'
const COOKIE_NAME = 'cookieConsent'

export interface ConsentChoices {
  essential: boolean
  analytics: boolean
  preferences: boolean
  timestamp: string
  version: string
}

// Parses the cookie string to extract a specific cookie
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
  return match ? decodeURIComponent(match[3]) : null
}

// Sets a cookie with a 1-year expiry
function setCookieValue(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`
}

export function getConsent(category: 'analytics' | 'preferences' | 'essential'): boolean {
  if (category === 'essential') return true // Always true
  const raw = getCookieValue(COOKIE_NAME)
  if (!raw) return false
  try {
    const data: ConsentChoices = JSON.parse(raw)
    // If versions don't match, we treat it as false because they need to re-consent
    if (data.version !== CONSENT_VERSION) return false
    return data[category] ?? false
  } catch {
    return false
  }
}

export async function setConsent(choices: Omit<ConsentChoices, 'timestamp' | 'version' | 'essential'>) {
  const fullChoices: ConsentChoices = {
    ...choices,
    essential: true, // Force essential to true
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  }

  setCookieValue(COOKIE_NAME, JSON.stringify(fullChoices))

  // Try to sync with backend if user is logged in
  try {
    const sessionToken = getCookieValue('better-auth.session_token') || getCookieValue('__Secure-better-auth.session_token') || localStorage.getItem('__better-auth-session')
    if (sessionToken) {
       await api.patch('/users/me/consent', fullChoices)
    }
  } catch (err) {
    // Silently fail if they aren't authenticated or backend is unreachable
    console.error('Failed to sync consent to DB', err)
  }
}

export function hasConsented(): boolean {
  const raw = getCookieValue(COOKIE_NAME)
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    return data.version === CONSENT_VERSION
  } catch {
    return false
  }
}

export async function revokeConsent() {
  await setConsent({
    analytics: false,
    preferences: false,
  })
}
