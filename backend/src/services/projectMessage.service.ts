import { prisma } from '../lib/prisma.js'

export const projectMessageService = {
  async listForProject(projectId: string) {
    return prisma.projectMessage.findMany({
      where: { projectId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    })
  },

  async create(params: { projectId: string; authorId: string; content: string; fileUrl?: string; fileName?: string }) {
    const { projectId, authorId, content, fileUrl, fileName } = params
    return prisma.projectMessage.create({
      data: { projectId, authorId, content, fileUrl, fileName },
      include: { author: true },
    })
  },
}

