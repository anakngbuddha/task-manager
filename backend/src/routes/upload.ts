import { FastifyInstance } from 'fastify'
import { authenticate } from '../middlewares/authenticate.js'
import cloudinary from '../config/cloudinary.js'
import streamifier from 'streamifier'
import { auditLogService } from '../services/auditLog.service.js'
import { logger } from '../app.js'

// Keep in sync with the allowlist in files.routes.ts so a single chat-attachment
// upload can't smuggle through a type that would be rejected on the project
// files route.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
])

export async function uploadRoutes(app: FastifyInstance) {
  // Generic chat-attachment upload. Project authorization for whoever will
  // actually attach this file lives on the message-create routes; here we only
  // enforce auth + MIME allowlist (audit finding #7).
  app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.status(400).send({ error: 'File type not allowed' })
    }

    try {
      const buffer = await data.toBuffer()
      const resourceType = data.mimetype.startsWith('image/') ? 'image' : 'raw'

      const cloudinaryResponse = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `task-manager-chat/${req.authUser.id}`,
            resource_type: resourceType,
          },
          (error, result) => {
            if (result) resolve(result)
            else reject(error)
          },
        )
        streamifier.createReadStream(buffer).pipe(uploadStream)
      })

      auditLogService.record({
        userId: req.authUser.id,
        userEmail: req.authUser.email,
        userName: req.authUser.name ?? null,
        action: 'CREATE',
        entityType: 'FILE',
        entityId: cloudinaryResponse.public_id ?? cloudinaryResponse.secure_url,
        entityName: data.filename,
        metadata: { mimeType: data.mimetype, size: buffer.length, source: 'chat-upload' },
        req,
      })

      return reply.send({ fileUrl: cloudinaryResponse.secure_url, fileName: data.filename })
    } catch (error) {
      logger.error({ err: error }, 'cloudinary_upload_failed')
      return reply.status(500).send({ error: 'File upload to Cloudinary failed' })
    }
  })
}
