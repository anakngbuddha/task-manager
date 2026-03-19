import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'

const USER_STATUSES = ['ONLINE', 'WORKING', 'BUSY', 'AWAY', 'IN_MEETING', 'OFFLINE'] as const
type UserStatusType = (typeof USER_STATUSES)[number]

const updateStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
})

export async function userRoutes(app: FastifyInstance) {
  // Get current user profile (including status)
  app.get('/users/me', { preHandler: authenticate }, async (req) => {
    const user = await (prisma.user.findUnique as any)({
      where: { id: req.authUser.id },
      select: { id: true, name: true, email: true, status: true, lastSeenAt: true },
    })
    return user
  })

  // Update current user status
  app.patch('/users/me/status', { preHandler: authenticate }, async (req, reply) => {
    const { status } = updateStatusSchema.parse(req.body)
    const user = await (prisma.user.update as any)({
      where: { id: req.authUser.id },
      data: { status, lastSeenAt: new Date() },
      select: { id: true, status: true, lastSeenAt: true },
    })
    return reply.status(200).send(user)
  })

  // Update lastSeenAt (ping endpoint for presence)
  app.post('/users/me/ping', { preHandler: authenticate }, async (req, reply) => {
    await (prisma.user.update as any)({
      where: { id: req.authUser.id },
      data: { lastSeenAt: new Date() },
    })
    return reply.status(204).send()
  })

  // Get status for a list of user IDs (for messages presence)
  app.get('/users/status', { preHandler: authenticate }, async (req) => {
    const schema = z.object({ ids: z.string() }) // comma-separated
    const { ids } = schema.parse((req.query ?? {}) as any)
    const userIds = ids.split(',').filter(Boolean)
    if (userIds.length === 0) return []

    const users = await (prisma.user.findMany as any)({
      where: { id: { in: userIds } },
      select: { id: true, status: true, lastSeenAt: true },
    })
    return users
  })
}
