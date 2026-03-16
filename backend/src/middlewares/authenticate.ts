import { FastifyRequest, FastifyReply } from 'fastify'
import { auth } from '../lib/auth.js'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: req.headers as any,
  })

  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  req.user = session.user
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }
}