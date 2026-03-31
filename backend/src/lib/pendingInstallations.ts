/**
 * In-memory store for GitHub App installations received via webhook
 * before a user has had the chance to claim them.
 *
 * TTL: 10 minutes. Safe for single-instance deployments.
 *
 * Flow:
 * 1. User calls GET /github/connect → registerExpectingUser(userId) records
 *    that this userId is expecting an installation.
 * 2. GitHub webhook fires → addPendingInstallation stores the installationId.
 * 3. Frontend polls GET /github/pending-installation → only returns entries
 *    if the authenticated user previously registered intent.
 */

interface PendingInstallation {
  installationId: number
  repos: string[]
  receivedAt: number // epoch ms
}

interface ExpectingUser {
  userId: string
  registeredAt: number // epoch ms
}

const TTL_MS = 10 * 60 * 1000 // 10 minutes

const store = new Map<number, PendingInstallation>()
const expectingUsers = new Map<string, ExpectingUser>()

export function registerExpectingUser(userId: string) {
  expectingUsers.set(userId, { userId, registeredAt: Date.now() })
  pruneExpectingUsers()
}

export function isUserExpecting(userId: string): boolean {
  pruneExpectingUsers()
  return expectingUsers.has(userId)
}

export function clearExpectingUser(userId: string) {
  expectingUsers.delete(userId)
}

export function addPendingInstallation(installationId: number, repos: string[]) {
  store.set(installationId, { installationId, repos, receivedAt: Date.now() })
  pruneExpired()
}

export function popPendingInstallation(): PendingInstallation | undefined {
  pruneExpired()
  let latest: PendingInstallation | undefined
  for (const entry of store.values()) {
    if (!latest || entry.receivedAt > latest.receivedAt) {
      latest = entry
    }
  }
  if (latest) store.delete(latest.installationId)
  return latest
}

export function peekPendingInstallations(): PendingInstallation[] {
  pruneExpired()
  return Array.from(store.values()).sort((a, b) => b.receivedAt - a.receivedAt)
}

export function removePendingInstallation(installationId: number) {
  store.delete(installationId)
}

export function getAllExpectingUserIds(): string[] {
  pruneExpectingUsers()
  return Array.from(expectingUsers.keys())
}

function pruneExpired() {
  const cutoff = Date.now() - TTL_MS
  for (const [id, entry] of store.entries()) {
    if (entry.receivedAt < cutoff) store.delete(id)
  }
}

function pruneExpectingUsers() {
  const cutoff = Date.now() - TTL_MS
  for (const [id, entry] of expectingUsers.entries()) {
    if (entry.registeredAt < cutoff) expectingUsers.delete(id)
  }
}
