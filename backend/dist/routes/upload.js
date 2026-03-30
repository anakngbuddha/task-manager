import path from 'path';
import fs from 'fs';
import { authenticate } from '../middlewares/authenticate.js';
export async function uploadRoutes(app) {
    app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
        const data = await req.file();
        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }
        const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        const extension = path.extname(data.filename);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${extension}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        await new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);
            data.file.pipe(writeStream);
            data.file.on('end', resolve);
            writeStream.on('error', reject);
        });
        const fileUrl = `/uploads/${fileName}`;
        return reply.send({ fileUrl, fileName: data.filename });
    });
}
