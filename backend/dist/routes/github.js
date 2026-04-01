import { authenticate } from '../middlewares/authenticate.js';
import { prisma } from '../lib/prisma.js';
import { getInstallationToken } from '../lib/githubApp.js';
import { peekPendingInstallations, removePendingInstallation, registerExpectingUser, isUserExpecting, clearExpectingUser, } from '../lib/pendingInstallations.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
const INSTALLATION_URL = process.env.GITHUB_INSTALLATION_URL ||
    'https://github.com/apps/wsi-taska/installations/new';
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '') ||
    'http://localhost:5173';
export async function githubRoutes(app) {
    // ── Connect button URL ────────────────────────────────────────────────
    app.get('/github/connect', { preHandler: authenticate }, async (req) => {
        app.log.info({ userId: req.authUser.id }, 'GitHub connect requested — registering expecting user');
        registerExpectingUser(req.authUser.id);
        return { url: INSTALLATION_URL };
    });
    // ── Check for a pending (unclaimed) GitHub App installation ──────────
    app.get('/github/pending-installation', { preHandler: authenticate }, async (req, reply) => {
        if (!isUserExpecting(req.authUser.id)) {
            return reply.status(204).send();
        }
        const pending = peekPendingInstallations();
        if (pending.length === 0) {
            return reply.status(204).send();
        }
        const latest = pending[0];
        return reply.status(200).send({
            installationId: latest.installationId,
            repos: latest.repos,
        });
    });
    // ── GitHub post-install callback (redirect-based) ─────────────────────
    app.get('/github/callback', async (req, reply) => {
        const { installation_id, setup_action } = req.query;
        if (!installation_id) {
            return reply.redirect(`${FRONTEND_URL}/profile?github_error=missing_id`);
        }
        // Both fresh installs (setup_action=install) and updates/re-authorizations
        // (setup_action=update) carry the same installation_id param.
        return reply.redirect(`${FRONTEND_URL}/profile?github_installation_id=${installation_id}`);
    });
    // ── Link an installation to current user (account binding) ───────────
    app.post('/github/connect', { preHandler: authenticate }, async (req, reply) => {
        const { installationId } = req.body;
        if (!installationId || typeof installationId !== 'number') {
            return reply.status(400).send({ error: 'installationId (number) is required' });
        }
        // Validate the installation is real on GitHub by trying to get a token.
        try {
            await getInstallationToken(installationId);
        }
        catch (err) {
            app.log.warn({ installationId, err: err.message }, 'GitHub installation validation failed');
            return reply.status(400).send({
                error: 'Invalid GitHub installation. The app may have been uninstalled or the ID is wrong.',
            });
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
        });
        removePendingInstallation(installationId);
        clearExpectingUser(req.authUser.id);
        app.log.info({ installationId, userId: req.authUser.id }, 'GitHub installation linked to user');
        return reply.status(200).send(installation);
    });
    // ── Get installation for current user (Profile page) ─────────────────
    app.get('/github/installation', { preHandler: authenticate }, async (req, reply) => {
        const installation = await prisma.githubInstallation.findFirst({
            where: { userId: req.authUser.id },
            orderBy: { createdAt: 'desc' },
        });
        if (!installation) {
            return reply.status(404).send({ error: 'No GitHub installation linked' });
        }
        try {
            await getInstallationToken(installation.installationId);
        }
        catch {
            await prisma.githubInstallation.delete({ where: { id: installation.id } }).catch(() => { });
            return reply.status(404).send({ error: 'No GitHub installation linked' });
        }
        return installation;
    });
    // ── Get GitHub assignment status for a project ────────────────────────
    app.get('/projects/:projectId/github', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const membership = await prisma.projectMember.findFirst({
            where: { userId: req.authUser.id, projectId },
            select: { userId: true },
        });
        if (!membership) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const assigned = await prisma.projectRepository.findMany({
            where: { projectId },
            include: { repo: true },
        });
        if (assigned.length === 0) {
            return reply.status(404).send({ error: 'No GitHub installation linked' });
        }
        return { connected: true, assignedRepoCount: assigned.length };
    });
    // ── Disconnect GitHub account (user-level) ────────────────────────────
    app.delete('/github/installation', { preHandler: authenticate }, async (req, reply) => {
        await prisma.githubInstallation.deleteMany({
            where: { userId: req.authUser.id },
        });
        return reply.status(204).send();
    });
    // ── Backward compatible disconnect endpoint ───────────────────────────
    app.delete('/projects/:projectId/github', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const deleted = await prisma.githubInstallation.deleteMany({ where: { userId: req.authUser.id } });
        app.log.info({ count: deleted.count, projectId }, 'GitHub installations disconnected (user-level)');
        return reply.status(204).send();
    });
    // ── List assigned repos for project ───────────────────────────────────
    app.get('/projects/:projectId/github/repos', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const membership = await prisma.projectMember.findFirst({
            where: { userId: req.authUser.id, projectId },
            select: { userId: true },
        });
        if (!membership) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const assigned = await prisma.projectRepository.findMany({
            where: { projectId },
            include: { repo: true },
            orderBy: { createdAt: 'desc' },
        });
        return {
            repositories: assigned.map((a) => ({
                id: a.repo.id,
                repoId: a.repo.repoId,
                fullName: a.repo.repoFullName,
                private: true,
                htmlUrl: `https://github.com/${a.repo.repoFullName}`,
            })),
        };
    });
    // ── Assign a repo to a project (admin only) ──────────────────────────
    app.post('/projects/:projectId/github/repos', { preHandler: authenticate }, async (req, reply) => {
        const { projectId } = req.params;
        const { repoId } = req.body;
        if (!repoId)
            return reply.status(400).send({ error: 'repoId is required' });
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const repo = await prisma.githubRepository.findUnique({ where: { id: repoId } });
        if (!repo)
            return reply.status(404).send({ error: 'Repository not found' });
        const assigned = await prisma.projectRepository.upsert({
            where: { projectId_repoId: { projectId, repoId } },
            update: {},
            create: { projectId, repoId },
            include: { repo: true },
        });
        return reply.status(201).send({
            id: assigned.id,
            repoId: assigned.repo.id,
            fullName: assigned.repo.repoFullName,
            htmlUrl: `https://github.com/${assigned.repo.repoFullName}`,
        });
    });
    // ── Remove project repo assignment (admin only) ──────────────────────
    app.delete('/projects/:projectId/github/repos/:repoId', { preHandler: authenticate }, async (req, reply) => {
        const { projectId, repoId } = req.params;
        try {
            await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        await prisma.projectRepository.deleteMany({ where: { projectId, repoId } });
        return reply.status(204).send();
    });
    // ── Detect unclaimed installations directly from GitHub API ─────────
    // Works in dev without webhooks: uses the App JWT to list all
    // installations on GitHub and returns any not yet in our DB.
    app.get('/github/detect-installation', { preHandler: authenticate }, async (req, reply) => {
        if (!isUserExpecting(req.authUser.id)) {
            return reply.status(204).send();
        }
        let appJwt;
        try {
            const jwtMod = await import('jsonwebtoken');
            const appId = process.env.GITHUB_APP_ID;
            const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
            if (!appId || !privateKey)
                return reply.status(204).send();
            const now = Math.floor(Date.now() / 1000);
            appJwt = jwtMod.default.sign({ iat: now - 60, exp: now + 10 * 60, iss: appId }, privateKey, { algorithm: 'RS256' });
        }
        catch {
            return reply.status(204).send();
        }
        try {
            const res = await fetch('https://api.github.com/app/installations?per_page=10', {
                headers: {
                    Authorization: `Bearer ${appJwt}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });
            if (!res.ok)
                return reply.status(204).send();
            const installations = (await res.json());
            const claimedIds = (await prisma.githubInstallation.findMany({ select: { installationId: true } })).map((r) => r.installationId);
            const unclaimed = installations
                .filter((i) => !claimedIds.includes(i.id))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (unclaimed.length === 0)
                return reply.status(204).send();
            const best = unclaimed[0];
            app.log.info({ installationId: best.id, account: best.account?.login }, 'Detected unclaimed GitHub installation');
            return reply.status(200).send({
                installationId: best.id,
                repos: [],
                account: best.account?.login ?? null,
            });
        }
        catch (err) {
            app.log.warn({ err: err.message }, 'Failed to detect GitHub installations');
            return reply.status(204).send();
        }
    });
}
