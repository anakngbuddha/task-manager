import { authenticate } from '../middlewares/authenticate.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import { auditLogService } from '../services/auditLog.service.js';
import { logger } from '../app.js';
export const ALLOWED_MIME_TYPES = new Set([
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
    'image/bmp', 'image/heic', 'image/heif', 'image/tiff',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/3gpp',
    // Audio
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4',
    // Documents & Presentations
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
]);
export const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.heic', '.heif', '.tiff',
    '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv',
    '.mp3', '.wav',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.md',
    '.zip', '.rar', '.7z', '.gz', '.tar',
]);
export async function uploadRoutes(app) {
    // Generic chat-attachment upload. Project authorization for whoever will
    // actually attach this file lives on the message-create routes; here we
    // enforce auth + media allowlists (supporting images, videos, audio, docs, and archives).
    app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
        const data = await req.file();
        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }
        const filename = data.filename || 'attachment';
        const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '';
        const mime = (data.mimetype || '').toLowerCase();
        const isAllowedMime = ALLOWED_MIME_TYPES.has(mime);
        const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
        if (!isAllowedMime && !isAllowedExt) {
            logger.warn({ mimetype: data.mimetype, filename }, 'file_upload_rejected_mime');
            return reply.status(400).send({ error: `File type not allowed (${data.mimetype || ext || 'unknown'})` });
        }
        try {
            const buffer = await data.toBuffer();
            const resourceType = mime.startsWith('image/')
                ? 'image'
                : mime.startsWith('video/')
                    ? 'video'
                    : 'auto';
            const rootFolder = process.env.CLOUDINARY_FOLDER || 'we-work-it';
            const cloudinaryResponse = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({
                    folder: `${rootFolder}/chat/${req.authUser.id}`,
                    resource_type: resourceType,
                }, (error, result) => {
                    if (result)
                        resolve(result);
                    else
                        reject(error);
                });
                streamifier.createReadStream(buffer).pipe(uploadStream);
            });
            auditLogService.record({
                userId: req.authUser.id,
                userEmail: req.authUser.email,
                userName: req.authUser.name ?? null,
                action: 'CREATE',
                entityType: 'FILE',
                entityId: cloudinaryResponse.public_id ?? cloudinaryResponse.secure_url,
                entityName: filename,
                metadata: { mimeType: data.mimetype, size: buffer.length, source: 'chat-upload' },
                req,
            });
            return reply.send({ fileUrl: cloudinaryResponse.secure_url, fileName: filename });
        }
        catch (error) {
            logger.error({ err: error }, 'cloudinary_upload_failed');
            return reply.status(500).send({ error: 'File upload to Cloudinary failed' });
        }
    });
}
