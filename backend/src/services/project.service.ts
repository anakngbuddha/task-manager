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
          create: { userId, role: 'MASTER_ADMIN' },
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