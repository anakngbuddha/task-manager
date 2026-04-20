import { FastifyInstance } from 'fastify'
import path from 'path'
import { authenticate } from '../middlewares/authenticate.js'
import cloudinary from '../config/cloudinary.js'
import streamifier from 'streamifier'

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    try {
      const buffer = await data.toBuffer()

      const cloudinaryResponse = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'task-manager-uploads',
            // Keep original extension if possible or let Cloudinary detect
            resource_type: 'auto',
          },
          (error, result) => {
            if (result) resolve(result)
            else reject(error)
          }
        )

        streamifier.createReadStream(buffer).pipe(uploadStream)
      })

      // We use secure_url as fileUrl
      return reply.send({ fileUrl: cloudinaryResponse.secure_url, fileName: data.filename })
    } catch (error) {
      console.error('Cloudinary upload error:', error)
      return reply.status(500).send({ error: 'File upload to Cloudinary failed' })
    }
  })
}
