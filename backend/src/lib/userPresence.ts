import type { Server } from 'socket.io'
import { prisma } from './prisma.js'

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE'

type SocketPresence = {
  socketId: string
  userId: string
  connectedAt: Date
  lastActivityAt: Date
  isIdle: boolean
  idleStartedAt: Date | null
  idleTimeSeconds: number
  sessionId: string | null
}

const socketsById = new Map<string, SocketPresence>()
const socketIdsByUser = new Map<string, Set<string>>()

// Per-user mutex to serialize DB writes and prevent MysqlError 1020 race conditions.
const userLocks = new Map<string, Promise<void>>()

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  userLocks.set(userId, next.then(() => {}, () => {}))
  return next
}

let io: Server | null = null

function getUserStatus(userId: string): PresenceStatus {
  const socketIds = socketIdsByUser.get(userId)
  if (!socketIds || socketIds.size === 0) return 'OFFLINE'

  for (const socketId of socketIds) {
    const presence = socketsById.get(socketId)
    if (presence && !presence.isIdle) return 'ONLINE'
  }

  return 'AWAY'
}

function emitStatusUpdate(userId: string) {
  if (!io) return
  io.emit('user:status:update', {
    userId,
    status: getUserStatus(userId),
    lastSeenAt: new Date().toISOString(),
  })
}

function addIdleDuration(presence: SocketPresence, until = new Date()) {
  if (!presence.idleStartedAt) return
  const idleSeconds = Math.max(
    0,
    Math.floor((until.getTime() - presence.idleStartedAt.getTime()) / 1000),
  )
  presence.idleTimeSeconds += idleSeconds
  presence.idleStartedAt = null
}

async function endSession(presence: SocketPresence) {
  if (!presence.sessionId) return

  const endedAt = new Date()
  const duration = Math.max(
    0,
    Math.floor((endedAt.getTime() - presence.connectedAt.getTime()) / 1000),
  )

  await prisma.userSession.update({
    where: { id: presence.sessionId },
    data: {
      endedAt,
      duration,
      idleTime: presence.idleTimeSeconds,
    },
  })
}

export function setPresenceIO(instance: Server) {
  io = instance
}

export function getOnlineUsers() {
  const users = new Map<string, { userId: string; status: PresenceStatus; lastSeenAt: string }>()

  for (const [userId] of socketIdsByUser) {
    users.set(userId, {
      userId,
      status: getUserStatus(userId),
      lastSeenAt: new Date().toISOString(),
    })
  }

  return Array.from(users.values())
}

export function getUserPresenceStatus(userId: string): PresenceStatus {
  return getUserStatus(userId)
}

export async function identifySocketUser(socketId: string, userId: string) {
  return withUserLock(userId, async () => {
    const existing = socketsById.get(socketId)
    if (existing?.userId === userId) return

    if (existing) {
      await disconnectSocketInternal(socketId)
    }

    const session = await prisma.userSession.create({
      data: { userId },
    })

    const presence: SocketPresence = {
      socketId,
      userId,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      isIdle: false,
      idleStartedAt: null,
      idleTimeSeconds: 0,
      sessionId: session.id,
    }

    socketsById.set(socketId, presence)
    const userSockets = socketIdsByUser.get(userId) ?? new Set<string>()
    userSockets.add(socketId)
    socketIdsByUser.set(userId, userSockets)

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE', lastSeenAt: new Date() },
    })

    emitStatusUpdate(userId)
  })
}

export async function recordSocketHeartbeat(socketId: string) {
  const presence = socketsById.get(socketId)
  if (!presence) return

  return withUserLock(presence.userId, async () => {
    const now = new Date()
    if (presence.isIdle) {
      addIdleDuration(presence, now)
      presence.isIdle = false
    }

    presence.lastActivityAt = now
    await prisma.user.update({
      where: { id: presence.userId },
      data: { status: 'ONLINE', lastSeenAt: now },
    })
    emitStatusUpdate(presence.userId)
  })
}

export async function recordSocketIdle(socketId: string, isIdle: boolean) {
  const presence = socketsById.get(socketId)
  if (!presence) return

  return withUserLock(presence.userId, async () => {
    const now = new Date()
    const dbStatus = isIdle ? 'AWAY' : 'ONLINE'

    if (isIdle && !presence.isIdle) {
      presence.isIdle = true
      presence.idleStartedAt = now
      await prisma.user.update({
        where: { id: presence.userId },
        data: { status: dbStatus, lastSeenAt: now },
      })
    } else if (!isIdle && presence.isIdle) {
      addIdleDuration(presence, now)
      presence.isIdle = false
      await prisma.user.update({
        where: { id: presence.userId },
        data: { status: dbStatus, lastSeenAt: now },
      })
    }

    emitStatusUpdate(presence.userId)
  })
}

async function disconnectSocketInternal(socketId: string) {
  const presence = socketsById.get(socketId)
  if (!presence) return

  addIdleDuration(presence)
  await endSession(presence)

  socketsById.delete(socketId)
  const userSockets = socketIdsByUser.get(presence.userId)
  if (userSockets) {
    userSockets.delete(socketId)
    if (userSockets.size === 0) {
      socketIdsByUser.delete(presence.userId)
      await prisma.user.update({
        where: { id: presence.userId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() },
      })
    }
  }

  emitStatusUpdate(presence.userId)
}

export async function disconnectSocket(socketId: string) {
  const presence = socketsById.get(socketId)
  if (!presence) return

  return withUserLock(presence.userId, () => disconnectSocketInternal(socketId))
}
