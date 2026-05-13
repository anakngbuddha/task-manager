import { prisma } from './prisma.js';
const socketsById = new Map();
const socketIdsByUser = new Map();
let io = null;
function getUserStatus(userId) {
    const socketIds = socketIdsByUser.get(userId);
    if (!socketIds || socketIds.size === 0)
        return 'OFFLINE';
    for (const socketId of socketIds) {
        const presence = socketsById.get(socketId);
        if (presence && !presence.isIdle)
            return 'ONLINE';
    }
    return 'IDLE';
}
function emitStatusUpdate(userId) {
    if (!io)
        return;
    io.emit('user:status:update', {
        userId,
        status: getUserStatus(userId),
        lastSeenAt: new Date().toISOString(),
    });
}
function addIdleDuration(presence, until = new Date()) {
    if (!presence.idleStartedAt)
        return;
    const idleSeconds = Math.max(0, Math.floor((until.getTime() - presence.idleStartedAt.getTime()) / 1000));
    presence.idleTimeSeconds += idleSeconds;
    presence.idleStartedAt = null;
}
async function endSession(presence) {
    if (!presence.sessionId)
        return;
    const endedAt = new Date();
    const duration = Math.max(0, Math.floor((endedAt.getTime() - presence.connectedAt.getTime()) / 1000));
    await prisma.userSession.update({
        where: { id: presence.sessionId },
        data: {
            endedAt,
            duration,
            idleTime: presence.idleTimeSeconds,
        },
    });
}
export function setPresenceIO(instance) {
    io = instance;
}
export function getOnlineUsers() {
    const users = new Map();
    for (const [userId] of socketIdsByUser) {
        users.set(userId, {
            userId,
            status: getUserStatus(userId),
            lastSeenAt: new Date().toISOString(),
        });
    }
    return Array.from(users.values());
}
export function getUserPresenceStatus(userId) {
    return getUserStatus(userId);
}
export async function identifySocketUser(socketId, userId) {
    const existing = socketsById.get(socketId);
    if (existing?.userId === userId)
        return;
    if (existing) {
        await disconnectSocket(socketId);
    }
    const session = await prisma.userSession.create({
        data: { userId },
    });
    const presence = {
        socketId,
        userId,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        isIdle: false,
        idleStartedAt: null,
        idleTimeSeconds: 0,
        sessionId: session.id,
    };
    socketsById.set(socketId, presence);
    const userSockets = socketIdsByUser.get(userId) ?? new Set();
    userSockets.add(socketId);
    socketIdsByUser.set(userId, userSockets);
    await prisma.user.update({
        where: { id: userId },
        data: { status: 'ONLINE', lastSeenAt: new Date() },
    });
    emitStatusUpdate(userId);
}
export async function recordSocketHeartbeat(socketId) {
    const presence = socketsById.get(socketId);
    if (!presence)
        return;
    const now = new Date();
    if (presence.isIdle) {
        addIdleDuration(presence, now);
        presence.isIdle = false;
    }
    presence.lastActivityAt = now;
    await prisma.user.update({
        where: { id: presence.userId },
        data: { status: 'ONLINE', lastSeenAt: now },
    });
    emitStatusUpdate(presence.userId);
}
export async function recordSocketIdle(socketId, isIdle) {
    const presence = socketsById.get(socketId);
    if (!presence)
        return;
    const now = new Date();
    if (isIdle && !presence.isIdle) {
        presence.isIdle = true;
        presence.idleStartedAt = now;
        await prisma.user.update({
            where: { id: presence.userId },
            data: { status: 'AWAY', lastSeenAt: now },
        });
    }
    else if (!isIdle && presence.isIdle) {
        addIdleDuration(presence, now);
        presence.isIdle = false;
        await prisma.user.update({
            where: { id: presence.userId },
            data: { status: 'ONLINE', lastSeenAt: now },
        });
    }
    emitStatusUpdate(presence.userId);
}
export async function disconnectSocket(socketId) {
    const presence = socketsById.get(socketId);
    if (!presence)
        return;
    addIdleDuration(presence);
    await endSession(presence);
    socketsById.delete(socketId);
    const userSockets = socketIdsByUser.get(presence.userId);
    if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
            socketIdsByUser.delete(presence.userId);
            await prisma.user.update({
                where: { id: presence.userId },
                data: { status: 'OFFLINE', lastSeenAt: new Date() },
            });
        }
    }
    emitStatusUpdate(presence.userId);
}
