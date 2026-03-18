import { projectService } from '../services/project.service.js';
import { authenticate } from '../middlewares/authenticate.js';
import { z } from 'zod';
const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
});
const updateRoleSchema = z.object({
    role: z.enum(['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']),
});
export async function projectRoutes(app) {
    app.get('/projects', {
        preHandler: authenticate,
    }, async (req) => {
        return projectService.getAllForUser(req.authUser.id);
    });
    app.get('/projects/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        const project = await projectService.getById(id);
        if (!project)
            return reply.status(404).send({ error: 'Project not found' });
        return project;
    });
    app.post('/projects', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { name } = createProjectSchema.parse(req.body);
        const project = await projectService.create(name, req.authUser.id);
        return reply.status(201).send(project);
    });
    app.patch('/projects/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        const { name } = createProjectSchema.parse(req.body);
        return projectService.update(id, name);
    });
    app.delete('/projects/:id', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { id } = req.params;
        await projectService.delete(id);
        return reply.status(204).send();
    });
    app.get('/projects/:projectId/members', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { projectId } = req.params;
        const membership = await projectService.getMemberRole(projectId, req.authUser.id);
        if (!membership)
            return reply.status(403).send({ error: 'Forbidden' });
        return projectService.listMembers(projectId);
    });
    app.patch('/projects/:projectId/members/:userId/role', {
        preHandler: authenticate,
    }, async (req, reply) => {
        const { projectId, userId } = req.params;
        const { role } = updateRoleSchema.parse(req.body);
        const me = await projectService.getMemberRole(projectId, req.authUser.id);
        if (!me)
            return reply.status(403).send({ error: 'Forbidden' });
        // Permission rules:
        // - MASTER_ADMIN can change anyone's role (including other admins)
        // - PROJECT_MANAGER can only change MEMBER roles (cannot change MASTER_ADMIN/PROJECT_MANAGER)
        if (me.role === 'MEMBER')
            return reply.status(403).send({ error: 'Forbidden' });
        const target = await projectService.getMemberRole(projectId, userId);
        if (!target)
            return reply.status(404).send({ error: 'Member not found' });
        if (me.role === 'PROJECT_MANAGER') {
            if (target.role !== 'MEMBER')
                return reply.status(403).send({ error: 'Forbidden' });
            if (role !== 'MEMBER')
                return reply.status(403).send({ error: 'Forbidden' });
        }
        // Prevent removing the last MASTER_ADMIN (simple guard)
        if (target.role === 'MASTER_ADMIN' && role !== 'MASTER_ADMIN') {
            const admins = await projectService.listMembers(projectId);
            const adminCount = admins.filter((m) => m.role === 'MASTER_ADMIN').length;
            if (adminCount <= 1)
                return reply.status(400).send({ error: 'Project must have at least one MASTER_ADMIN' });
        }
        await projectService.updateMemberRole(projectId, userId, role);
        return { ok: true };
    });
}
