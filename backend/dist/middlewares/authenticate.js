import { auth } from '../lib/auth.js';
export async function authenticate(req, reply) {
    const session = await auth.api.getSession({
        headers: req.headers,
    });
    if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
    req.authUser = session.user;
}
