import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth.js'
import { taskRoutes } from './routes/tasks.js'
import { projectRoutes } from './routes/projects.js'
import 'dotenv/config'

const app = Fastify({ logger: true })

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://task-manager-mauve-eta.vercel.app',
]

await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'cookie'],
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET!,
})

function injectCORSHeaders(req: any, res: any) {
  const origin = req.headers?.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,cookie,set-cookie')
  res.setHeader('Access-Control-Expose-Headers', 'set-cookie')
}

app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'OPTIONS' && req.url.startsWith('/api/auth')) {
    injectCORSHeaders(req.raw, reply.raw)
    return reply.status(204).send()
  }

  if (req.url.startsWith('/api/auth')) {
    injectCORSHeaders(req.raw, reply.raw)
    const handler = toNodeHandler(auth)
    await new Promise<void>((resolve) => {
      handler(req.raw, reply.raw)
      resolve()
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