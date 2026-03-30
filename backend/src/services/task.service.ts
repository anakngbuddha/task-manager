import { prisma } from '../lib/prisma.js'
import { Priority } from '@prisma/client'

const DONE_STATUSES = ['DONE', 'READY']

export const taskService = {
  async getAll(projectId: string) {
    return prisma.task.findMany({
      where: { projectId, parentId: null },
      include: { 
        assignee: true,
        subtasks: { include: { assignee: true } },
        blockingTasks: { include: { blockedTask: true } },
        blockedByTasks: { include: { blockingTask: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: { 
        assignee: true, 
        project: true,
        subtasks: { include: { assignee: true } },
      },
    })
  },

  async create(data: {
    title: string
    description?: string
    projectId: string
    assigneeId?: string
    priority?: Priority
    status?: string
    sprintId?: string | null
    parentId?: string | null
    startDate?: Date | null
    deadline?: Date | null
  }) {
    const completedAt = data.status && DONE_STATUSES.includes(data.status) ? new Date() : null
    return prisma.task.create({
      data: { ...data, completedAt },
      include: { assignee: true, subtasks: true },
    })
  },

  async update(id: string, data: {
    title?: string
    description?: string
    status?: string
    priority?: Priority
    assigneeId?: string
    sprintId?: string | null
    startDate?: Date | null
    deadline?: Date | null
  }) {
    if (data.status !== undefined) {
      const existing = await prisma.task.findUnique({ where: { id }, select: { status: true } })
      if (existing) {
        const wasDone = DONE_STATUSES.includes(existing.status)
        const isDone = DONE_STATUSES.includes(data.status)

        if (isDone && !wasDone) {
          ;(data as any).completedAt = new Date()
        } else if (!isDone && wasDone) {
          ;(data as any).completedAt = null
        }
      }
    }

    return prisma.task.update({
      where: { id },
      data,
      include: { assignee: true },
    })
  },

  async delete(id: string) {
    return prisma.task.delete({ where: { id } })
  },
}
