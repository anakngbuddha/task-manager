import { prisma } from '../lib/prisma.js'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'READY'
const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']
const COMPLETED_STATUSES: TaskStatus[] = ['DONE', 'READY']
const MS_PER_HOUR = 1000 * 60 * 60

function countActiveMembers(projects: any[]): number {
  const memberIds = new Set<string>()
  for (const p of projects) {
    for (const m of p.members ?? []) {
      if (m?.userId) memberIds.add(m.userId)
    }
  }
  return memberIds.size
}

function buildTaskStatusMaps(
  projectIds: string[],
  statusCounts: { projectId: string; status: string; _count: { _all: number } }[],
) {
  const statusMap: Record<string, Record<TaskStatus, number>> = {}
  const totalMap: Record<string, number> = {}
  const doneMap: Record<string, number> = {}
  let totalTasksAll = 0
  let completedTasksAll = 0

  for (const pId of projectIds) {
    statusMap[pId] = TASK_STATUSES.reduce(
      (acc, s) => { acc[s] = 0; return acc },
      {} as Record<TaskStatus, number>,
    )
    totalMap[pId] = 0
    doneMap[pId] = 0
  }

  for (const row of statusCounts) {
    const status = row.status as TaskStatus
    const count = row._count._all
    statusMap[row.projectId][status] = count
    totalMap[row.projectId] += count
    totalTasksAll += count
    if (COMPLETED_STATUSES.includes(status)) {
      doneMap[row.projectId] += count
      completedTasksAll += count
    }
  }

  return { statusMap, totalMap, doneMap, totalTasksAll, completedTasksAll }
}

function calculateAverageCompletionHours(
  projectIds: string[],
  doneTasks: { projectId: string; createdAt: Date; updatedAt: Date }[],
): Record<string, number | null> {
  const acc: Record<string, { sumHours: number; count: number }> = {}
  for (const pId of projectIds) {
    acc[pId] = { sumHours: 0, count: 0 }
  }

  for (const t of doneTasks) {
    const durationMs = t.updatedAt.getTime() - t.createdAt.getTime()
    if (durationMs <= 0) continue
    acc[t.projectId].sumHours += durationMs / MS_PER_HOUR
    acc[t.projectId].count += 1
  }

  const result: Record<string, number | null> = {}
  for (const pId of projectIds) {
    result[pId] = acc[pId].count ? acc[pId].sumHours / acc[pId].count : null
  }
  return result
}

function mapProjectMembers(members: any[]): { id: string; name: string; email: string; avatar: string }[] {
  return (members ?? [])
    .map((m: any) => m?.user)
    .filter(Boolean)
    .map((u: any) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar }))
}

export const projectService = {
  async getDashboardForUser(userId: string) {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const projectIds = projects.map((p) => p.id)
    if (projectIds.length === 0) {
      return {
        totalProjects: 0, totalTasks: 0, completedTasks: 0,
        activeMembers: 0, finishedProjects: 0, finishedPercentage: 0, projects: [],
      }
    }

    const [statusCounts, doneTasks] = await Promise.all([
      prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: { projectId: { in: projectIds } },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: { projectId: { in: projectIds }, status: 'DONE' },
        select: { projectId: true, createdAt: true, updatedAt: true },
      }),
    ])

    const activeMembers = countActiveMembers(projects)
    const { statusMap, totalMap, doneMap, totalTasksAll, completedTasksAll } =
      buildTaskStatusMaps(projectIds, statusCounts)
    const avgHoursMap = calculateAverageCompletionHours(projectIds, doneTasks)

    const computedProjects = projects.map((p) => {
      const totalTasks = totalMap[p.id] ?? 0
      const doneTasksCount = doneMap[p.id] ?? 0
      return {
        id: p.id,
        name: p.name,
        status: (p as any).status,
        totalTasks,
        doneTasks: doneTasksCount,
        completionPct: totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0,
        isFinished: (p as any).status === 'COMPLETED',
        members: mapProjectMembers((p as any).members),
        taskCountsByStatus: statusMap[p.id],
        avgCompletionHours: avgHoursMap[p.id],
      }
    })

    const finishedProjectsCount = computedProjects.filter((p) => p.isFinished).length
    return {
      totalProjects: computedProjects.length,
      totalTasks: totalTasksAll,
      completedTasks: completedTasksAll,
      activeMembers,
      finishedProjects: finishedProjectsCount,
      finishedPercentage: computedProjects.length
        ? (finishedProjectsCount / computedProjects.length) * 100
        : 0,
      projects: computedProjects,
    }
  },

  async getAllForUser(userId: string) {
    return prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: true } },
        _count: { select: { tasks: true } },
      },
    })
  },

  async getById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        tasks: { include: { assignee: true } },
      },
    })
  },

  async create(name: string, userId: string) {
    return prisma.project.create({
      data: {
        name,
        members: {
          create: { userId, role: 'MASTER_ADMIN' },
        },
      },
      include: { members: true },
    })
  },

  async update(id: string, data: { name?: string; status?: any; boardColumns?: any; githubStatusMap?: any }) {
    return prisma.project.update({
      where: { id },
      data,
    })
  },

  async delete(id: string) {
    return prisma.project.delete({ where: { id } })
  },

  async addMember(projectId: string, userId: string) {
    return prisma.projectMember.create({
      data: { projectId, userId, role: 'MEMBER' },
    })
  },

  async listMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { role: 'asc' },
    })
  },

  async getMemberRole(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { role: true },
    })
  },

  async updateMemberRole(projectId: string, userId: string, role: 'MASTER_ADMIN' | 'PROJECT_MANAGER' | 'MEMBER') {
    return prisma.projectMember.update({
      where: { userId_projectId: { userId, projectId } },
      data: { role },
    })
  },

  async getPendingDeadlines(userId: string, daysAhead: number, limit: number) {
    const now = new Date()
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, project: { select: { id: true, name: true } } },
    })
    const projectIds = memberships.map((m) => m.projectId)
    if (projectIds.length === 0) return []

    const projectMap = new Map(memberships.map((m) => [m.projectId, m.project]))

    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        deadline: { gt: now, lte: end },
        status: { notIn: ['DONE', 'READY'] },
      },
      select: { id: true, title: true, deadline: true, status: true, projectId: true },
      orderBy: { deadline: 'asc' },
      take: limit,
    })

    return tasks.map((t) => ({
      kind: 'DEADLINE' as const,
      id: t.id,
      title: t.title,
      deadline: t.deadline!.toISOString(),
      status: t.status,
      project: projectMap.get(t.projectId) ?? { id: t.projectId, name: '' },
    }))
  },
}