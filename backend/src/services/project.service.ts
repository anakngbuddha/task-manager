import { prisma } from '../lib/prisma.js'
import { TaskStatus } from '@prisma/client'

const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']

export const projectService = {
  async getDashboardForUser(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const projectIds = projects.map((p) => p.id)
    if (projectIds.length === 0) {
      return {
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        activeMembers: 0,
        finishedProjects: 0,
        finishedPercentage: 0,
        projects: [],
      }
    }

    const activeMembersSet = new Set<string>()
    for (const p of projects) {
      for (const m of (p as any).members ?? []) {
        if (m?.userId) activeMembersSet.add(m.userId)
      }
    }

    // Count tasks per project + per status
    let totalTasksAll = 0
    let completedTasksAll = 0
    const statusCounts = await prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    })

    // Fetch DONE tasks to compute average completion time.
    // Definition: average (updatedAt - createdAt) for tasks currently in DONE.
    const doneTasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'DONE',
      },
      select: { projectId: true, createdAt: true, updatedAt: true },
    })

    const statusMap: Record<string, Record<TaskStatus, number>> = {}
    const totalMap: Record<string, number> = {}
    const doneMap: Record<string, number> = {}

    for (const pId of projectIds) {
      statusMap[pId] = TASK_STATUSES.reduce((acc, s) => {
        acc[s] = 0
        return acc
      }, {} as Record<TaskStatus, number>)
      totalMap[pId] = 0
      doneMap[pId] = 0
    }

    for (const row of statusCounts) {
      const pId = row.projectId
      const status = row.status as TaskStatus
      const count = row._count._all
      statusMap[pId][status] = count
      totalMap[pId] += count
      totalTasksAll += count
      if (status === 'DONE' || status === 'READY') {
        doneMap[pId] = (doneMap[pId] || 0) + count
        completedTasksAll += count
      }
    }

    const avgCompletionAccumulator: Record<string, { sumHours: number; count: number }> = {}
    for (const pId of projectIds) {
      avgCompletionAccumulator[pId] = { sumHours: 0, count: 0 }
    }

    for (const t of doneTasks) {
      const durationMs = t.updatedAt.getTime() - t.createdAt.getTime()
      if (durationMs <= 0) continue
      const hours = durationMs / (1000 * 60 * 60)
      avgCompletionAccumulator[t.projectId].sumHours += hours
      avgCompletionAccumulator[t.projectId].count += 1
    }

    const computedProjects = projects.map((p) => {
      const totalTasks = totalMap[p.id] ?? 0
      const doneTasksCount = doneMap[p.id] ?? 0
      const completionPct = totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0
      const isFinished = (p as any).status === 'COMPLETED'

      const acc = avgCompletionAccumulator[p.id]
      const avgCompletionHours = acc?.count ? acc.sumHours / acc.count : null

      return {
        id: p.id,
        name: p.name,
        status: (p as any).status,
        totalTasks,
        doneTasks: doneTasksCount,
        completionPct,
        isFinished,
        members: (p as any).members
          ? (p as any).members
              .map((m: any) => m?.user)
              .filter(Boolean)
              .map((u: any) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                avatar: u.avatar,
              }))
          : [],
        taskCountsByStatus: statusMap[p.id],
        avgCompletionHours,
      }
    })

    const finishedProjectsCount = computedProjects.filter((p: any) => p.isFinished).length
    const finishedPercentage = computedProjects.length
      ? (finishedProjectsCount / computedProjects.length) * 100
      : 0

    return {
      totalProjects: computedProjects.length,
      totalTasks: totalTasksAll,
      completedTasks: completedTasksAll,
      activeMembers: activeMembersSet.size,
      finishedProjects: finishedProjectsCount,
      finishedPercentage,
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

  async update(id: string, data: { name?: string; status?: any }) {
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
}