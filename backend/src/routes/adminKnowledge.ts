import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { auth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  approveGlobalKnowledge,
  rejectGlobalKnowledge,
  revokeGlobalKnowledge,
} from '../services/knowledge.service.js'

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
})

export async function adminKnowledgeRoutes(app: FastifyInstance) {
  app.addHook('preValidation', async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any })
    if (!session) return reply.status(401).send({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden. Admin level required.' })
    }
  })

  app.get('/admin/knowledge/pending', async (_req, reply) => {
    const entries = await prisma.chatKnowledgeEntry.findMany({
      where: { scope: 'GLOBAL', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })
    return reply.send({ entries })
  })

  app.get('/admin/knowledge/approved', async (_req, reply) => {
    const entries = await prisma.chatKnowledgeEntry.findMany({
      where: { scope: 'GLOBAL', status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    })
    return reply.send({ entries })
  })

  app.post('/admin/knowledge/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string }
    const session = await auth.api.getSession({ headers: req.headers as any })
    if (!session) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      await approveGlobalKnowledge(id, session.user.id)
      const entry = await prisma.chatKnowledgeEntry.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      })
      return reply.send({ entry })
    } catch {
      return reply.status(404).send({ error: 'Entry not found or not pending' })
    }
  })

  app.post('/admin/knowledge/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { reason } = rejectSchema.parse(req.body)
    const session = await auth.api.getSession({ headers: req.headers as any })
    if (!session) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      await rejectGlobalKnowledge(id, session.user.id, reason)
      const entry = await prisma.chatKnowledgeEntry.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      })
      return reply.send({ entry })
    } catch {
      return reply.status(404).send({ error: 'Entry not found or not pending' })
    }
  })

  app.delete('/admin/knowledge/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    try {
      await revokeGlobalKnowledge(id)
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Entry not found or not approved' })
    }
  })
}
