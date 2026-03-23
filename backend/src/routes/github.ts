import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { getInstallationToken } from '../lib/githubApp.js'

const INSTALLATION_URL =
  process.env.GITHUB_INSTALLATION_URL ||
  'https://github.com/apps/wsi-taska/installations/new'

const FRONTEND_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ||
  'https://task-manager-mauve-eta.vercel.app'

export async function githubRoutes(app: FastifyInstance) {
  // ── Connect button URL ────────────────────────────────────────────────
  app.get(
    '/github/connect',
    { preHandler: authenticate },
    async (req) => {
      return { url: INSTALLATION_URL }
    },
  )

  // ── GitHub post-install callback (redirect-based) ─────────────────────
  app.get(
    '/github/callback',
    { preHandler: authenticate },
    async (req, reply) => {
      const { installation_id } = req.query as {
        installation_id?: string
      }

      if (!installation_id) {
        return reply.status(400).send({ error: 'Missing installation_id' })
      }

      const instId = parseInt(installation_id, 10)

      let projectId: string | null = null
      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id },
        select: { projectId: true },
        orderBy: { projectId: 'asc' },
      })
      projectId = membership?.projectId ?? null

      if (!projectId) {
        return reply.redirect(
          `${FRONTEND_URL}/dashboard?github_error=no_project`,
        )
      }

      await prisma.githubInstallation.upsert({
        where: { installationId: instId },
        update: {
          userId: req.authUser.id,
          projectId,
        },
        create: {
          installationId: instId,
          userId: req.authUser.id,
          projectId,
        },
      })

      return reply.redirect(
        `${FRONTEND_URL}/projects/${projectId}/settings?github_connected=true`,
      )
    },
  )

  // ── Manually link an installation to a specific project ───────────────
  app.post(
    '/projects/:projectId/github/connect',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }
      const { installationId } = req.body as { installationId: number }

      if (!installationId || typeof installationId !== 'number') {
        return reply.status(400).send({ error: 'installationId (number) is required' })
      }

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Not a member of this project' })
      }

      const installation = await prisma.githubInstallation.upsert({
        where: { installationId },
        update: {
          userId: req.authUser.id,
          projectId,
        },
        create: {
          installationId,
          userId: req.authUser.id,
          projectId,
        },
        include: { repositories: true },
      })

      return reply.status(200).send(installation)
    },
  )

  // ── Get GitHub installation for a project ─────────────────────────────
  app.get(
    '/projects/:projectId/github',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
        include: { repositories: true },
      })

      if (!installation) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      return installation
    },
  )

  // ── Disconnect GitHub from a project ──────────────────────────────────
  app.delete(
    '/projects/:projectId/github',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
      })

      if (!installation) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      await prisma.githubInstallation.delete({
        where: { id: installation.id },
      })

      return reply.status(204).send()
    },
  )

  // ── List repos for a project's installation ───────────────────────────
  app.get(
    '/projects/:projectId/github/repos',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
      })

      if (!installation) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      try {
        const token = await getInstallationToken(installation.installationId)

        const res = await fetch(
          'https://api.github.com/installation/repositories?per_page=100',
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        )

        if (!res.ok) {
          const text = await res.text()
          return reply
            .status(502)
            .send({ error: 'GitHub API error', detail: text })
        }

        const data = (await res.json()) as {
          repositories: Array<{ id: number; full_name: string; private: boolean; html_url: string }>
        }

        return {
          installationId: installation.installationId,
          repositories: data.repositories.map((r) => ({
            repoId: r.id,
            fullName: r.full_name,
            private: r.private,
            htmlUrl: r.html_url,
          })),
        }
      } catch (err: any) {
        return reply
          .status(502)
          .send({ error: 'Failed to fetch repos', detail: err.message })
      }
    },
  )
}
