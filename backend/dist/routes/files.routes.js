import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/authenticate.js';
import { idempotencyPreHandler } from '../middlewares/idempotency.js';
import { acquireIdempotency, attachIdempotencyContext, } from '../services/idempotency.service.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import { auditLogService } from '../services/auditLog.service.js';
import { requireProjectRole } from '../services/projectAuth.service.js';
import { logger } from '../app.js';
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from './upload.js';
export async function fileRoutes(app) {
    // ─── GET /api/files ──────────────────────────────────────────
    app.get('/files', { preHandler: authenticate }, async (req, reply) => {
        const user = req.authUser;
        const query = req.query;
        if (query.projectId) {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId: user.id, projectId: query.projectId } }
            });
            if (!member) {
                return reply.status(403).send({ error: 'Access denied to project files' });
            }
            const nodes = await prisma.fileNode.findMany({
                where: { projectId: query.projectId, parentId: query.parentId || null },
                orderBy: [{ type: 'asc' }, { name: 'asc' }]
            });
            return reply.send(nodes);
        }
        const nodes = await prisma.fileNode.findMany({
            where: { userId: user.id, projectId: null, parentId: query.parentId || null },
            orderBy: [{ type: 'asc' }, { name: 'asc' }]
        });
        return reply.send(nodes);
    });
    // ─── POST /api/files/folder ─────────────────────────────────────────
    app.post('/files/folder', { preHandler: [authenticate, idempotencyPreHandler('files.folder.create')] }, async (req, reply) => {
        const user = req.authUser;
        const body = req.body;
        if (!body.name || body.name.trim() === '') {
            return reply.status(400).send({ error: 'Folder name is required' });
        }
        if (body.projectId) {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId: user.id, projectId: body.projectId } }
            });
            if (!member)
                return reply.status(403).send({ error: 'Access denied' });
        }
        const folder = await prisma.fileNode.create({
            data: {
                userId: user.id,
                projectId: body.projectId || null,
                name: body.name.trim(),
                type: 'FOLDER',
                parentId: body.parentId || null
            }
        });
        auditLogService.record({
            userId: user.id,
            userEmail: user.email,
            userName: user.name ?? null,
            action: 'CREATE',
            entityType: 'FILE',
            entityId: folder.id,
            entityName: folder.name,
            projectId: folder.projectId,
            metadata: { type: folder.type, parentId: folder.parentId },
            req,
        });
        return reply.status(201).send(folder);
    });
    // ─── POST /api/files/upload ─────────────────────────────────────────
    app.post('/files/upload', { preHandler: authenticate }, async (req, reply) => {
        const user = req.authUser;
        const data = await req.file();
        if (!data)
            return reply.status(400).send({ error: 'No file uploaded' });
        const filename = data.filename || 'attachment';
        const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '';
        const mimeType = (data.mimetype || '').toLowerCase();
        const isAllowedMime = ALLOWED_MIME_TYPES.has(mimeType);
        const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
        if (!isAllowedMime && !isAllowedExt) {
            logger.warn({ mimetype: data.mimetype, filename }, 'file_upload_rejected_mime');
            return reply.status(400).send({ error: `File type not allowed (${data.mimetype || ext || 'unknown'})` });
        }
        const parentId = data.fields.parentId?.value || null;
        const projectId = data.fields.projectId?.value || null;
        if (projectId) {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId: user.id, projectId } },
            });
            if (!member)
                return reply.status(403).send({ error: 'Access denied' });
        }
        try {
            const buffer = await data.toBuffer();
            const uploadHash = createHash('sha256')
                .update(buffer)
                .update('\n')
                .update(String(projectId || ''))
                .update('\n')
                .update(String(parentId || ''))
                .update('\n')
                .update(data.filename)
                .digest('hex');
            const idem = await acquireIdempotency(req, reply, 'files.upload', uploadHash);
            if (idem.kind === 'replay' || idem.kind === 'blocked') {
                return;
            }
            if (idem.kind === 'proceed' && idem.recordId) {
                attachIdempotencyContext(req, idem.recordId);
            }
            let baseName = data.filename;
            let extension = '';
            const lastDotIndex = baseName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                extension = baseName.substring(lastDotIndex);
                baseName = baseName.substring(0, lastDotIndex);
            }
            let finalName = data.filename;
            let counter = 1;
            while (true) {
                const whereClause = {
                    name: finalName,
                    parentId: parentId
                };
                if (projectId) {
                    whereClause.projectId = projectId;
                }
                else {
                    whereClause.userId = user.id;
                    whereClause.projectId = null;
                }
                const existing = await prisma.fileNode.findFirst({ where: whereClause });
                if (!existing)
                    break;
                finalName = `${baseName}_${counter}${extension}`;
                counter++;
            }
            const cloudinaryResponse = await new Promise((resolve, reject) => {
                const folderPath = projectId ? `task-manager-project-files/${projectId}` : `task-manager-user-files/${user.id}`;
                const resourceType = mimeType.startsWith('image/') || mimeType.startsWith('video/') ? 'auto' : 'raw';
                const uploadOptions = { folder: folderPath, resource_type: resourceType };
                if (resourceType === 'raw') {
                    uploadOptions.public_id = finalName; // Prevents cloudinary from converting to image and keeps the exact filename
                }
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (result)
                        resolve(result);
                    else
                        reject(error);
                });
                streamifier.createReadStream(buffer).pipe(uploadStream);
            });
            const fileNode = await prisma.fileNode.create({
                data: {
                    userId: user.id,
                    projectId: projectId || null,
                    name: finalName,
                    type: 'FILE',
                    mimeType,
                    size: buffer.length,
                    fileUrl: cloudinaryResponse.secure_url,
                    parentId: parentId
                }
            });
            auditLogService.record({
                userId: user.id,
                userEmail: user.email,
                userName: user.name ?? null,
                action: 'CREATE',
                entityType: 'FILE',
                entityId: fileNode.id,
                entityName: fileNode.name,
                projectId: fileNode.projectId,
                metadata: { type: fileNode.type, mimeType: fileNode.mimeType, size: fileNode.size },
                req,
            });
            return reply.status(201).send(fileNode);
        }
        catch (error) {
            logger.error({ err: error }, 'file_upload_error');
            return reply.status(500).send({ error: 'Upload failed' });
        }
    });
    // ─── DELETE /api/files/:id ─────────────────────────────────────────
    app.delete('/files/:id', { preHandler: authenticate }, async (req, reply) => {
        const user = req.authUser;
        const { id } = req.params;
        const fileNode = await prisma.fileNode.findUnique({ where: { id } });
        if (!fileNode)
            return reply.status(404).send({ error: 'File not found' });
        if (fileNode.projectId) {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId: user.id, projectId: fileNode.projectId } }
            });
            if (!member)
                return reply.status(403).send({ error: 'Forbidden' });
        }
        else if (fileNode.userId !== user.id) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        await prisma.fileNode.delete({ where: { id } });
        auditLogService.record({
            userId: user.id,
            userEmail: user.email,
            userName: user.name ?? null,
            action: 'DELETE',
            entityType: 'FILE',
            entityId: fileNode.id,
            entityName: fileNode.name,
            projectId: fileNode.projectId,
            metadata: { type: fileNode.type },
            req,
        });
        return reply.send({ success: true });
    });
    // ─── GET /api/files/tasks/:taskId/attachments ───────────────────────────
    app.get('/files/tasks/:taskId/attachments', { preHandler: authenticate }, async (req, reply) => {
        const { taskId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const attachments = await prisma.taskAttachment.findMany({
            where: { taskId },
            include: {
                fileNode: {
                    include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send(attachments);
    });
    // ─── POST /api/files/tasks/attachments ──────────────────────────────────
    app.post('/files/tasks/attachments', {
        preHandler: [authenticate, idempotencyPreHandler('files.task_attachments.create')],
    }, async (req, reply) => {
        const body = req.body;
        if (!body.taskId || !body.fileNodeId)
            return reply.status(400).send({ error: 'Bad Request' });
        const task = await prisma.task.findUnique({
            where: { id: body.taskId },
            select: { id: true, projectId: true },
        });
        if (!task)
            return reply.status(404).send({ error: 'Task not found' });
        try {
            await requireProjectRole(task.projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const fileNode = await prisma.fileNode.findUnique({ where: { id: body.fileNodeId } });
        if (!fileNode)
            return reply.status(404).send({ error: 'File not found' });
        // Caller must either own the file (personal upload) or it must already
        // belong to the same project the task lives in. Prevents leaking arbitrary
        // files from other projects/users into tasks.
        const ownsFile = fileNode.userId === req.authUser.id && fileNode.projectId === null;
        const sameProject = fileNode.projectId !== null && fileNode.projectId === task.projectId;
        if (!ownsFile && !sameProject) {
            return reply.status(403).send({ error: 'You do not have access to this file' });
        }
        try {
            const attachment = await prisma.taskAttachment.create({
                data: { taskId: body.taskId, fileNodeId: body.fileNodeId },
                include: {
                    fileNode: {
                        include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } },
                    },
                },
            });
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'CREATE',
                entityType: 'FILE',
                entityId: attachment.id,
                entityName: `taskAttachment:${body.taskId}`,
                projectId: task.projectId,
                metadata: { taskId: body.taskId, fileNodeId: body.fileNodeId },
                req,
            });
            return reply.status(201).send(attachment);
        }
        catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                const existing = await prisma.taskAttachment.findFirst({
                    where: { taskId: body.taskId, fileNodeId: body.fileNodeId },
                    include: {
                        fileNode: {
                            include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } },
                        },
                    },
                });
                if (existing) {
                    reply.header('Idempotent-Replay', 'true');
                    return reply.status(200).send(existing);
                }
            }
            throw e;
        }
    });
    // ─── DELETE /api/files/tasks/attachments/:id ──────────────────────────
    app.delete('/files/tasks/attachments/:attachmentId', { preHandler: authenticate }, async (req, reply) => {
        const { attachmentId } = req.params;
        const attachment = await prisma.taskAttachment.findUnique({
            where: { id: attachmentId },
            include: {
                fileNode: true,
                task: { select: { id: true, projectId: true } },
            },
        });
        if (!attachment)
            return reply.status(404).send({ error: 'Not found' });
        const projectId = attachment.task.projectId;
        let role;
        try {
            role = await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER']);
        }
        catch {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        // Managers can always detach. Plain members can only detach if they were
        // the original uploader of the underlying file.
        if (role === 'MEMBER' && attachment.fileNode.userId !== req.authUser.id) {
            return reply.status(403).send({ error: 'Only managers or the uploader can remove this attachment' });
        }
        await prisma.taskAttachment.delete({ where: { id: attachmentId } });
        auditLogService.record({
            userId: req.authUser.id,
            userEmail: req.authUser.email,
            userName: req.authUser.name ?? null,
            action: 'DELETE',
            entityType: 'FILE',
            entityId: attachmentId,
            entityName: `taskAttachment:${attachment.taskId}`,
            projectId,
            metadata: { taskId: attachment.taskId, fileNodeId: attachment.fileNodeId },
            req,
        });
        return reply.send({ success: true });
    });
}
