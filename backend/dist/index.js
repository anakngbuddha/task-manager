import 'dotenv/config';
import './config/env.js';
import app from './app.js';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { Server } from 'socket.io';
import { startNotificationCron } from './jobs/notificationCron.js';
import { setIO, directRoom } from './lib/socketManager.js';
import { disconnectSocket, identifySocketUser, recordSocketHeartbeat, recordSocketIdle, setPresenceIO, } from './lib/userPresence.js';
import { prisma } from './lib/prisma.js';
import { assertEmailProviderConfigured } from './services/email.service.js';
import { seedAdmin } from './scripts/seed-admin.js';
import { auth } from './lib/auth.js';
import { logger } from './app.js';
const PORT = Number(process.env.PORT) || 3000;
import { ALLOWED_ORIGINS } from './config/cors.js';
const start = async () => {
    try {
        // Fail fast (in prod) or warn (in dev) if email provider config is missing.
        assertEmailProviderConfigured();
        // Force DB connect at startup so cold-start cost is visible in logs.
        const dbStart = Date.now();
        await prisma.$connect();
        logger.info({ ms: Date.now() - dbStart }, '[db] prisma.$connect OK');
        await seedAdmin();
        app.register(fastifyStatic, {
            root: path.join(process.cwd(), 'uploads'),
            prefix: '/uploads/',
        });
        await app.listen({ port: PORT, host: '0.0.0.0' });
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
        });
        setIO(io);
        setPresenceIO(io);
        // ── Authenticate every Socket.IO connection via session cookie or handshake auth token
        //    Fixes cross-origin WebSocket Unauthorized error (audit finding #4 preserved).
        io.use(async (socket, next) => {
            try {
                let userId = null;
                // 1. Try session cookie via headers (same-origin / cookie forwarding)
                try {
                    const headers = socket.handshake.headers;
                    const session = await auth.api.getSession({ headers });
                    if (session?.user?.id) {
                        userId = session.user.id;
                    }
                }
                catch {
                    // Ignore cookie session resolution failure
                }
                // 2. Fallback: check token in socket.handshake.auth (cross-origin WebSocket)
                if (!userId && socket.handshake.auth?.token) {
                    const token = String(socket.handshake.auth.token);
                    const dbSession = await prisma.session.findUnique({
                        where: { token },
                        include: { user: true },
                    });
                    if (dbSession && dbSession.expiresAt > new Date() && !dbSession.user.bannedAt) {
                        userId = dbSession.userId;
                    }
                }
                if (!userId) {
                    logger.warn({ socketId: socket.id }, 'socket_unauthorized');
                    return next(new Error('Unauthorized'));
                }
                socket.data.userId = userId;
                next();
            }
            catch (err) {
                logger.error({ err, socketId: socket.id }, 'socket_auth_middleware_error');
                next(new Error('Unauthorized'));
            }
        });
        // Helper: confirm the verified socket user is a member of the given project.
        const isProjectMember = async (userId, projectId) => {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId, projectId } },
                select: { userId: true },
            });
            return !!member;
        };
        io.on('connection', async (socket) => {
            const userId = socket.data.userId;
            logger.info({ socketId: socket.id, userId }, 'socket_connected');
            try {
                await identifySocketUser(socket.id, userId);
            }
            catch (error) {
                logger.error({ err: error, socketId: socket.id }, 'socket_identify_failed');
            }
            // Kept for backward compatibility — payload is ignored, server uses the
            // verified userId from the handshake.
            socket.on('auth:identify', async () => {
                try {
                    await identifySocketUser(socket.id, userId);
                }
                catch (error) {
                    logger.error({ err: error, socketId: socket.id }, 'socket_identify_failed');
                }
            });
            socket.on('activity:heartbeat', async () => {
                try {
                    await recordSocketHeartbeat(socket.id);
                }
                catch (error) {
                    logger.error({ err: error, socketId: socket.id }, 'socket_heartbeat_failed');
                }
            });
            socket.on('activity:idle', async (payload) => {
                try {
                    await recordSocketIdle(socket.id, Boolean(payload?.isIdle));
                }
                catch (error) {
                    logger.error({ err: error, socketId: socket.id }, 'socket_idle_failed');
                }
            });
            socket.on('activity:disconnect', async () => {
                try {
                    await disconnectSocket(socket.id);
                }
                catch (error) {
                    logger.error({ err: error, socketId: socket.id }, 'socket_disconnect_record_failed');
                }
            });
            socket.on('join:project', async (projectId) => {
                if (typeof projectId !== 'string' || !projectId)
                    return;
                try {
                    if (!(await isProjectMember(userId, projectId)))
                        return;
                    socket.join(projectId);
                }
                catch (err) {
                    logger.error({ err, socketId: socket.id, projectId }, 'socket_join_project_failed');
                }
            });
            socket.on('join:direct', async (payload) => {
                if (!payload?.projectId || !payload?.otherUserId)
                    return;
                try {
                    // Only join if the verified user is a member of the project.
                    if (!(await isProjectMember(userId, payload.projectId)))
                        return;
                    // Always compute the room from the verified userId, ignoring any
                    // client-supplied userId in the payload.
                    const room = directRoom(payload.projectId, userId, payload.otherUserId);
                    socket.join(room);
                }
                catch (err) {
                    logger.error({ err, socketId: socket.id }, 'socket_join_direct_failed');
                }
            });
            socket.on('typing:project', (payload) => {
                if (!payload?.projectId)
                    return;
                // Re-emit with the verified userId so peers can't be impersonated.
                socket.to(payload.projectId).emit('typing:project', { ...payload, userId });
            });
            socket.on('typing:direct', (payload) => {
                if (!payload?.projectId || !payload?.otherUserId)
                    return;
                const room = directRoom(payload.projectId, userId, payload.otherUserId);
                socket.to(room).emit('typing:direct', { ...payload, userId });
            });
            socket.on('read:project', (payload) => {
                if (!payload?.projectId)
                    return;
                socket.to(payload.projectId).emit('read:project', { ...payload, userId });
            });
            socket.on('read:direct', (payload) => {
                if (!payload?.projectId || !payload?.otherUserId)
                    return;
                const room = directRoom(payload.projectId, userId, payload.otherUserId);
                socket.to(room).emit('read:direct', { ...payload, userId });
            });
            socket.on('disconnect', async () => {
                logger.info({ socketId: socket.id }, 'socket_disconnected');
                try {
                    await disconnectSocket(socket.id);
                }
                catch (error) {
                    logger.error({ err: error, socketId: socket.id }, 'socket_finalize_disconnect_failed');
                }
            });
        });
        startNotificationCron();
        logger.info({ port: PORT }, 'REST API + Socket.io running');
        // ── Graceful shutdown (audit finding #18) ────────────────────────────
        // SIGTERM is what Render/Docker send on deploy; SIGINT covers Ctrl+C.
        let shuttingDown = false;
        const shutdown = async (signal) => {
            if (shuttingDown)
                return;
            shuttingDown = true;
            logger.info({ signal }, 'shutdown_signal_received');
            // Hard kill if we're still alive after 10s.
            const hardKill = setTimeout(() => {
                logger.error('shutdown_hard_kill');
                process.exit(1);
            }, 10_000);
            hardKill.unref?.();
            try {
                io.close();
            }
            catch (err) {
                logger.warn({ err }, 'shutdown_io_close_failed');
            }
            try {
                await app.close();
            }
            catch (err) {
                logger.warn({ err }, 'shutdown_app_close_failed');
            }
            try {
                await prisma.$disconnect();
            }
            catch (err) {
                logger.warn({ err }, 'shutdown_prisma_disconnect_failed');
            }
            logger.info('shutdown_complete');
            process.exit(0);
        };
        process.on('SIGTERM', () => void shutdown('SIGTERM'));
        process.on('SIGINT', () => void shutdown('SIGINT'));
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
