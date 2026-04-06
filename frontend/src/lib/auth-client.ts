import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

function deriveBaseURL(apiUrl: string | undefined): string {
  if (!apiUrl) return 'http://localhost:3000'
  try {
    const url = new URL(apiUrl)
    // Strip trailing /api path segment(s) but preserve the host
    url.pathname = url.pathname.replace(/\/api\/?$/, '') || '/'
    return url.origin + url.pathname.replace(/\/+$/, '')
  } catch {
    return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:3000'
  }
}

export const authClient = createAuthClient({
  baseURL: deriveBaseURL(import.meta.env.VITE_API_URL),
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [emailOTPClient()],
})

export const { signIn, signOut, signUp, useSession } = authClient