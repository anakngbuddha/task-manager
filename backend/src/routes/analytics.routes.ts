import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const analyticsSchema = z.object({
  eventType: z.string(),
  pageUrl: z.string().optional(),
  elementId: z.string().optional(),
  metadata: z.any().optional(),
})

// Simple analytics ingestion route.
export async function analyticsRoutes(app: FastifyInstance) {
  app.post(
    '/analytics/event',
    async (req, reply) => {
      const body = analyticsSchema.parse(req.body) as {
        eventType: string
        pageUrl?: string
        elementId?: string
        metadata?: any
      }

      // Try reading userId from session if they are authenticated, it's fine if they aren't.
      let userId: string | null = null
      
      let sessionToken: string | undefined
      const getCookie = (name: string) => {
        const match = req.headers.cookie?.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
        return match ? match[3] : undefined
      }
      
      sessionToken = getCookie('better-auth.session_token') || getCookie('__Secure-better-auth.session_token')
      
      const session = sessionToken || req.headers.authorization?.replace('Bearer ', '')

      if (session) {
        // Try getting userId from db session
        try {
          const dbSession = await prisma.session.findFirst({
            where: { token: session }
          });
          if (dbSession) {
            userId = dbSession.userId;
          }
        } catch(_) {}
      }

      try {
        await prisma.analyticsEvent.create({
          data: {
            eventType: body.eventType,
            pageUrl: body.pageUrl || null,
            elementId: body.elementId || null,
            metadata: body.metadata || null,
            userId: userId,
          },
        })
        return reply.status(204).send()
      } catch (err) {
        req.log.error(err, 'Failed to save analytics event')
        return reply.status(500).send({ error: 'Failed to record event' })
      }
    }
  )
}
