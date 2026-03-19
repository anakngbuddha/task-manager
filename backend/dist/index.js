import 'dotenv/config';
import app from './app.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { presenceService } from './services/presence.service.js';
import { userStatusService } from './services/userStatus.service.js';
const PORT = Number(process.env.PORT) || 3000;
const httpServer = createServer(app.server);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:5174'],
        credentials: true,
    },
});
function directRoom(projectId, a, b) {
    const [x, y] = [a, b].sort();
    return `dm:${projectId}:${x}:${y}`;
}
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
    socket.on('presence:ping', (payload) => {
        if (!payload?.userId)
            return;
        presenceService.ping(payload.userId);
        socket.broadcast.emit('presence:update', {
            userId: payload.userId,
            lastActiveAt: presenceService.lastActiveAt(payload.userId),
        });
    });
    socket.on('status:set', async (payload) => {
        if (!payload?.userId)
            return;
        const next = await userStatusService.setStatus(payload.userId, payload.status);
        socket.broadcast.emit('status:update', { userId: payload.userId, status: next });
    });
});
const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        httpServer.listen(3001);
        console.log(`REST API running on http://localhost:${PORT}`);
        console.log(`Socket.io running on http://localhost:3001`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
