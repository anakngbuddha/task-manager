import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyRedis from '@fastify/redis';
import { toNodeHandler } from 'better-auth/node';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
import { adminIssuesRoutes } from './routes/adminIssues.js';
import { adminUserAnalyticsRoutes } from './routes/adminUserAnalytics.js';
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
import { ALLOWED_ORIGINS } from './config/cors.js';
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
// ── Redis (optional) ───────────────────────────────────────────────────────
// Registers @fastify/redis when REDIS_URL is set. Falls back to in-memory
// gracefully if the env var is absent (useful for local dev / CI).
// If the URL is set but Redis is unreachable, we log a warning and continue
// without Redis rather than crashing the whole process.
let redisAvailable = false;
if (process.env.REDIS_URL) {
    try {
        await app.register(fastifyRedis, {
            url: process.env.REDIS_URL,
            // Fail fast on connect rather than letting the first request hang.
            connectTimeout: 3000,
            maxRetriesPerRequest: 1,
        });
        // Verify the connection is actually live before trusting it.
        await app.redis.ping();
        redisAvailable = true;
        app.log.info('Redis connected — using Redis-backed rate limiting');
    }
    catch (err) {
        app.log.warn({ err }, 'Redis connection failed — falling back to in-memory rate limiting. ' +
            'Multi-instance deployments will not share rate limit state.');
    }
}
// Global rate limit (300 req/min/IP). Route-specific overrides applied via
// per-route `config.rateLimit` settings (audit finding #21).
await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    hook: 'preHandler',
    allowList: (req) => req.url === '/health',
    keyGenerator: (req) => req.ip,
    redis: redisAvailable ? app.redis : undefined,
    errorResponseBuilder: (_req, ctx) => ({
        error: 'Too many requests',
        retryAfterSeconds: Math.ceil((ctx.ttl ?? 60_000) / 1000),
    }),
});
export const logger = app.log;
// Tightened CSP. We drop 'unsafe-eval' globally (audit finding #10). We keep
// 'unsafe-inline' on script-src only on the auth-proxy responses (which Better
// Auth occasionally serves with inline redirect scripts). All other responses
// get the strict CSP set via the onSend hook below.
const STRICT_CSP = "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https: wss:; " +
    "frame-ancestors 'self'; " +
    "base-uri 'self'; " +
    "object-src 'none'";
const AUTH_PROXY_CSP = "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'self'; " +
    "base-uri 'self'; " +
    "object-src 'none'";
function setSecurityHeaders(res, csp) {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}
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
// ── Per-IP rate limiting for the proxied Better-Auth endpoints ─────────
// The auth proxy below calls reply.hijack() and runs outside Fastify's normal
// lifecycle, so @fastify/rate-limit cannot guard it.
// When Redis is available we use a sliding-window counter stored in Redis so
// limits are correctly enforced across all instances (e.g. Fly.io multi-region).
// When Redis is unavailable we fall back to an in-memory Map — good enough for
// single-instance dev but noted as a known limitation.
const authLimits = [
    { test: (u) => u.includes('/sign-in/'), max: 10, windowMs: 60_000 },
    { test: (u) => u.includes('/sign-up/'), max: 10, windowMs: 60_000 },
    { test: (u) => u.includes('forget-password') || u.includes('send-otp') || u.includes('send-verification'), max: 5, windowMs: 60_000 },
];
const authBuckets = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of authBuckets)
        if (v.resetAt < now)
            authBuckets.delete(k);
}, 60_000).unref?.();
async function checkAuthRateLimit(ip, url) {
    const limit = authLimits.find((l) => l.test(url));
    if (!limit)
        return { allowed: true, retryAfter: 0 };
    const key = `auth_rl:${ip}:${authLimits.indexOf(limit)}`;
    const now = Date.now();
    const windowExpiresSec = Math.ceil(limit.windowMs / 1000);
    // ── Redis path (multi-instance safe) ────────────────────────────────
    if (redisAvailable) {
        try {
            const redis = app.redis;
            // Atomic increment + set TTL only on first write
            const count = await redis.incr(key);
            if (count === 1)
                await redis.expire(key, windowExpiresSec);
            if (count > limit.max) {
                const ttl = await redis.ttl(key);
                return { allowed: false, retryAfter: Math.max(ttl, 1) };
            }
            return { allowed: true, retryAfter: 0 };
        }
        catch (err) {
            // Redis error mid-request — degrade gracefully, don't block traffic
            app.log.warn({ err, key }, 'auth_rate_limit_redis_error — allowing request');
            return { allowed: true, retryAfter: 0 };
        }
    }
    // ── In-memory fallback ───────────────────────────────────────────────
    const bucket = authBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
        authBuckets.set(key, { count: 1, resetAt: now + limit.windowMs });
        return { allowed: true, retryAfter: 0 };
    }
    if (bucket.count >= limit.max) {
        return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { allowed: true, retryAfter: 0 };
}
app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS' && req.url.startsWith('/api/auth')) {
        injectCORSHeaders(req.raw, reply.raw);
        setSecurityHeaders(reply.raw, AUTH_PROXY_CSP);
        return reply.status(204).send();
    }
    if (req.url.startsWith('/api/auth')) {
        const { allowed, retryAfter } = await checkAuthRateLimit(req.ip, req.url);
        if (!allowed) {
            injectCORSHeaders(req.raw, reply.raw);
            setSecurityHeaders(reply.raw, AUTH_PROXY_CSP);
            reply.header('Retry-After', String(retryAfter));
            return reply.status(429).send({ error: 'Too many requests', retryAfterSeconds: retryAfter });
        }
        // Audit finding #12 — reply.hijack() skips the onSend hook below, so we
        // must apply security headers BEFORE handing off to the Better-Auth node
        // handler. Without this, every response served by the auth proxy was
        // shipped without CSP / X-Frame-Options / etc.
        injectCORSHeaders(req.raw, reply.raw);
        setSecurityHeaders(reply.raw, AUTH_PROXY_CSP);
        const handler = toNodeHandler(auth);
        reply.hijack();
        await handler(req.raw, reply.raw);
        return;
    }
});
// Default security headers for every non-auth route.
app.addHook('onSend', async (req, reply) => {
    reply.header('Content-Security-Policy', STRICT_CSP);
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
app.register(adminIssuesRoutes, { prefix: '/api' });
app.register(adminUserAnalyticsRoutes, { prefix: '/api' });
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
// ── Global error handler (audit finding #22) ─────────────────────────────
// Never leak Prisma error text or stack traces to clients. Log everything
// server-side, return a sanitized shape based on the error class.
app.setErrorHandler((err, req, reply) => {
    const userId = req.authUser?.id ?? null;
    req.log.error({ err, url: req.url, userId }, 'request_failed');
    if (err instanceof z.ZodError) {
        return reply.status(400).send({
            error: 'Validation failed',
            issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
        });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return reply.status(409).send({ error: 'Duplicate value violates a unique constraint' });
        }
        if (err.code === 'P2025') {
            return reply.status(404).send({ error: 'Record not found' });
        }
        return reply.status(500).send({ error: 'Database error' });
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
        return reply.status(400).send({ error: 'Invalid database query' });
    }
    // Honor explicit statusCode set by Fastify or route code.
    const status = err.statusCode && Number.isInteger(err.statusCode)
        ? err.statusCode
        : 500;
    if (status >= 400 && status < 500) {
        // Client errors typically carry a safe message (Fastify validation, etc.).
        const message = err instanceof Error ? err.message : 'Bad request';
        return reply.status(status).send({ error: message || 'Bad request' });
    }
    return reply.status(500).send({ error: 'Internal server error' });
});
export default app;
