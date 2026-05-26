import { auth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
export async function authenticate(req, reply) {
    const session = await auth.api.getSession({
        headers: req.headers,
    });
    if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    // Reject banned accounts at the edge. We still keep their original `role`
    // intact (audit finding #13); ban state is tracked separately via bannedAt.
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, bannedAt: true },
    });
    if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (user.bannedAt) {
        // Make sure the session can never re-authenticate.
        await prisma.session.deleteMany({ where: { userId: user.id } });
        return reply.status(403).send({ error: 'Account is banned' });
    }
    req.authUser = session.user;
}
