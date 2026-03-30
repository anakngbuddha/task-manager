import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { taskRoutes } from './routes/tasks.js';
import { projectRoutes } from './routes/projects.js';
import { inviteRoutes } from './routes/invites.js';
import { taskCommentRoutes } from './routes/taskComments.js';
import { projectMessageRoutes } from './routes/projectMessages.js';
import { projectDirectMessageRoutes } from './routes/projectDirectMessages.js';
import { activityRoutes } from './routes/activity.js';
import { notificationRoutes } from './routes/notifications.js';
import { readReceiptRoutes } from './routes/readReceipts.js';
import { sprintRoutes } from './routes/sprints.js';
import { timeLogRoutes } from './routes/timeLogs.js';
import { userRoutes } from './routes/users.js';
import { githubRoutes } from './routes/github.js';
import { githubWebhookRoutes } from './routes/webhooks/github.js';
import { scheduleRoutes } from './routes/schedules.js';
import 'dotenv/config';
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const app = Fastify({ logger: true, trustProxy: true });
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
await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'cookie'],
});
await app.register(jwt, {
    secret: process.env.JWT_SECRET,
});
function injectCORSHeaders(req, res) {
    const origin = req.headers?.origin;
    if (origin) {
        const normalizedOrigin = origin.replace(/\/$/, '');
        if (ALLOWED_ORIGINS.includes(normalizedOrigin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,cookie,set-cookie');
    res.setHeader('Access-Control-Expose-Headers', 'set-cookie');
}
app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS' && req.url.startsWith('/api/auth')) {
        injectCORSHeaders(req.raw, reply.raw);
        return reply.status(204).send();
    }
    if (req.url.startsWith('/api/auth')) {
        injectCORSHeaders(req.raw, reply.raw);
        const handler = toNodeHandler(auth);
        await handler(req.raw, reply.raw);
        return reply.hijack();
    }
});
app.register(taskRoutes, { prefix: '/api' });
app.register(projectRoutes, { prefix: '/api' });
app.register(inviteRoutes, { prefix: '/api' });
app.register(taskCommentRoutes, { prefix: '/api' });
app.register(projectMessageRoutes, { prefix: '/api' });
app.register(projectDirectMessageRoutes, { prefix: '/api' });
app.register(activityRoutes, { prefix: '/api' });
app.register(notificationRoutes, { prefix: '/api' });
app.register(readReceiptRoutes, { prefix: '/api' });
app.register(sprintRoutes, { prefix: '/api' });
app.register(timeLogRoutes, { prefix: '/api' });
app.register(userRoutes, { prefix: '/api' });
app.register(githubRoutes, { prefix: '/api' });
app.register(githubWebhookRoutes, { prefix: '/api' });
app.register(scheduleRoutes, { prefix: '/api' });
app.get('/health', async () => {
    return { status: 'ok' };
});
export default app;
