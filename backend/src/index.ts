import 'dotenv/config'
import app from './app.js'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { Server } from 'socket.io'
import { startNotificationCron } from './jobs/notificationCron.js'
import { setIO, directRoom } from './lib/socketManager.js'
import {
  disconnectSocket,
  identifySocketUser,
  recordSocketHeartbeat,
  recordSocketIdle,
  setPresenceIO,
} from './lib/userPresence.js'
import { prisma } from './lib/prisma.js'
import { assertEmailProviderConfigured } from './services/email.service.js'
import { seedAdmin } from './scripts/seed-admin.js'

const PORT = Number(process.env.PORT) || 3000

const ALLOWED_ORIGINS = [
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://task-manager-mauve-eta.vercel.app',
]
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '')
if (FRONTEND_URL && !ALLOWED_ORIGINS.includes(FRONTEND_URL)) {
  ALLOWED_ORIGINS.push(FRONTEND_URL)
}

const start = async () => {
  try {
    // Fail fast (in prod) or warn (in dev) if email provider config is missing.
    assertEmailProviderConfigured()

    // Force DB connect at startup so cold-start cost is visible in logs.
    const dbStart = Date.now()
    await prisma.$connect()
    console.log(`[db] prisma.$connect OK (${Date.now() - dbStart}ms)`)

    await seedAdmin()

    app.register(fastifyStatic, {
      root: path.join(process.cwd(), 'uploads'),
      prefix: '/uploads/',
    })

    await app.listen({ port: PORT, host: '0.0.0.0' })

    const io = new Server(app.server, {
      cors: {
        origin: ALLOWED_ORIGINS,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30000,
      pingInterval: 10000,
      connectTimeout: 15000,
      allowUpgrades: true,
      upgradeTimeout: 15000,
      perMessageDeflate: false,
    })

    setIO(io)
    setPresenceIO(io)

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('auth:identify', async (payload: { userId?: string }) => {
        if (!payload?.userId) return
        try {
          await identifySocketUser(socket.id, payload.userId)
        } catch (error) {
          console.error('Failed to identify socket user', error)
        }
      })

      socket.on('activity:heartbeat', async () => {
        try {
          await recordSocketHeartbeat(socket.id)
        } catch (error) {
          console.error('Failed to record heartbeat', error)
        }
      })

      socket.on('activity:idle', async (payload: { isIdle?: boolean }) => {
        try {
          await recordSocketIdle(socket.id, Boolean(payload?.isIdle))
        } catch (error) {
          console.error('Failed to record idle state', error)
        }
      })

      socket.on('activity:disconnect', async () => {
        try {
          await disconnectSocket(socket.id)
        } catch (error) {
          console.error('Failed to record disconnect', error)
        }
      })

      socket.on('join:project', (projectId: string) => {
        socket.join(projectId)
      })

      socket.on('join:direct', (payload: { projectId: string; userId: string; otherUserId: string }) => {
        const room = directRoom(payload.projectId, payload.userId, payload.otherUserId)
        socket.join(room)
      })

      socket.on('typing:project', (payload: { projectId: string; userId: string; name: string; isTyping: boolean }) => {
        socket.to(payload.projectId).emit('typing:project', payload)
      })

      socket.on('typing:direct', (payload: { projectId: string; userId: string; otherUserId: string; name: string; isTyping: boolean }) => {
        const room = directRoom(payload.projectId, payload.userId, payload.otherUserId)
        socket.to(room).emit('typing:direct', payload)
      })

      socket.on('read:project', (payload: { projectId: string; userId: string }) => {
        socket.to(payload.projectId).emit('read:project', payload)
      })

      socket.on('read:direct', (payload: { projectId: string; userId: string; otherUserId: string }) => {
        const room = directRoom(payload.projectId, payload.userId, payload.otherUserId)
        socket.to(room).emit('read:direct', payload)
      })

      socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id)
        try {
          await disconnectSocket(socket.id)
        } catch (error) {
          console.error('Failed to finalize socket disconnect', error)
        }
      })
    })

    startNotificationCron()
    console.log(`REST API + Socket.io running on http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()