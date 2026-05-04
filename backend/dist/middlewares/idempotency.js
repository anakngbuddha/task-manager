import { acquireIdempotency, attachIdempotencyContext, hashForIdempotency, } from '../services/idempotency.service.js';
/**
 * When `Idempotency-Key` is present, dedupes the request and stores the JSON response for replays.
 * When absent, the handler runs normally (no idempotency).
 * Must run after `authenticate` so `req.authUser` exists when a key is sent.
 */
export function idempotencyPreHandler(routeKey) {
    return async (req, reply) => {
        const requestHash = hashForIdempotency(routeKey, req);
        const result = await acquireIdempotency(req, reply, routeKey, requestHash);
        if (result.kind === 'replay' || result.kind === 'blocked') {
            return;
        }
        if (result.kind === 'proceed' && result.recordId) {
            attachIdempotencyContext(req, result.recordId);
        }
    };
}
