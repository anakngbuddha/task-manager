import { prisma } from '../lib/prisma.js'

export const projectService = {
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
          create: { userId, role: 'OWNER' },
        },
      },
      include: { members: true },
    })
  },

  async update(id: string, name: string) {
    return prisma.project.update({
      where: { id },
      data: { name },
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
}