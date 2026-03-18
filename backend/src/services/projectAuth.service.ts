import { prisma } from '../lib/prisma.js'

export async function requireProjectRole(projectId: string, userId: string, allowed: Array<'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER'>) {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  })
  if (!membership) throw new Error('FORBIDDEN')
  if (!allowed.includes(membership.role as any)) throw new Error('FORBIDDEN')
  return membership.role as 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER'
}

