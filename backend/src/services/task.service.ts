import { prisma } from '../lib/prisma.js'
import { TaskStatus, Priority } from '@prisma/client'

export const taskService = {
  async getAll(projectId: string) {
    return prisma.task.findMany({
      where: { projectId },
      include: { assignee: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: { assignee: true, project: true },
    })
  },

  async create(data: {
    title: string
    description?: string
    projectId: string
    assigneeId?: string
    priority?: Priority
    deadline?: Date | null
  }) {
    return prisma.task.create({
      data,
      include: { assignee: true },
    })
  },

  async update(id: string, data: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: Priority
    assigneeId?: string
    deadline?: Date | null
  }) {
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