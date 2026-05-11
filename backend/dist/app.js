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
import { taskGithubLinkRoutes } from './routes/taskGithubLinks.js';
import { scheduleRoutes } from './routes/schedules.js';
import { uploadRoutes } from './routes/upload.js';
import { tagRoutes } from './routes/tags.js';
import { adminRoutes } from './routes/admin.routes.js';
import { auditLogRoutes } from './routes/auditLogs.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { fileRoutes } from './routes/files.routes.js';
import { automationRoutes } from './routes/automations.js';
import multipart from '@fastify/multipart';
import 'dotenv/config';
import { completeIdempotencyFromPayload } from './services/idempotency.service.js';
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const app = Fastify({ logger: true, trustProxy: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
// Basic latency logging for slow requests (helps diagnose cold starts / DB slowness in production).
app.addHook('onRequest', async (req, reply) => {
    ;
    req._startedAt = Date.now();
});
app.addHook('onResponse', async (req, reply) => {
    const startedAt = req._startedAt;
    if (!startedAt)
        return;
    const ms = Date.now() - startedAt;
    const isSlow = ms >= Number(process.env.SLOW_REQUEST_MS || 1500);
    if (isSlow) {
        req.log.warn({
            ms,
            method: req.method,
            url: req.url,
            statusCode: reply.statusCode,
        }, 'slow_request');
    }
});
const ALLOWED_ORIGINS = [
    'http://localhost:4173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:4173',
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
    allowedHeaders: ['Content-Type', 'Authorization', 'cookie', 'Idempotency-Key', 'idempotency-key'],
    exposedHeaders: ['Idempotent-Replay', 'Retry-After'],
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,cookie,set-cookie,Idempotency-Key,idempotency-key');
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
// Add security headers
app.addHook('onSend', async (req, reply) => {
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'");
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
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
app.register(taskGithubLinkRoutes, { prefix: '/api' });
app.register(scheduleRoutes, { prefix: '/api' });
app.register(uploadRoutes, { prefix: '/api' });
app.register(tagRoutes, { prefix: '/api' });
app.register(adminRoutes, { prefix: '/api' });
app.register(auditLogRoutes, { prefix: '/api' });
app.register(analyticsRoutes, { prefix: '/api' });
app.register(fileRoutes, { prefix: '/api' });
app.register(automationRoutes, { prefix: '/api' });
app.addHook('onSend', async (request, reply, payload) => {
    return completeIdempotencyFromPayload(request, reply, payload);
});
app.get('/health', async () => {
    return { status: 'ok' };
});
export default app;
