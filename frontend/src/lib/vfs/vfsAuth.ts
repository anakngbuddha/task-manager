/**
 * vfsAuth.ts — Frontend authorization guard for VFS write commands.
 *
 * Defence-in-depth: this guard fires BEFORE any API call, giving
 * an immediate, descriptive error to the terminal user.
 *
 * The backend enforces the same rules independently via
 * requireProjectRole(), so even if this file were bypassed, the
 * API would still return 403.
 */

export type EffectiveRole = 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | null

/** Thrown by assertVFSRole when authorization fails. */
export class VFSAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VFSAuthError'
  }
}

/**
 * Asserts that `userRole` is in `required`.
 * Throws a descriptive VFSAuthError if not.
 *
 * @param userRole  The caller's effective project role (or null if not a member)
 * @param required  The roles that are permitted to run this command
 * @param command   The command name, for the error message
 */
export function assertVFSRole(
  userRole: EffectiveRole,
  required: EffectiveRole[],
  command: string
): void {
  if (!userRole || !required.includes(userRole)) {
    const requiredStr = required.filter(Boolean).join(' or ')
    throw new VFSAuthError(
      `[EPERM] ${command}: Permission denied.\n` +
        `  Your role : ${userRole ?? 'none (not a project member)'}\n` +
        `  Required  : ${requiredStr}`
    )
  }
}

/**
 * Convenience wrapper — returns the VFSAuthError message lines
 * as OutputLineSpec[], suitable for returning directly from a handler.
 */
export function authDeniedLines(
  userRole: EffectiveRole,
  required: EffectiveRole[],
  command: string
): Array<{ type: 'stderr'; content: string }> {
  const requiredStr = required.filter(Boolean).join(' or ')
  return [
    { type: 'stderr' as const, content: `[EPERM] ${command}: Permission denied.` },
    { type: 'stderr' as const, content: `  Your role : ${userRole ?? 'none'}` },
    { type: 'stderr' as const, content: `  Required  : ${requiredStr}` },
  ]
}
