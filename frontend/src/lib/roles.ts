/** System-level admin (better-auth / Prisma `User.role`). */
export function isSystemAdmin(role: unknown): boolean {
  const normalized = String(role ?? '').toLowerCase()
  return normalized === 'admin'
}

export function postLoginPath(role: unknown): string {
  return isSystemAdmin(role) ? '/admin/dashboard' : '/dashboard'
}
