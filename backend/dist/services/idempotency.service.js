import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { stableStringify } from '../lib/stableStringify.js';
import { logger } from '../app.js';
const STALE_LOCK_MS = 120_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
export function hashForIdempotency(routeKey, req) {
    const payload = {
        body: req.body ?? null,
        query: req.query ?? {},
        params: req.params ?? {},
    };
    return createHash('sha256')
        .update(stableStringify(payload))
        .update('\n')
        .update(routeKey)
        .digest('hex');
}
function readIdempotencyHeader(req) {
    const raw = req.headers['idempotency-key'] ?? req.headers['Idempotency-Key'];
    const v = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : '';
    return v.length ? v : null;
}
/**
 * Begin idempotency for a request. If header is absent, returns proceed with recordId null (no ctx).
 */
export async function acquireIdempotency(req, reply, routeKey, requestHash) {
    const key = readIdempotencyHeader(req);
    if (!key) {
        return { kind: 'proceed', recordId: null };
    }
    const userId = req.authUser?.id;
    if (!userId) {
        await reply.status(401).send({ error: 'Unauthorized' });
        return { kind: 'blocked' };
    }
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const row = await prisma.idempotencyKey.create({
                data: {
                    key,
                    userId,
                    routeKey,
                    requestHash,
                    status: 'IN_PROGRESS',
                    expiresAt,
                },
            });
            return { kind: 'proceed', recordId: row.id };
        }
        catch (e) {
            if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
                throw e;
            }
            const existing = await prisma.idempotencyKey.findUnique({
                where: { userId_routeKey_key: { userId, routeKey, key } },
            });
            if (!existing)
                continue;
            if (existing.status === 'COMPLETED') {
                if (existing.requestHash === requestHash) {
                    reply.header('Idempotent-Replay', 'true');
                    await reply.status(existing.responseCode ?? 200).send(existing.responseBody ?? null);
                    return { kind: 'replay' };
                }
                await reply.status(409).send({ error: 'Idempotency key was reused with a different request' });
                return { kind: 'blocked' };
            }
            if (existing.status === 'IN_PROGRESS') {
                const age = Date.now() - existing.createdAt.getTime();
                if (age < STALE_LOCK_MS) {
                    await reply
                        .status(409)
                        .header('Retry-After', '2')
                        .send({ error: 'A request with this idempotency key is still in progress' });
                    return { kind: 'blocked' };
                }
                await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => { });
                continue;
            }
        }
    }
    await reply.status(409).send({ error: 'Could not acquire idempotency lock' });
    return { kind: 'blocked' };
}
export function attachIdempotencyContext(req, recordId) {
    if (!recordId)
        return;
    req.idempotencyCtx = {
        recordId,
        finished: false,
    };
}
export async function completeIdempotencyFromPayload(req, reply, payload) {
    const ctx = req.idempotencyCtx;
    if (!ctx?.recordId || ctx.finished)
        return payload;
    ctx.finished = true;
    const code = reply.statusCode;
    let body = null;
    if (typeof payload === 'string' && payload.length > 0) {
        try {
            body = JSON.parse(payload);
        }
        catch {
            body = { _raw: payload.slice(0, 50_000) };
        }
    }
    else if (Buffer.isBuffer(payload) && payload.length > 0) {
        try {
            body = JSON.parse(payload.toString('utf8'));
        }
        catch {
            body = { _raw: payload.toString('utf8').slice(0, 50_000) };
        }
    }
    try {
        await prisma.idempotencyKey.update({
            where: { id: ctx.recordId },
            data: {
                status: 'COMPLETED',
                responseCode: code,
                responseBody: body === null || body === undefined ? Prisma.JsonNull : body,
            },
        });
    }
    catch (err) {
        req.log?.warn?.({ err }, 'idempotency_complete_failed');
        logger.error({ err }, '[idempotency] Failed to complete idempotency record');
    }
    return payload;
}
export async function purgeExpiredIdempotencyKeys() {
    const res = await prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    if (res.count > 0) {
        logger.info({ count: res.count }, '[cron] Purged expired idempotency key(s)');
    }
}
