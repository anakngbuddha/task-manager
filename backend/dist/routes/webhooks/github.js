import { verifyWebhookSignature } from '../../lib/githubApp.js';
import { prisma } from '../../lib/prisma.js';
import { activityService } from '../../services/activity.service.js';
import { notificationService } from '../../services/notification.service.js';
import { addPendingInstallation, removePendingInstallation } from '../../lib/pendingInstallations.js';
export async function githubWebhookRoutes(app) {
    // Custom content-type parser that preserves raw body for this plugin scope
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
        ;
        req.rawBody = body;
        try {
            const json = JSON.parse(body.toString());
            done(null, json);
        }
        catch (err) {
            done(err, undefined);
        }
    });
    app.post('/webhooks/github', async (req, reply) => {
        // ── Signature verification ──────────────────────────────────────────
        const signature = req.headers['x-hub-signature-256'];
        if (!signature || !req.rawBody) {
            return reply.status(401).send({ error: 'Missing signature' });
        }
        if (!verifyWebhookSignature(req.rawBody, signature)) {
            return reply.status(401).send({ error: 'Invalid signature' });
        }
        const event = req.headers['x-github-event'];
        const payload = req.body;
        app.log.info({ event, action: payload.action }, 'GitHub webhook received');
        try {
            switch (event) {
                case 'installation':
                    await handleInstallation(payload);
                    break;
                case 'pull_request':
                    await handlePullRequest(payload);
                    break;
                case 'push':
                    await handlePush(payload);
                    break;
                default:
                    app.log.info({ event }, 'Unhandled GitHub event — ignoring');
            }
        }
        catch (err) {
            // Log but always return 200 so GitHub doesn't retry endlessly
            app.log.error(err, 'Error processing GitHub webhook');
        }
        return reply.status(200).send({ ok: true });
    });
}
// ─── Event handlers ───────────────────────────────────────────────────────────
async function handleInstallation(payload) {
    const installationId = payload.installation?.id;
    if (!installationId)
        return;
    const repos = payload.repositories
        ? payload.repositories.map((r) => r.full_name)
        : [];
    if (payload.action === 'created') {
        // If this installation is already claimed by a real user, just update repos.
        const existing = await prisma.githubInstallation.findUnique({
            where: { installationId },
        });
        if (existing) {
            await prisma.githubInstallation.update({
                where: { installationId },
                data: { repos },
            });
        }
        else {
            // Not yet claimed — put it in the in-memory pending store so the
            // frontend can poll and auto-claim it (no FK constraints here).
            addPendingInstallation(installationId, repos);
        }
    }
    else if (payload.action === 'deleted') {
        // Remove from pending store first (might still be unclaimed)
        removePendingInstallation(installationId);
        const existing = await prisma.githubInstallation.findUnique({
            where: { installationId },
        });
        if (existing) {
            await prisma.githubInstallation.delete({
                where: { installationId },
            });
        }
    }
}
async function handlePullRequest(payload) {
    const prUrl = payload.pull_request?.html_url;
    if (!prUrl)
        return;
    // Find tasks linked to this PR
    const tasks = await prisma.task.findMany({
        where: { githubPrUrl: prUrl },
        include: { project: true },
    });
    if (tasks.length === 0)
        return;
    let newStatus = null;
    let activityType;
    const action = payload.action;
    const merged = payload.pull_request?.merged === true;
    if (action === 'opened' || action === 'reopened') {
        newStatus = 'IN_PROGRESS';
        activityType = 'PR_OPENED';
    }
    else if (action === 'closed' && merged) {
        newStatus = 'DONE';
        activityType = 'PR_MERGED';
    }
    else if (action === 'closed' && !merged) {
        newStatus = 'IN_REVIEW';
        activityType = 'PR_CLOSED';
    }
    else {
        return; // ignore other PR actions
    }
    for (const task of tasks) {
        await prisma.task.update({
            where: { id: task.id },
            data: { status: newStatus },
        });
        // Find an actor — prefer the task assignee, fall back to first member
        const actorId = task.assigneeId ??
            (await prisma.projectMember.findFirst({
                where: { projectId: task.projectId },
                select: { userId: true },
            }))?.userId;
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
                    newStatus,
                },
            });
            // Notify the assignee (if different from actor) or all members
            if (task.assigneeId) {
                await notificationService.create({
                    userId: task.assigneeId,
                    projectId: task.projectId,
                    type: 'GITHUB_PR_UPDATE',
                    title: `PR ${action}${merged ? ' (merged)' : ''}: ${payload.pull_request?.title}`,
                    body: `Task "${task.title}" status → ${newStatus}`,
                    href: `/projects/${task.projectId}`,
                    data: { taskId: task.id, prUrl },
                });
            }
        }
    }
}
async function handlePush(payload) {
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName)
        return;
    // Find installations linked to this repo
    const installations = await prisma.githubInstallation.findMany({
        where: {
            OR: [
                { repos: { path: '$', array_contains: repoFullName } },
                { repositories: { some: { repoFullName } } },
            ],
        },
    });
    for (const inst of installations) {
        const actorMember = await prisma.projectMember.findFirst({
            where: { projectId: inst.projectId },
            select: { userId: true },
        });
        if (!actorMember)
            continue;
        await activityService.record({
            projectId: inst.projectId,
            actorId: actorMember.userId,
            type: 'PUSH_TO_REPO',
            entityType: 'REPOSITORY',
            entityId: repoFullName,
            metadata: {
                ref: payload.ref,
                commits: (payload.commits ?? []).length,
                pusher: payload.pusher?.name,
            },
        });
    }
}
