import { prisma } from '../lib/prisma.js'
import { SprintStatus } from '@prisma/client'

export const sprintService = {
  async list(projectId: string) {
    return prisma.sprint.findMany({
      where: { projectId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    })
  },

  async getById(id: string) {
    return prisma.sprint.findUnique({
      where: { id },
      include: { tasks: true },
    })
  },

  async create(data: {
    projectId: string
    name: string
    goal?: string
    startDate: Date
    endDate: Date
    status?: SprintStatus
  }) {
    return prisma.sprint.create({ data, include: { tasks: true } })
  },

  async update(
    id: string,
    data: {
      name?: string
      goal?: string | null
      startDate?: Date
      endDate?: Date
      status?: SprintStatus
    }
  ) {
    return prisma.sprint.update({
      where: { id },
      data,
      include: { tasks: true },
    })
  },

  async delete(id: string) {
    // Unlink tasks before deleting (FK is SetNull, Prisma handles it via the relation)
    return prisma.sprint.delete({ where: { id } })
  },

  /**
   * Replace the full task list for a sprint.
   * - Clears sprintId from all tasks currently in this sprint.
   * - Sets sprintId on the provided task IDs (which must belong to the same project).
   */
  async assignTasks(sprintId: string, projectId: string, taskIds: string[]) {
    await prisma.$transaction([
      // Clear all existing assignments for this sprint
      prisma.task.updateMany({
        where: { sprintId },
        data: { sprintId: null },
      }),
      // Assign new tasks — only tasks that belong to the same project
      ...(taskIds.length > 0
        ? [
            prisma.task.updateMany({
              where: { id: { in: taskIds }, projectId },
              data: { sprintId },
            }),
          ]
        : []),
    ])

    return prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })
  },
}
