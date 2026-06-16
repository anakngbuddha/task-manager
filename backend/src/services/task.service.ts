import { prisma } from '../lib/prisma.js'
import { Priority, TaskType } from '@prisma/client'
import { DONE_STATUSES } from '../config/constants.js'

export const taskService = {
  async getAll(projectId: string) {
    return prisma.task.findMany({
      where: { projectId },
      include: { 
        assignee: true,
        children: { select: { id: true, title: true, type: true, status: true } },
        parent:   { select: { id: true, title: true, type: true } },
        blockingTasks: { include: { blockedTask: true } },
        blockedByTasks: { include: { blockingTask: true } },
        tags: { include: { tag: true } },
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
        parent:   { select: { id: true, title: true, type: true } },
        children: { select: { id: true, title: true, type: true, status: true } },
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
    type?: TaskType
    hierarchyLevel?: number
    startDate?: Date | null
    deadline?: Date | null
  }) {
    const completedAt = data.status && DONE_STATUSES.includes(data.status) ? new Date() : null
    return prisma.task.create({
      data: { ...data, completedAt },
      include: { assignee: true, children: true, parent: true },
    })
  },

  async update(id: string, data: {
    title?: string
    description?: string
    status?: string
    priority?: Priority
    assigneeId?: string
    sprintId?: string | null
    parentId?: string | null
    type?: TaskType
    hierarchyLevel?: number
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
