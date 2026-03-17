import { FastifyRequest, FastifyReply } from 'fastify'
import { auth } from '../lib/auth.js'

export interface AuthUser {
  id: string
  email: string
  name?: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: req.headers as any,
  })

  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  req.authUser = session.user as AuthUser
}