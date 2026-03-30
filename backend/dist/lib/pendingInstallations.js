/**
 * In-memory store for GitHub App installations received via webhook
 * before a user has had the chance to claim them.
 *
 * TTL: 10 minutes. Safe for single-instance deployments (Render free tier).
 *
 * Flow:
 * 1. User calls GET /github/connect → registerExpectingUser(userId) records
 *    that this userId is expecting an installation.
 * 2. GitHub webhook fires → addPendingInstallation stores the installationId.
 * 3. Frontend polls GET /github/pending-installation → only returns entries
 *    if the authenticated user previously registered intent.
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const store = new Map();
const expectingUsers = new Map();
export function registerExpectingUser(userId) {
    expectingUsers.set(userId, { userId, registeredAt: Date.now() });
    pruneExpectingUsers();
}
export function isUserExpecting(userId) {
    pruneExpectingUsers();
    return expectingUsers.has(userId);
}
export function clearExpectingUser(userId) {
    expectingUsers.delete(userId);
}
export function addPendingInstallation(installationId, repos) {
    store.set(installationId, { installationId, repos, receivedAt: Date.now() });
    pruneExpired();
}
export function popPendingInstallation() {
    pruneExpired();
    let latest;
    for (const entry of store.values()) {
        if (!latest || entry.receivedAt > latest.receivedAt) {
            latest = entry;
        }
    }
    if (latest)
        store.delete(latest.installationId);
    return latest;
}
export function peekPendingInstallations() {
    pruneExpired();
    return Array.from(store.values()).sort((a, b) => b.receivedAt - a.receivedAt);
}
export function removePendingInstallation(installationId) {
    store.delete(installationId);
}
function pruneExpired() {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, entry] of store.entries()) {
        if (entry.receivedAt < cutoff)
            store.delete(id);
    }
}
function pruneExpectingUsers() {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, entry] of expectingUsers.entries()) {
        if (entry.registeredAt < cutoff)
            expectingUsers.delete(id);
    }
}
