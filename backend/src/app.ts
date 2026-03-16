import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth.js'
import { taskRoutes } from './routes/tasks.js'
import { projectRoutes } from './routes/projects.js'
import 'dotenv/config'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'cookie'],
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET!,
})

function injectCORSHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,cookie')
}

app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'OPTIONS' && req.url.startsWith('/api/auth')) {
    injectCORSHeaders(reply.raw)
    return reply.status(204).send()
  }

  if (req.url.startsWith('/api/auth')) {
    injectCORSHeaders(reply.raw)
    await new Promise<void>((resolve) => {
      toNodeHandler(auth)(req.raw, reply.raw, () => resolve())
    })
    return reply.hijack()
  }
})

app.register(taskRoutes, { prefix: '/api' })
app.register(projectRoutes, { prefix: '/api' })

app.get('/health', async () => {
  return { status: 'ok' }
})

export default app