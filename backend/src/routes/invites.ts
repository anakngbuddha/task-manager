import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { projectService } from '../services/project.service.js'
import { prisma } from '../lib/prisma.js'
import { randomBytes } from 'crypto'

function generateCode() {
  return randomBytes(6).toString('base64url')
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/invites', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const userId = req.authUser.id

    const project = await projectService.getById(projectId)
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

    const invite = await prisma.projectInvite.create({
      data: {
        code,
        projectId,
        createdById: userId,
        expiresAt,
      },
    })

    return {
      code: invite.code,
      projectId,
      expiresAt: invite.expiresAt,
    }
  })

  app.get('/invites/:code', async (req, reply) => {
    const { code } = req.params as { code: string }

    const invite = await prisma.projectInvite.findUnique({
      where: { code },
      include: { project: true },
    })

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found' })
    }

    const isExpired = invite.expiresAt.getTime() < Date.now()

    return {
      code: invite.code,
      projectId: invite.projectId,
      projectName: invite.project.name,
      expiresAt: invite.expiresAt,
      isExpired,
    }
  })

  app.post('/invites/:code/accept', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const { code } = req.params as { code: string }
    const userId = req.authUser.id

    const invite = await prisma.projectInvite.findUnique({
      where: { code },
    })

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found' })
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      return reply.status(400).send({ error: 'Invite has expired' })
    }

    await projectService.addMember(invite.projectId, userId).catch(() => {
      // ignore if already a member (unique constraint)
    })

    await prisma.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedById: userId },
    })

    const project = await projectService.getById(invite.projectId)

    return reply.send({
      projectId: invite.projectId,
      projectName: project?.name ?? '',
    })
  })
}

