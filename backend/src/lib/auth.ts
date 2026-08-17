import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP } from 'better-auth/plugins'
import { prisma } from './prisma.js'
import { sendVerificationEmail, sendPasswordResetOTPEmail } from '../services/email.service.js'
import { FRONTEND_URL } from '../config/constants.js'
import { logger } from '../app.js'

const isProd = process.env.NODE_ENV === 'production' || process.env.BETTER_AUTH_URL?.startsWith('https://')

const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: 'mysql',
  }),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        // Prisma SystemRole enum values are uppercase (USER, ADMIN, …).
        defaultValue: 'USER',
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }: { user: any, url: string, token: string }, request?: Request) => {
      // Fire-and-forget: email is sent in background, does not block the sign-up response
      sendVerificationEmail({
        to: user.email,
        url,
        userName: user.name,
      })
        .catch((err) => {
          logger.error({ err, email: user.email }, 'email_verification_send_failed')
        })
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          },
        }
      : {}),
  },
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://task-manager-mauve-eta.vercel.app',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(FRONTEND_URL ? [FRONTEND_URL] : []),
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
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }, request) {
        if (type === 'forget-password') {
          // Fire-and-forget: email is sent in background
          sendPasswordResetOTPEmail({
            to: email,
            otp,
          })
            .catch((err) => {
              logger.error({ err, email }, 'email_otp_send_failed')
            })
        }
      },
    }),
  ],
})