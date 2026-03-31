import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { requireProjectRole } from '../services/projectAuth.service.js'
import { getInstallationToken } from '../lib/githubApp.js'

const GITHUB_URL_REGEX =
  /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/(?<type>pull|commit|tree|issues)\/(?<ref>.+?)(?:\/.*)?$/

function parseGithubUrl(url: string) {
  const m = url.match(GITHUB_URL_REGEX)
  if (!m?.groups) return null
  const { owner, repo, type, ref } = m.groups
  const fullName = `${owner}/${repo}`

  if (type === 'pull') {
    const num = parseInt(ref, 10)
    if (Number.isNaN(num)) return null
    return { kind: 'PULL_REQUEST' as const, owner, repo, fullName, number: num }
  }
  if (type === 'commit') {
    return { kind: 'COMMIT' as const, owner, repo, fullName, sha: ref }
  }
  if (type === 'tree') {
    return { kind: 'BRANCH' as const, owner, repo, fullName, branch: ref }
  }
  if (type === 'issues') {
    const num = parseInt(ref, 10)
    if (Number.isNaN(num)) return null
    return { kind: 'ISSUE' as const, owner, repo, fullName, number: num }
  }
  return null
}

async function findInstallationTokenForRepo(
  projectId: string,
  repoFullName: string,
): Promise<string | null> {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  })
  const memberIds = members.map((m) => m.userId)
  if (memberIds.length === 0) return null
  const installations = await prisma.githubInstallation.findMany({
    where: { userId: { in: memberIds } },
  })
  for (const inst of installations) {
    try {
      const token = await getInstallationToken(inst.installationId)
      const res = await fetch(
        `https://api.github.com/repos/${repoFullName}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      )
      if (res.ok) return token
    } catch {}
  }
  return null
}

function resolveAutoStatus(
  project: { githubStatusMap: any } | null,
  key: 'pr_opened' | 'pr_merged' | 'pr_closed' | 'pr_review_approved',
) {
  const map = (project?.githubStatusMap ?? {}) as Record<string, string | null | undefined>
  const defaults: Record<string, string | null> = {
    pr_opened: 'IN_REVIEW',
    pr_merged: 'DONE',
    pr_closed: null,
    pr_review_approved: null,
  }
  const configured = map[key]
  if (configured === null) return null
  return configured ?? defaults[key]
}

export async function taskGithubLinkRoutes(app: FastifyInstance) {
  // ── Add a GitHub link to a task ─────────────────────────────────────
  app.post(
    '/tasks/:taskId/github-links',
    { preHandler: authenticate },
    async (req, reply) => {
      const { taskId } = req.params as { taskId: string }
      const { url } = req.body as { url: string }

      if (!url?.trim()) {
        return reply.status(400).send({ error: 'url is required' })
      }

      const cleanUrl = url.trim()
      const parsed = parseGithubUrl(cleanUrl)
      if (!parsed) {
        return reply
          .status(400)
          .send({ error: 'Invalid GitHub URL. Supported: pull requests, commits, branches, issues.' })
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true, status: true, project: { select: { githubStatusMap: true } } },
      })
      if (!task) return reply.status(404).send({ error: 'Task not found' })

      try {
        await requireProjectRole(task.projectId, req.authUser.id, [
          'MASTER_ADMIN',
          'PROJECT_MANAGER',
          'MEMBER',
        ])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const existing = await prisma.taskGithubLink.findUnique({
        where: { taskId_url: { taskId, url: cleanUrl } },
      })
      if (existing) {
        return reply.status(409).send({ error: 'This URL is already linked to this task' })
      }

      const token = await findInstallationTokenForRepo(task.projectId, parsed.fullName)

      let title: string | null = null
      let status: string | null = null
      let author: string | null = null
      let number: number | null = null
      let sha: string | null = null
      let verified = false
      let autoTransitionStatus: string | null = null

      if (token) {
        try {
          if (parsed.kind === 'PULL_REQUEST') {
            const res = await fetch(
              `https://api.github.com/repos/${parsed.fullName}/pulls/${parsed.number}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            )
            if (res.ok) {
              const pr = (await res.json()) as any
              title = pr.title
              status = pr.merged ? 'merged' : pr.state
              author = pr.user?.login
              number = pr.number
              verified = true

              if (pr.state === 'open') autoTransitionStatus = resolveAutoStatus(task.project, 'pr_opened')
              else if (pr.merged) autoTransitionStatus = resolveAutoStatus(task.project, 'pr_merged')
            }
          } else if (parsed.kind === 'COMMIT') {
            const res = await fetch(
              `https://api.github.com/repos/${parsed.fullName}/commits/${parsed.sha}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            )
            if (res.ok) {
              const commit = (await res.json()) as any
              title = commit.commit?.message?.split('\n')[0] ?? null
              author = commit.author?.login ?? commit.commit?.author?.name
              sha = commit.sha?.substring(0, 7)
              verified = true
            }
          } else if (parsed.kind === 'ISSUE') {
            const res = await fetch(
              `https://api.github.com/repos/${parsed.fullName}/issues/${parsed.number}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            )
            if (res.ok) {
              const issue = (await res.json()) as any
              title = issue.title
              status = issue.state
              author = issue.user?.login
              number = issue.number
              verified = true
            }
          } else if (parsed.kind === 'BRANCH') {
            const res = await fetch(
              `https://api.github.com/repos/${parsed.fullName}/branches/${parsed.branch}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              },
            )
            if (res.ok) {
              const branch = (await res.json()) as any
              title = parsed.branch
              sha = branch.commit?.sha?.substring(0, 7)
              verified = true
            }
          }
        } catch (err: any) {
          app.log.warn({ err: err.message, url: cleanUrl }, 'GitHub link validation request failed')
        }
      }

      if (!verified) {
        return reply.status(422).send({
          error:
            'Could not verify this URL on GitHub. Make sure the repository is accessible to the connected GitHub App.',
        })
      }

      const link = await prisma.taskGithubLink.create({
        data: {
          taskId,
          url: cleanUrl,
          type: parsed.kind,
          title,
          status,
          author,
          number,
          sha,
          repoFullName: parsed.fullName,
          metadata: { verified },
        },
      })

      if (autoTransitionStatus && task.status !== autoTransitionStatus) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: autoTransitionStatus },
        })
        app.log.info(
          { taskId, oldStatus: task.status, newStatus: autoTransitionStatus, prUrl: cleanUrl },
          'Task auto-transitioned via GitHub link',
        )
      }

      return reply.status(201).send({ ...link, autoTransitionStatus })
    },
  )

  // ── List GitHub links for a task ────────────────────────────────────
  app.get(
    '/tasks/:taskId/github-links',
    { preHandler: authenticate },
    async (req, reply) => {
      const { taskId } = req.params as { taskId: string }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true },
      })
      if (!task) return reply.status(404).send({ error: 'Task not found' })

      try {
        await requireProjectRole(task.projectId, req.authUser.id, [
          'MASTER_ADMIN',
          'PROJECT_MANAGER',
          'MEMBER',
        ])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const links = await prisma.taskGithubLink.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
      })

      return links
    },
  )

  // ── Remove a GitHub link from a task ────────────────────────────────
  app.delete(
    '/tasks/:taskId/github-links/:linkId',
    { preHandler: authenticate },
    async (req, reply) => {
      const { taskId, linkId } = req.params as { taskId: string; linkId: string }

      const link = await prisma.taskGithubLink.findUnique({
        where: { id: linkId },
        include: { task: { select: { projectId: true } } },
      })
      if (!link || link.taskId !== taskId) {
        return reply.status(404).send({ error: 'Link not found' })
      }

      try {
        await requireProjectRole(link.task.projectId, req.authUser.id, [
          'MASTER_ADMIN',
          'PROJECT_MANAGER',
          'MEMBER',
        ])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await prisma.taskGithubLink.delete({ where: { id: linkId } })
      return reply.status(204).send()
    },
  )

  // ── Project GitHub events (for GitHub Activity page) ────────────────
  app.get(
    '/projects/:projectId/github/events',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }
      const { limit, cursor, eventType, repo } = req.query as {
        limit?: string
        cursor?: string
        eventType?: string
        repo?: string
      }

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) return reply.status(403).send({ error: 'Forbidden' })

      const take = Math.min(Number(limit) || 50, 100)

      const where: any = {
        projectId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        ...(eventType ? { eventType } : {}),
      }
      if (repo) {
        where.repo = { repoFullName: repo }
      }

      const events = await prisma.repoEvent.findMany({
        where,
        include: {
          repo: { select: { repoFullName: true, repoId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      })

      return {
        events,
        nextCursor:
          events.length === take
            ? events[events.length - 1].createdAt.toISOString()
            : null,
      }
    },
  )

  // ── List available repos (for the project) ──────────────────────────
  app.get(
    '/projects/:projectId/github/available-repos',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const membership = await prisma.projectMember.findFirst({
        where: { userId: req.authUser.id, projectId },
        select: { userId: true },
      })
      if (!membership) return reply.status(403).send({ error: 'Forbidden' })

      const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      })
      const memberIds = members.map((m) => m.userId)
      const installations = await prisma.githubInstallation.findMany({
        where: { userId: { in: memberIds } },
        include: { repositories: true },
      })

      if (installations.length === 0) {
        return reply.status(404).send({ error: 'No GitHub installation linked' })
      }

      try {
        const repoMap = new Map<string, {
          id: string
          repoId: number
          fullName: string
          private: boolean
          htmlUrl: string
          defaultBranch: string
        }>()

        for (const installation of installations) {
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
          if (!res.ok) continue
          const data = (await res.json()) as {
            repositories: Array<{
              id: number
              full_name: string
              private: boolean
              html_url: string
              default_branch: string
            }>
          }
          for (const r of data.repositories) {
            const dbRepo = await prisma.githubRepository.upsert({
              where: {
                installationId_repoFullName: {
                  installationId: installation.id,
                  repoFullName: r.full_name,
                },
              },
              update: { repoId: r.id },
              create: {
                installationId: installation.id,
                repoFullName: r.full_name,
                repoId: r.id,
                isActive: true,
              },
            })
            if (!repoMap.has(r.full_name)) {
              repoMap.set(r.full_name, {
                id: dbRepo.id,
                repoId: r.id,
                fullName: r.full_name,
                private: r.private,
                htmlUrl: r.html_url,
                defaultBranch: r.default_branch,
              })
            }
          }
        }

        return { repositories: Array.from(repoMap.values()) }
      } catch (err: any) {
        return reply.status(502).send({ error: 'Failed to fetch repos', detail: err.message })
      }
    },
  )
}
