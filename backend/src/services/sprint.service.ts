import { prisma } from '../lib/prisma.js'
import { SprintStatus } from '@prisma/client'
import { DONE_STATUSES } from '../config/constants.js'

const sprintTaskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assigneeId: true,
  completedAt: true,
  assignee: { select: { id: true, name: true, email: true } },
}

export const sprintService = {
  async list(projectId: string) {
    return prisma.sprint.findMany({
      where: { projectId },
      include: {
        tasks: { select: sprintTaskSelect },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(id: string) {
    return prisma.sprint.findUnique({
      where: { id },
      include: {
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async getActiveSprint(projectId: string) {
    return prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      include: {
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async create(data: {
    projectId: string
    name: string
    goal?: string
    startDate?: Date
    endDate?: Date
  }) {
    return prisma.sprint.create({
      data: {
        ...data,
        status: 'PLANNING',
      },
      include: {
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async update(
    id: string,
    data: {
      name?: string
      goal?: string | null
      startDate?: Date
      endDate?: Date
    }
  ) {
    const sprint = await prisma.sprint.findUnique({ where: { id } })
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status !== 'PLANNING') {
      throw new Error('Can only edit sprint details while in PLANNING status')
    }

    return prisma.sprint.update({
      where: { id },
      data,
      include: {
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async startSprint(sprintId: string, data: { startDate: Date; endDate: Date }) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status !== 'PLANNING') {
      throw new Error('Only sprints in PLANNING status can be started')
    }

    if (data.endDate <= data.startDate) {
      throw new Error('End date must be after start date')
    }

    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: 'ACTIVE' },
    })
    if (activeSprint) {
      throw new Error(`Another sprint "${activeSprint.name}" is already active. Complete it first.`)
    }

    return prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'ACTIVE',
        startDate: data.startDate,
        endDate: data.endDate,
      },
      include: {
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async completeSprint(
    sprintId: string,
    moveIncompleteTasksTo: 'BACKLOG' | string
  ) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { tasks: true },
    })
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status !== 'ACTIVE') {
      throw new Error('Only ACTIVE sprints can be completed')
    }

    const completedTasks = sprint.tasks.filter((t) => DONE_STATUSES.includes(t.status))
    const incompleteTasks = sprint.tasks.filter((t) => !DONE_STATUSES.includes(t.status))

    let targetSprintId: string | null = null
    if (moveIncompleteTasksTo !== 'BACKLOG') {
      const targetSprint = await prisma.sprint.findUnique({
        where: { id: moveIncompleteTasksTo },
      })
      if (!targetSprint || targetSprint.projectId !== sprint.projectId) {
        throw new Error('Target sprint not found in this project')
      }
      if (targetSprint.status === 'COMPLETED') {
        throw new Error('Cannot move tasks to a completed sprint')
      }
      targetSprintId = targetSprint.id
    }

    await prisma.$transaction([
      prisma.sprint.update({
        where: { id: sprintId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }),
      ...(incompleteTasks.length > 0
        ? [
            prisma.task.updateMany({
              where: {
                id: { in: incompleteTasks.map((t) => t.id) },
              },
              data: {
                sprintId: targetSprintId,
              },
            }),
          ]
        : []),
    ])

    return {
      sprint: await prisma.sprint.findUnique({
        where: { id: sprintId },
        include: { tasks: { select: sprintTaskSelect } },
      }),
      completedTaskCount: completedTasks.length,
      movedTaskCount: incompleteTasks.length,
      movedTo: moveIncompleteTasksTo === 'BACKLOG' ? 'backlog' : targetSprintId,
    }
  },

  async delete(id: string) {
    const sprint = await prisma.sprint.findUnique({ where: { id } })
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status === 'ACTIVE') {
      throw new Error('Cannot delete an active sprint. Complete it first.')
    }

    return prisma.sprint.delete({ where: { id } })
  },

  async assignTasks(sprintId: string, projectId: string, taskIds: string[]) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint not found')

    if (sprint.status === 'COMPLETED') {
      throw new Error('Cannot assign tasks to a completed sprint')
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { sprintId },
        data: { sprintId: null },
      }),
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
        tasks: { select: sprintTaskSelect },
      },
    })
  },

  async getBurndown(projectId: string, sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        projectId: true,
        startDate: true,
        endDate: true,
        status: true,
        completedAt: true,
      },
    })

    if (!sprint || sprint.projectId !== projectId) return null
    if (!sprint.startDate || !sprint.endDate) return null

    const tasks = await prisma.task.findMany({
      where: { sprintId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        updatedAt: true,
      },
    })

    const totalScope = tasks.length

    const startUTC = new Date(sprint.startDate)
    const endUTC = new Date(sprint.endDate)

    const startOfDayUTC = (d: Date) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dayMs = 24 * 60 * 60 * 1000

    const sprintStart = startOfDayUTC(startUTC)
    const sprintEnd = startOfDayUTC(endUTC)

    const days = Math.max(
      1,
      Math.floor((sprintEnd.getTime() - sprintStart.getTime()) / dayMs) + 1
    )

    const completedByDay: number[] = Array.from({ length: days }, () => 0)

    for (const t of tasks) {
      if (!DONE_STATUSES.includes(t.status)) continue

      const completionDate = t.completedAt ?? t.updatedAt
      const completedDayUTC = startOfDayUTC(new Date(completionDate))
      const diffMs = completedDayUTC.getTime() - sprintStart.getTime()
      const idx = Math.floor(diffMs / dayMs)

      if (idx < 0) {
        completedByDay[0] += 1
      } else if (idx >= days) {
        continue
      } else {
        completedByDay[idx] += 1
      }
    }

    const points: Array<{
      date: string
      completedDaily: number
      completedCumulative: number
      total: number
      idealRemaining: number
      actualRemaining: number
    }> = []

    let completedCumulative = 0
    for (let i = 0; i < days; i += 1) {
      completedCumulative += completedByDay[i]
      const actualRemaining = Math.max(0, totalScope - completedCumulative)

      let idealRemaining = 0
      if (totalScope === 0) {
        idealRemaining = 0
      } else if (days === 1) {
        idealRemaining = totalScope
      } else {
        const ratio = i / (days - 1)
        idealRemaining = Math.max(0, Math.round(totalScope * (1 - ratio)))
      }

      const dayDate = new Date(sprintStart.getTime() + i * dayMs)
      const dateKey = dayDate.toISOString().slice(0, 10)

      points.push({
        date: dateKey,
        completedDaily: completedByDay[i],
        completedCumulative,
        total: totalScope,
        idealRemaining,
        actualRemaining,
      })
    }

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
        status: sprint.status,
      },
      totalScope,
      points,
    }
  },
}
