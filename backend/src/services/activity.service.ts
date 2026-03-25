import { prisma } from '../lib/prisma.js'

export type ActivityCreateInput = {
  projectId: string
  actorId: string
  type: string
  entityType: string
  entityId: string
  metadata?: any
}

export const activityService = {
  async record(input: ActivityCreateInput) {
    return prisma.activityEvent.create({
      data: {
        projectId: input.projectId,
        actorId: input.actorId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? undefined,
      },
    })
  },

  async listForUser(userId: string, opts?: { take?: number }) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    const projectIds = memberships.map((m) => m.projectId)
    if (projectIds.length === 0) return []

    return prisma.activityEvent.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        project: true,
        actor: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    })
  },

  async listForProject(projectId: string, opts?: { take?: number }) {
    return prisma.activityEvent.findMany({
      where: { projectId },
      include: {
        project: true,
        actor: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    })
  },

  async contributionsForProject(projectId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 7), 370)

    // MySQL date bucketing
    const rows = await prisma.$queryRaw<
      Array<{ userId: string; day: string; count: number }>
    >`
      SELECT
        actorId as userId,
        DATE(createdAt) as day,
        COUNT(*) as count
      FROM ActivityEvent
      WHERE projectId = ${projectId}
        AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ${safeDays} DAY)
      GROUP BY actorId, DATE(createdAt)
    `

    // member list (to ensure we include 0-contribution members)
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    const byUser: Record<string, Record<string, number>> = {}
    for (const m of members) byUser[m.userId] = {}
    for (const r of rows) {
      if (!byUser[r.userId]) byUser[r.userId] = {}
      byUser[r.userId][String(r.day)] = Number(r.count)
    }

    return {
      days: safeDays,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user?.name ?? null,
        email: m.user?.email ?? null,
        countsByDay: byUser[m.userId] ?? {},
      })),
    }
  },

  async contributionsForUser(userId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 7), 370)

    const rows = await prisma.$queryRaw<
      Array<{ day: string; count: number }>
    >`
      SELECT
        DATE(a.createdAt) as day,
        COUNT(*) as count
      FROM ActivityEvent a
      INNER JOIN ProjectMember pm ON pm.projectId = a.projectId AND pm.userId = ${userId}
      WHERE a.actorId = ${userId}
        AND a.createdAt >= DATE_SUB(CURDATE(), INTERVAL ${safeDays} DAY)
      GROUP BY DATE(a.createdAt)
    `

    const countsByDay: Record<string, number> = {}
    for (const r of rows) countsByDay[String(r.day)] = Number(r.count)

    return { days: safeDays, userId, countsByDay }
  },

  async taskContributionsForProject(projectId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 7), 370)
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000)

    // Fetch all DONE or READY tasks in the window (both count as completed)
    const tasks = await prisma.task.findMany({
      where: { projectId, status: { in: ['DONE', 'READY'] }, updatedAt: { gte: cutoff } },
      select: { assigneeId: true, updatedAt: true },
    })

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    const memberIds = members.map((m) => m.userId)
    const byUser: Record<string, Record<string, number>> = {}
    for (const m of members) byUser[m.userId] = {}

    for (const task of tasks) {
      const day = task.updatedAt.toISOString().slice(0, 10) // YYYY-MM-DD
      // If assigned to someone, credit them. Otherwise credit all members.
      const targets = task.assigneeId ? [task.assigneeId] : memberIds
      for (const uid of targets) {
        if (!byUser[uid]) byUser[uid] = {}
        byUser[uid][day] = (byUser[uid][day] ?? 0) + 1
      }
    }

    return {
      days: safeDays,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user?.name ?? null,
        email: m.user?.email ?? null,
        countsByDay: byUser[m.userId] ?? {},
      })),
    }
  },

  async taskContributionsForUser(userId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 7), 370)
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000)

    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    const projectIds = memberships.map((m) => m.projectId)
    if (projectIds.length === 0) return { days: safeDays, userId, countsByDay: {} }

    // Tasks directly assigned to the user (DONE or READY = contribution)
    const assignedTasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds }, assigneeId: userId, status: { in: ['DONE', 'READY'] }, updatedAt: { gte: cutoff } },
      select: { updatedAt: true },
    })

    // Unassigned tasks in user's projects (everyone gets credit)
    const unassignedTasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds }, assigneeId: null, status: { in: ['DONE', 'READY'] }, updatedAt: { gte: cutoff } },
      select: { updatedAt: true },
    })

    const countsByDay: Record<string, number> = {}
    for (const task of [...assignedTasks, ...unassignedTasks]) {
      const day = task.updatedAt.toISOString().slice(0, 10)
      countsByDay[day] = (countsByDay[day] ?? 0) + 1
    }

    return { days: safeDays, userId, countsByDay }
  },
}
