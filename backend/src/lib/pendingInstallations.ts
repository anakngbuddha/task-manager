/**
 * In-memory store for GitHub App installations received via webhook
 * before a user has had the chance to claim them.
 *
 * TTL: 10 minutes. Safe for single-instance deployments (Render free tier).
 */

interface PendingInstallation {
  installationId: number
  repos: string[]
  receivedAt: number // epoch ms
}

const TTL_MS = 10 * 60 * 1000 // 10 minutes

const store = new Map<number, PendingInstallation>()

export function addPendingInstallation(installationId: number, repos: string[]) {
  store.set(installationId, { installationId, repos, receivedAt: Date.now() })
  // Clean up old entries while we're here
  pruneExpired()
}

export function popPendingInstallation(): PendingInstallation | undefined {
  pruneExpired()
  // Return and remove the most recently received pending installation
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

function pruneExpired() {
  const cutoff = Date.now() - TTL_MS
  for (const [id, entry] of store.entries()) {
    if (entry.receivedAt < cutoff) store.delete(id)
  }
}
