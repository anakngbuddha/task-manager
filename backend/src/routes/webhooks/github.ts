import { FastifyInstance } from 'fastify'
import { verifyWebhookSignature } from '../../lib/githubApp.js'
import { prisma } from '../../lib/prisma.js'
import { activityService } from '../../services/activity.service.js'
import { notificationService } from '../../services/notification.service.js'
import { addPendingInstallation, removePendingInstallation } from '../../lib/pendingInstallations.js'

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer
  }
}

export async function githubWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      ;(req as any).rawBody = body
      try {
        const json = JSON.parse(body.toString())
        done(null, json)
      } catch (err: any) {
        done(err, undefined)
      }
    },
  )

  app.post('/webhooks/github', async (req, reply) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (!signature || !req.rawBody) {
      return reply.status(401).send({ error: 'Missing signature' })
    }

    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return reply.status(401).send({ error: 'Invalid signature' })
    }

    const event = req.headers['x-github-event'] as string
    const deliveryId = req.headers['x-github-delivery'] as string | undefined
    const payload = req.body as any

    app.log.info({ event, action: payload.action, deliveryId }, 'GitHub webhook received')

    try {
      switch (event) {
        case 'installation':
          await handleInstallation(payload, app)
          break
        case 'installation_repositories':
          await handleInstallationRepositories(payload, app)
          break
        case 'pull_request':
          await handlePullRequest(payload, deliveryId)
          break
        case 'pull_request_review':
          await handlePullRequestReview(payload, deliveryId)
          break
        case 'push':
          await handlePush(payload, deliveryId)
          break
        case 'create':
        case 'delete':
          await handleBranchTag(event, payload, deliveryId)
          break
        default:
          app.log.info({ event }, 'Unhandled GitHub event — ignoring')
      }
    } catch (err) {
      app.log.error(err, 'Error processing GitHub webhook')
    }

    return reply.status(200).send({ ok: true })
  })
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleInstallation(payload: any, app: FastifyInstance) {
  const installationId: number = payload.installation?.id
  if (!installationId) return

  const repos: string[] = payload.repositories
    ? payload.repositories.map((r: any) => r.full_name)
    : []

  if (payload.action === 'created') {
    const existing = await prisma.githubInstallation.findUnique({
      where: { installationId },
    })
    if (existing) {
      await prisma.githubInstallation.update({
        where: { installationId },
        data: { repos },
      })
      app.log.info({ installationId }, 'Updated repos for existing installation')
    } else {
      addPendingInstallation(installationId, repos)
      app.log.info({ installationId, repos }, 'Added to pending installations store')
    }
  } else if (payload.action === 'deleted' || payload.action === 'suspend') {
    removePendingInstallation(installationId)

    const existing = await prisma.githubInstallation.findUnique({
      where: { installationId },
    })
    if (existing) {
      await prisma.githubInstallation.delete({
        where: { installationId },
      })
      app.log.info({ installationId }, 'Deleted installation record (app uninstalled/suspended on GitHub)')
    }
  } else if (payload.action === 'new_permissions_accepted') {
    app.log.info({ installationId }, 'New permissions accepted — no action needed')
  }
}

async function handleInstallationRepositories(payload: any, app: FastifyInstance) {
  const installationId: number = payload.installation?.id
  if (!installationId) return

  const existing = await prisma.githubInstallation.findUnique({
    where: { installationId },
  })
  if (!existing) return

  const added: string[] = (payload.repositories_added ?? []).map((r: any) => r.full_name)
  const removed: string[] = (payload.repositories_removed ?? []).map((r: any) => r.full_name)

  const currentRepos: string[] = Array.isArray(existing.repos) ? (existing.repos as string[]) : []
  const updatedRepos = [
    ...currentRepos.filter((r) => !removed.includes(r)),
    ...added.filter((r) => !currentRepos.includes(r)),
  ]

  await prisma.githubInstallation.update({
    where: { installationId },
    data: { repos: updatedRepos },
  })

  app.log.info({ installationId, added, removed }, 'Updated repos from installation_repositories event')
}

async function handlePullRequest(payload: any, deliveryId?: string) {
  const prUrl: string | undefined = payload.pull_request?.html_url
  if (!prUrl) return

  const repoFullName: string | undefined = payload.repository?.full_name

  const action: string = payload.action
  const merged: boolean = payload.pull_request?.merged === true

  let activityType: string
  if (action === 'opened' || action === 'reopened') {
    activityType = 'PR_OPENED'
  } else if (action === 'closed' && merged) {
    activityType = 'PR_MERGED'
  } else if (action === 'closed' && !merged) {
    activityType = 'PR_CLOSED'
  } else {
    activityType = 'PR_' + action.toUpperCase()
  }

  // --- Legacy: tasks linked by githubPrUrl field ---
  const legacyTasks = await prisma.task.findMany({
    where: { githubPrUrl: prUrl },
    include: { project: true },
  })

  for (const task of legacyTasks) {
    let newStatus: string | null = null
    if (activityType === 'PR_OPENED') {
      newStatus = resolveProjectStatusMap(task.project as any, 'pr_opened')
    } else if (activityType === 'PR_MERGED') {
      newStatus = resolveProjectStatusMap(task.project as any, 'pr_merged')
    }

    if (newStatus) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: newStatus },
      })
    }

    const actorId =
      task.assigneeId ??
      (
        await prisma.projectMember.findFirst({
          where: { projectId: task.projectId },
          select: { userId: true },
        })
      )?.userId

    if (actorId) {
      await activityService.record({
        projectId: task.projectId,
        actorId,
        type: activityType,
        entityType: 'TASK',
        entityId: task.id,
        metadata: {
          prUrl,
          prTitle: payload.pull_request?.title,
          prNumber: payload.pull_request?.number,
          newStatus,
          author: payload.pull_request?.user?.login,
        },
      })

      if (task.assigneeId) {
        await notificationService.create({
          userId: task.assigneeId,
          projectId: task.projectId,
          type: 'GITHUB_PR_UPDATE',
          title: `PR ${action}${merged ? ' (merged)' : ''}: ${payload.pull_request?.title}`,
          body: `Task "${task.title}" status → ${newStatus ?? task.status}`,
          href: `/projects/${task.projectId}`,
          data: { taskId: task.id, prUrl },
        })
      }
    }
  }

  // --- New: tasks linked via TaskGithubLink ---
  const linkedTasks = await prisma.taskGithubLink.findMany({
    where: { url: prUrl, type: 'PULL_REQUEST' },
    include: { task: { select: { id: true, projectId: true, status: true, assigneeId: true, title: true } } },
  })

  for (const link of linkedTasks) {
    const alreadyProcessed = legacyTasks.some((t) => t.id === link.task.id)
    if (alreadyProcessed) continue

    await prisma.taskGithubLink.update({
      where: { id: link.id },
      data: {
        status: merged ? 'merged' : payload.pull_request?.state,
        title: payload.pull_request?.title ?? link.title,
      },
    })

    let mappedStatus: string | null = null
    const project = await prisma.project.findUnique({
      where: { id: link.task.projectId },
      select: { githubStatusMap: true },
    })
    if (activityType === 'PR_OPENED') {
      mappedStatus = resolveProjectStatusMap(project as any, 'pr_opened')
    } else if (activityType === 'PR_MERGED') {
      mappedStatus = resolveProjectStatusMap(project as any, 'pr_merged')
    }

    if (mappedStatus && link.task.status !== mappedStatus) {
      await prisma.task.update({
        where: { id: link.task.id },
        data: { status: mappedStatus },
      })
    }
  }

  // --- Record project-level event ---
  await recordProjectRepoEvent(repoFullName, {
    eventType: activityType,
    branch: payload.pull_request?.head?.ref,
    prNumber: payload.pull_request?.number,
    prTitle: payload.pull_request?.title,
    author: payload.pull_request?.user?.login,
    htmlUrl: prUrl,
    message: payload.pull_request?.title,
    summary: {
      action,
      merged,
      state: payload.pull_request?.state,
      base: payload.pull_request?.base?.ref,
    },
    githubDeliveryId: deliveryId,
  })
}

async function handlePullRequestReview(payload: any, deliveryId?: string) {
  const prUrl: string | undefined = payload.pull_request?.html_url
  const repoFullName: string | undefined = payload.repository?.full_name
  if (!prUrl || payload.action !== 'submitted') return

  const legacyTasks = await prisma.task.findMany({
    where: { githubPrUrl: prUrl },
    include: { project: true },
  })

  for (const task of legacyTasks) {
    const actorId =
      task.assigneeId ??
      (
        await prisma.projectMember.findFirst({
          where: { projectId: task.projectId },
          select: { userId: true },
        })
      )?.userId

    if (!actorId) continue

    await activityService.record({
      projectId: task.projectId,
      actorId,
      type: 'PR_REVIEWED',
      entityType: 'TASK',
      entityId: task.id,
      metadata: {
        prUrl,
        prTitle: payload.pull_request?.title,
        reviewer: payload.review?.user?.login,
        state: payload.review?.state,
      },
    })
  }

  await recordProjectRepoEvent(repoFullName, {
    eventType: 'PR_REVIEWED',
    branch: payload.pull_request?.head?.ref,
    prNumber: payload.pull_request?.number,
    prTitle: payload.pull_request?.title,
    author: payload.review?.user?.login,
    htmlUrl: payload.review?.html_url ?? prUrl,
    message: `Review: ${payload.review?.state}`,
    summary: {
      state: payload.review?.state,
      reviewer: payload.review?.user?.login,
    },
    githubDeliveryId: deliveryId,
  })
}

async function handlePush(payload: any, deliveryId?: string) {
  const repoFullName: string | undefined = payload.repository?.full_name
  if (!repoFullName) return

  const branch = payload.ref?.replace('refs/heads/', '') ?? null
  const commits = (payload.commits ?? []).slice(0, 10).map((c: any) => ({
    sha: c.id?.substring(0, 7),
    message: c.message?.substring(0, 200),
    author: c.author?.username ?? c.author?.name,
    url: c.url,
  }))

  const projectIds = await findProjectIdsByRepo(repoFullName)
  for (const projectId of projectIds) {
    const actorMember = await prisma.projectMember.findFirst({
      where: { projectId },
      select: { userId: true },
    })
    if (!actorMember) continue

    await activityService.record({
      projectId,
      actorId: actorMember.userId,
      type: 'PUSH_TO_REPO',
      entityType: 'REPOSITORY',
      entityId: repoFullName,
      metadata: {
        ref: payload.ref,
        commits: (payload.commits ?? []).length,
        pusher: payload.pusher?.name,
        branch,
        commitMessages: commits,
      },
    })
  }

  const commitSummary = commits.length > 0
    ? commits.map((c: any) => c.message).join(' | ')
    : null

  await recordProjectRepoEvent(repoFullName, {
    eventType: 'PUSH',
    branch,
    sha: commits.length > 0 ? commits[0].sha : null,
    author: payload.pusher?.name,
    htmlUrl: payload.compare,
    message: commitSummary,
    summary: {
      commitCount: (payload.commits ?? []).length,
      commits,
      forced: payload.forced,
    },
    githubDeliveryId: deliveryId,
  })
}

async function handleBranchTag(event: string, payload: any, deliveryId?: string) {
  const repoFullName: string | undefined = payload.repository?.full_name
  if (!repoFullName) return

  const refType = payload.ref_type
  const ref = payload.ref
  if (!refType || !ref) return

  const activityType = event === 'create'
    ? (refType === 'branch' ? 'BRANCH_CREATED' : 'TAG_CREATED')
    : (refType === 'branch' ? 'BRANCH_DELETED' : 'TAG_DELETED')

  const projectIds = await findProjectIdsByRepo(repoFullName)
  for (const projectId of projectIds) {
    const actorMember = await prisma.projectMember.findFirst({
      where: { projectId },
      select: { userId: true },
    })
    if (!actorMember) continue

    await activityService.record({
      projectId,
      actorId: actorMember.userId,
      type: activityType,
      entityType: 'REPOSITORY',
      entityId: repoFullName,
      metadata: {
        refType,
        ref,
        sender: payload.sender?.login,
      },
    })
  }

  await recordProjectRepoEvent(repoFullName, {
    eventType: activityType,
    branch: refType === 'branch' ? ref : null,
    author: payload.sender?.login,
    message: `${refType} ${event === 'create' ? 'created' : 'deleted'}: ${ref}`,
    summary: { refType, ref },
    githubDeliveryId: deliveryId,
  })
}

// ─── Helper: record project-level RepoEvent ──────────────────────────────────

interface RepoEventInput {
  eventType: string
  branch?: string | null
  sha?: string | null
  prNumber?: number | null
  prTitle?: string | null
  author?: string | null
  htmlUrl?: string | null
  message?: string | null
  summary?: any
  githubDeliveryId?: string | null
}

async function recordProjectRepoEvent(
  repoFullName: string | undefined,
  input: RepoEventInput,
) {
  if (!repoFullName) return

  const dbRepos = await prisma.githubRepository.findMany({
    where: { repoFullName },
    include: {
      projectRepositories: { select: { projectId: true } },
    },
  })

  for (const dbRepo of dbRepos) {
    for (const pr of dbRepo.projectRepositories) {
      await prisma.repoEvent.create({
        data: {
          projectId: pr.projectId,
          repoId: dbRepo.id,
          eventType: input.eventType,
          branch: input.branch ?? null,
          sha: input.sha ?? null,
          prNumber: input.prNumber ?? null,
          prTitle: input.prTitle ?? null,
          author: input.author ?? null,
          htmlUrl: input.htmlUrl ?? null,
          message: input.message ?? null,
          summary: input.summary ?? null,
          githubDeliveryId: input.githubDeliveryId ?? null,
        },
      })
    }
  }
}

function resolveProjectStatusMap(
  project: { githubStatusMap?: any } | null,
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

async function findProjectIdsByRepo(repoFullName: string): Promise<string[]> {
  const repos = await prisma.githubRepository.findMany({
    where: { repoFullName },
    include: { projectRepositories: { select: { projectId: true } } },
  })
  const ids = new Set<string>()
  for (const repo of repos) {
    for (const pr of repo.projectRepositories) ids.add(pr.projectId)
  }
  return Array.from(ids)
}
