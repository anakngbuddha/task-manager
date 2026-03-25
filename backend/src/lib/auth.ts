import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma.js'

const isProd = process.env.NODE_ENV === 'production' || process.env.BETTER_AUTH_URL?.startsWith('https://')

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'mysql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://task-manager-mauve-eta.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, '')] : []),
  ],
  advanced: {
    crossSubdomainCookies: {
      enabled: false,
    },
    // Production uses cross-site HTTPS cookies; local dev is HTTP + different port — Secure/SameSite=None
    // cookies are often dropped by the browser, so session never sticks and users bounce back to /login.
    defaultCookieAttributes: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      ...(isProd ? { partitioned: true } : {}),
    },
  },
})