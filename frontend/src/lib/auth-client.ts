import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL?.replace('/api', '')
    ?? 'http://localhost:3000',
})

export const { signIn, signOut, signUp, useSession } = authClient