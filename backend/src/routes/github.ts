import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { getInstallationToken } from '../lib/githubApp.js'
import {
  peekPendingInstallations,
  removePendingInstallation,
  registerExpectingUser,
  isUserExpecting,
  clearExpectingUser,
} from '../lib/pendingInstallations.js'
import { requireProjectRole } from '../services/projectAuth.service.js'

const INSTALLATION_URL =
  process.env.GITHUB_INSTALLATION_URL ||
  'https://github.com/apps/wsi-taska/installations/new'

const FRONTEND_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ||
  'http://localhost:5173'

export async function githubRoutes(app: FastifyInstance) {
  // ── Connect button URL ────────────────────────────────────────────────
  app.get(
    '/github/connect',
    { preHandler: authenticate },
    async (req) => {
      app.log.info({ userId: req.authUser.id }, 'GitHub connect requested — registering expecting user')
      registerExpectingUser(req.authUser.id)
      return { url: INSTALLATION_URL }
    },
  )

  // ── Check for a pending (unclaimed) GitHub App installation ──────────
  app.get(
    '/github/pending-installation',
    { preHandler: authenticate },
    async (req, reply) => {
      // Disabled for security. Polling globally allows users to accidentally steal installations.
      // Auto-linking now strictly relies on the ?github_installation_id callback URL.
      return reply.status(204).send()
    },
  )

  // ── GitHub post-install callback (redirect-based) ─────────────────────
  app.get(
    '/github/callback',
    async (req, reply) => {
      const { installation_id, setup_action } = req.query as {
        installation_id?: string
        setup_action?: string
      }

      if (!installation_id) {
        return reply.redirect(`${FRONTEND_URL}/profile?github_error=missing_id`)
      }

      // Both fresh installs (setup_action=install) and updates/re-authorizations
      // (setup_action=update) carry the same installation_id param.
      return reply.redirect(
        `${FRONTEND_URL}/profile?github_installation_id=${installation_id}`,
      )
    },
  )

  // ── Link an installation to current user (account binding) ───────────
  app.post(
    '/github/connect',
    { preHandler: authenticate },
    async (req, reply) => {
      const { installationId } = req.body as { installationId: number }

      if (!installationId || typeof installationId !== 'number') {
        return reply.status(400).send({ error: 'installationId (number) is required' })
      }

      // Validate the installation is real on GitHub by trying to get a token.
      try {
        await getInstallationToken(installationId)
      } catch (err: any) {
        app.log.warn({ installationId, err: err.message }, 'GitHub installation validation failed')
        return reply.status(400).send({
          error: 'Invalid GitHub installation. The app may have been uninstalled or the ID is wrong.',
        })
      }

      const existing = await prisma.githubInstallation.findUnique({
        where: { installationId },
      })

      if (existing && existing.userId !== req.authUser.id) {
        return reply.status(403).send({
          error: 'This GitHub installation is already linked to another account. Please ask the owner to disconnect it first, or use a different GitHub account.'
        })
      }

      const installation = await prisma.githubInstallation.upsert({
        where: { installationId },
        update: {
          userId: req.authUser.id,
          projectId: null,
        },
        create: {
          installationId,
          userId: req.authUser.id,
          projectId: null,
        },
        include: { repositories: true },
      })

      removePendingInstallation(installationId)
      clearExpectingUser(req.authUser.id)

      app.log.info(
        { installationId, userId: req.authUser.id },
        'GitHub installation linked to user',
      )

      return reply.status(200).send(installation)
    },
  )

  // ── Get installation for current user (Profile page) ─────────────────
  app.get(
    '/github/installation',
    { preHandler: authenticate },
    async (req, reply) => {
      const installation = await prisma.githubInstallation.findFirst({
        where: { userId: req.authUser.id },
        orderBy: { createdAt: 'desc' },
      })
      if (!installation) {
        return reply.status(200).send(null)
      }

      try {
        await getInstallationToken(installation.installationId)
      } catch {
        await prisma.githubInstallation.delete({ where: { id: installation.id } }).catch(() => {})
        return reply.status(200).send(null)
      }

      return installation
    },
  )

  // ── Get GitHub assignment status for a project ────────────────────────
  app.get(
    '/projects/:projectId/github',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const assigned = await prisma.projectRepository.findMany({
        where: { projectId },
        include: { repo: true },
      })
      if (assigned.length === 0) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      return { connected: true, assignedRepoCount: assigned.length }
    },
  )

  // ── Disconnect GitHub account (user-level) ────────────────────────────
  app.delete(
    '/github/installation',
    { preHandler: authenticate },
    async (req, reply) => {
      await prisma.githubInstallation.deleteMany({
        where: { userId: req.authUser.id },
      })
      return reply.status(204).send()
    },
  )

  // ── Backward compatible disconnect endpoint ───────────────────────────
  app.delete(
    '/projects/:projectId/github',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const deleted = await prisma.githubInstallation.deleteMany({ where: { userId: req.authUser.id } })
      app.log.info({ count: deleted.count, projectId }, 'GitHub installations disconnected (user-level)')
      return reply.status(204).send()
    },
  )

  // ── List assigned repos for project ───────────────────────────────────
  app.get(
    '/projects/:projectId/github/repos',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const assigned = await prisma.projectRepository.findMany({
        where: { projectId },
        include: { repo: true },
        orderBy: { createdAt: 'desc' },
      })

      return {
        repositories: assigned.map((a) => ({
          id: a.repo.id,
          repoId: a.repo.repoId,
          fullName: a.repo.repoFullName,
          private: true,
          htmlUrl: `https://github.com/${a.repo.repoFullName}`,
        })),
      }
    },
  )

  // ── Assign a repo to a project (admin only) ──────────────────────────
  app.post(
    '/projects/:projectId/github/repos',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }
      const { repoId } = req.body as { repoId: string }

      if (!repoId) return reply.status(400).send({ error: 'repoId is required' })

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const repo = await prisma.githubRepository.findUnique({ where: { id: repoId } })
      if (!repo) return reply.status(404).send({ error: 'Repository not found' })

      const assigned = await prisma.projectRepository.upsert({
        where: { projectId_repoId: { projectId, repoId } },
        update: {},
        create: { projectId, repoId },
        include: { repo: true },
      })

      return reply.status(201).send({
        id: assigned.id,
        repoId: assigned.repo.id,
        fullName: assigned.repo.repoFullName,
        htmlUrl: `https://github.com/${assigned.repo.repoFullName}`,
      })
    },
  )

  // ── Remove project repo assignment (admin only) ──────────────────────
  app.delete(
    '/projects/:projectId/github/repos/:repoId',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId, repoId } = req.params as { projectId: string; repoId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await prisma.projectRepository.deleteMany({ where: { projectId, repoId } })
      return reply.status(204).send()
    },
  )

  // ── Detect unclaimed installations directly from GitHub API ─────────
  app.get(
    '/github/detect-installation',
    { preHandler: authenticate },
    async (req, reply) => {
      // Disabled for security. Fetching all app installations globally and picking an unclaimed one
      // is highly insecure in a multi-tenant environment.
      return reply.status(204).send()
    },
  )
}
