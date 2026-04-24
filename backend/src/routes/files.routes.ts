import { createHash } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/authenticate.js'
import { idempotencyPreHandler } from '../middlewares/idempotency.js'
import {
  acquireIdempotency,
  attachIdempotencyContext,
} from '../services/idempotency.service.js'
import cloudinary from '../config/cloudinary.js'
import streamifier from 'streamifier'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv'
])

export async function fileRoutes(app: FastifyInstance) {
  
  // ─── GET /api/files ──────────────────────────────────────────
  app.get('/files', { preHandler: authenticate }, async (req, reply) => {
    const user = req.authUser
    const query = req.query as { parentId?: string; projectId?: string }

    if (query.projectId) {
      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: query.projectId } }
      })
      if (!member) {
        return reply.status(403).send({ error: 'Access denied to project files' })
      }
      const nodes = await prisma.fileNode.findMany({
        where: { projectId: query.projectId, parentId: query.parentId || null },
        orderBy: [{ type: 'asc' }, { name: 'asc' }]
      })
      return reply.send(nodes)
    }

    const nodes = await prisma.fileNode.findMany({
      where: { userId: user.id, projectId: null, parentId: query.parentId || null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    })
    return reply.send(nodes)
  })

  // ─── POST /api/files/folder ─────────────────────────────────────────
  app.post('/files/folder', { preHandler: [authenticate, idempotencyPreHandler('files.folder.create')] }, async (req, reply) => {
    const user = req.authUser
    const body = req.body as { name: string; parentId?: string; projectId?: string }

    if (!body.name || body.name.trim() === '') {
      return reply.status(400).send({ error: 'Folder name is required' })
    }

    if (body.projectId) {
      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: body.projectId } }
      })
      if (!member) return reply.status(403).send({ error: 'Access denied' })
    }

    const folder = await prisma.fileNode.create({
      data: {
        userId: user.id,
        projectId: body.projectId || null,
        name: body.name.trim(),
        type: 'FOLDER',
        parentId: body.parentId || null
      }
    })

    return reply.status(201).send(folder)
  })

  // ─── POST /api/files/upload ─────────────────────────────────────────
  app.post('/files/upload', { preHandler: authenticate }, async (req, reply) => {
    const user = req.authUser
    const data = await req.file()

    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const mimeType = data.mimetype
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return reply.status(400).send({ error: 'File type not allowed' })
    }

    const parentId = (data.fields.parentId as any)?.value || null
    const projectId = (data.fields.projectId as any)?.value || null

    if (projectId) {
      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId } },
      })
      if (!member) return reply.status(403).send({ error: 'Access denied' })
    }

    try {
      const buffer = await data.toBuffer()

      const uploadHash = createHash('sha256')
        .update(buffer)
        .update('\n')
        .update(String(projectId || ''))
        .update('\n')
        .update(String(parentId || ''))
        .update('\n')
        .update(data.filename)
        .digest('hex')

      const idem = await acquireIdempotency(req, reply, 'files.upload', uploadHash)
      if (idem.kind === 'replay' || idem.kind === 'blocked') {
        return
      }
      if (idem.kind === 'proceed' && idem.recordId) {
        attachIdempotencyContext(req, idem.recordId)
      }

      let baseName = data.filename
      let extension = '';
      const lastDotIndex = baseName.lastIndexOf('.');
      if (lastDotIndex > 0) {
        extension = baseName.substring(lastDotIndex);
        baseName = baseName.substring(0, lastDotIndex);
      }

      let finalName = data.filename;
      let counter = 1;

      while (true) {
        const whereClause: any = {
          name: finalName,
          parentId: parentId
        };
        if (projectId) {
          whereClause.projectId = projectId;
        } else {
          whereClause.userId = user.id;
          whereClause.projectId = null;
        }

        const existing = await prisma.fileNode.findFirst({ where: whereClause });
        if (!existing) break;
        finalName = `${baseName}_${counter}${extension}`;
        counter++;
      }

      const cloudinaryResponse = await new Promise<any>((resolve, reject) => {
        const folderPath = projectId ? `task-manager-project-files/${projectId}` : `task-manager-user-files/${user.id}`
        const resourceType = mimeType.startsWith('image/') || mimeType.startsWith('video/') ? 'auto' : 'raw';
        
        const uploadOptions: any = { folder: folderPath, resource_type: resourceType };
        if (resourceType === 'raw') {
          uploadOptions.public_id = finalName; // Prevents cloudinary from converting to image and keeps the exact filename
        }

        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (result) resolve(result)
            else reject(error)
          }
        )
        streamifier.createReadStream(buffer).pipe(uploadStream)
      })

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
      })

      return reply.status(201).send(fileNode)
    } catch (error) {
      console.error('File upload error:', error)
      return reply.status(500).send({ error: 'Upload failed' })
    }
  })

  // ─── DELETE /api/files/:id ─────────────────────────────────────────
  app.delete('/files/:id', { preHandler: authenticate }, async (req, reply) => {
    const user = req.authUser
    const { id } = req.params as { id: string }

    const fileNode = await prisma.fileNode.findUnique({ where: { id } })
    if (!fileNode) return reply.status(404).send({ error: 'File not found' })

    if (fileNode.projectId) {
      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: fileNode.projectId } }
      })
      if (!member) return reply.status(403).send({ error: 'Forbidden' })
    } else if (fileNode.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await prisma.fileNode.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─── GET /api/files/tasks/:taskId/attachments ───────────────────────────
  app.get('/files/tasks/:taskId/attachments', { preHandler: authenticate }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        fileNode: {
          include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send(attachments)
  })

  // ─── POST /api/files/tasks/attachments ──────────────────────────────────
  app.post('/files/tasks/attachments', {
    preHandler: [authenticate, idempotencyPreHandler('files.task_attachments.create')],
  }, async (req, reply) => {
    const body = req.body as { taskId: string; fileNodeId: string }

    if (!body.taskId || !body.fileNodeId) return reply.status(400).send({ error: 'Bad Request' })

    const fileNode = await prisma.fileNode.findUnique({ where: { id: body.fileNodeId } })
    if (!fileNode) return reply.status(404).send({ error: 'File not found' })

    try {
      const attachment = await prisma.taskAttachment.create({
        data: { taskId: body.taskId, fileNodeId: body.fileNodeId },
        include: {
          fileNode: {
            include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } },
          },
        },
      })
      return reply.status(201).send(attachment)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await prisma.taskAttachment.findFirst({
          where: { taskId: body.taskId, fileNodeId: body.fileNodeId },
          include: {
            fileNode: {
              include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } },
            },
          },
        })
        if (existing) {
          reply.header('Idempotent-Replay', 'true')
          return reply.status(200).send(existing)
        }
      }
      throw e
    }
  })

  // ─── DELETE /api/files/tasks/attachments/:id ──────────────────────────
  app.delete('/files/tasks/attachments/:attachmentId', { preHandler: authenticate }, async (req, reply) => {
    const { attachmentId } = req.params as { attachmentId: string }
    const attachment = await prisma.taskAttachment.findUnique({ where: { id: attachmentId }, include: { fileNode: true } })
    if (!attachment) return reply.status(404).send({ error: 'Not found' })

    await prisma.taskAttachment.delete({ where: { id: attachmentId } })
    return reply.send({ success: true })
  })
}
