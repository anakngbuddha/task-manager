import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { getInstallationToken } from '../lib/githubApp.js'
import { peekPendingInstallations, removePendingInstallation } from '../lib/pendingInstallations.js'

const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG || 'wsi-taska'

const INSTALLATION_URL =
  process.env.GITHUB_INSTALLATION_URL ||
  `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`

const FRONTEND_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ||
  'https://task-manager-mauve-eta.vercel.app'

const BACKEND_URL =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
  'http://localhost:3000'

export async function githubRoutes(app: FastifyInstance) {
  // ── Connect button URL ────────────────────────────────────────────────
  app.get(
    '/github/connect',
    { preHandler: authenticate },
    async (req) => {
      const callbackUrl = `${BACKEND_URL}/api/github/callback`
      const stateParam = encodeURIComponent(callbackUrl)
      const url = `${INSTALLATION_URL}?state=${stateParam}`
      return { url }
    },
  )

  // ── Check for a pending (unclaimed) GitHub App installation ──────────
  // The frontend polls this after the user clicks "Install GitHub App".
  // When the webhook fires, the installationId lands in the in-memory store.
  // The authenticated user claims it and we remove it from the store.
  app.get(
    '/github/pending-installation',
    { preHandler: authenticate },
    async (_req, reply) => {
      const pending = peekPendingInstallations()
      if (pending.length === 0) {
        return reply.status(204).send()
      }
      // Return the most recent one (first in the sorted array)
      const latest = pending[0]
      return reply.status(200).send({
        installationId: latest.installationId,
        repos: latest.repos,
      })
    },
  )

  // ── GitHub post-install callback (redirect-based) ─────────────────────
  // No authenticate middleware here — GitHub redirects the browser directly
  // to this URL after installation, and cross-origin session cookies are
  // often not sent. Instead we redirect to the frontend with the
  // installation_id so the frontend can call the authenticated link API.
  app.get(
    '/github/callback',
    async (req, reply) => {
      const { installation_id, setup_action } = req.query as {
        installation_id?: string
        setup_action?: string
      }

      if (!installation_id) {
        return reply.redirect(`${FRONTEND_URL}/github/callback?github_error=missing_id`)
      }

      return reply.redirect(
        `${FRONTEND_URL}/github/callback?installation_id=${installation_id}${setup_action ? `&setup_action=${setup_action}` : ''}`,
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

      // Remove from pending store now that it's claimed
      removePendingInstallation(installationId)

      return reply.status(200).send(installation)
    },
  )

  // ── Get GitHub installation for a project ─────────────────────────────
  app.get(
    '/projects/:projectId/github',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      // Ensure the user is a member of the requested project.
      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // First try project-scoped installation (existing behavior),
      // then fall back to a user-scoped installation (so Profile connect
      // works across all projects).
      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
        include: { repositories: true },
      })

      if (!installation) {
        const userInstallation = await prisma.githubInstallation.findFirst({
          where: { userId: req.authUser.id },
          include: { repositories: true },
        })
        if (!userInstallation) {
          return reply.status(404).send({ error: 'No GitHub installation linked' })
        }
        return userInstallation
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

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
      })

      if (!installation) {
        const userInstallation = await prisma.githubInstallation.findFirst({
          where: { userId: req.authUser.id },
        })
        if (!userInstallation) {
          return reply.status(404).send({ error: 'No GitHub installation linked' })
        }
        await prisma.githubInstallation.delete({
          where: { id: userInstallation.id },
        })
        return reply.status(204).send()
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

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const installation = await prisma.githubInstallation.findFirst({
        where: { projectId },
      })

      let effectiveInstallation = installation
      if (!effectiveInstallation) {
        effectiveInstallation = await prisma.githubInstallation.findFirst({
          where: { userId: req.authUser.id },
        })
      }

      if (!effectiveInstallation) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      try {
        const token = await getInstallationToken(effectiveInstallation.installationId)

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
          installationId: effectiveInstallation.installationId,
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
