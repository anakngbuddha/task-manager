import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'

const USER_STATUSES = ['ONLINE', 'WORKING', 'BUSY', 'AWAY', 'IN_MEETING', 'OFFLINE'] as const
type UserStatusType = (typeof USER_STATUSES)[number]

const updateStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
})

const updateConsentSchema = z.object({
  essential: z.boolean(),
  analytics: z.boolean(),
  preferences: z.boolean(),
  timestamp: z.string(),
  version: z.string(),
})

export async function userRoutes(app: FastifyInstance) {
  app.get('/users/me', { preHandler: authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastSeenAt: true,
        consent: true,
      },
    })
    if (!user) return null
    // Expose role as lowercase strings for the frontend (`admin` | `user` | `banned`).
    return { ...user, role: user.role.toLowerCase() }
  })

  app.patch('/users/me/status', { preHandler: authenticate }, async (req, reply) => {
    const { status } = updateStatusSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.authUser.id },
      data: { status, lastSeenAt: new Date() },
      select: { id: true, status: true, lastSeenAt: true },
    })
    return reply.status(200).send(user)
  })

  app.patch('/users/me/consent', { preHandler: authenticate }, async (req, reply) => {
    const consent = updateConsentSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.authUser.id },
      data: { consent: consent as any },
      select: { id: true, consent: true },
    })
    return reply.status(200).send(user)
  })

  app.post('/users/me/ping', { preHandler: authenticate }, async (req, reply) => {
    await prisma.user.update({
      where: { id: req.authUser.id },
      data: { lastSeenAt: new Date() },
    })
    return reply.status(204).send()
  })

  // ── POST /users/resend-verification ─────────────────────────────────────
  // Audit finding #8. Unauthenticated by design — sign-up emails are
  // fire-and-forget so a missed verification email would otherwise lock a
  // user out. Heavily rate-limited (3/hour/IP) so we don't become an email
  // bomb. Always returns 204 to avoid leaking which addresses exist.
  app.post('/users/resend-verification', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(req.body)
    if (!body.success) {
      return reply.status(204).send()
    }
    const { email } = body.data

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true },
      })
      if (user && !user.emailVerified) {
        try {
          await auth.api.sendVerificationEmail({
            body: { email, callbackURL: '/login' },
          } as any)
        } catch (err) {
          req.log.warn({ err, email }, 'Failed to resend verification email')
        }
      }
    } catch (err) {
      req.log.warn({ err }, 'resend-verification handler failed')
    }
    return reply.status(204).send()
  })

  app.get('/users/status', { preHandler: authenticate }, async (req) => {
    const schema = z.object({ ids: z.string() })
    const { ids } = schema.parse((req.query ?? {}) as any)
    const userIds = ids.split(',').filter(Boolean)
    if (userIds.length === 0) return []

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, status: true, lastSeenAt: true },
    })
    return users
  })
}
