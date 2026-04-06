import 'dotenv/config';
import app from './app.js';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { Server } from 'socket.io';
import { startNotificationCron } from './jobs/notificationCron.js';
import { setIO, directRoom } from './lib/socketManager.js';
const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://task-manager-mauve-eta.vercel.app',
];
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '');
if (FRONTEND_URL && !ALLOWED_ORIGINS.includes(FRONTEND_URL)) {
    ALLOWED_ORIGINS.push(FRONTEND_URL);
}
const start = async () => {
    try {
        if (process.env.SMTP_VERIFY_ON_START === 'true') {
            const { verifyEmailSmtp } = await import('./services/email.service.js');
            try {
                await verifyEmailSmtp();
                console.log('[email] SMTP verify OK');
            }
            catch (e) {
                console.error('[email] SMTP verify failed:', e);
                process.exit(1);
            }
        }
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
        io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            socket.on('join:project', (projectId) => {
                socket.join(projectId);
            });
            socket.on('join:direct', (payload) => {
                const room = directRoom(payload.projectId, payload.userId, payload.otherUserId);
                socket.join(room);
            });
            socket.on('typing:project', (payload) => {
                socket.to(payload.projectId).emit('typing:project', payload);
            });
            socket.on('typing:direct', (payload) => {
                const room = directRoom(payload.projectId, payload.userId, payload.otherUserId);
                socket.to(room).emit('typing:direct', payload);
            });
            socket.on('read:project', (payload) => {
                socket.to(payload.projectId).emit('read:project', payload);
            });
            socket.on('read:direct', (payload) => {
                const room = directRoom(payload.projectId, payload.userId, payload.otherUserId);
                socket.to(room).emit('read:direct', payload);
            });
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
        startNotificationCron();
        console.log(`REST API + Socket.io running on http://localhost:${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
