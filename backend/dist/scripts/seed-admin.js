import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/auth.js';
/**
 * Optionally seed a master admin account on boot.
 *
 * Behavior:
 *   - Both ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set, otherwise this
 *     is a no-op (logs a single info line and returns).
 *   - If the user already exists, this NEVER overwrites the password. It only
 *     guarantees that `role='admin'` and `emailVerified=true` on that record.
 *   - If the user does not exist, it is created via the Better Auth signup API
 *     and then promoted to admin.
 *
 * The hardcoded credentials that previously lived in this file have been
 * removed (see audit finding #1).
 */
export async function seedAdmin() {
    const email = process.env.ADMIN_SEED_EMAIL?.trim();
    const password = process.env.ADMIN_SEED_PASSWORD;
    if (!email || !password) {
        console.log('[seed-admin] Skipped: ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD not set.');
        return;
    }
    if (password.length < 8) {
        console.error('[seed-admin] Refusing to seed: ADMIN_SEED_PASSWORD must be at least 8 characters.');
        return;
    }
    try {
        const existingAdmin = await prisma.user.findUnique({ where: { email } });
        if (!existingAdmin) {
            console.log(`[seed-admin] Creating admin account for ${email}...`);
            try {
                await auth.api.signUpEmail({
                    headers: new Headers(),
                    body: {
                        email,
                        password,
                        name: 'Master Admin',
                    },
                });
                await prisma.user.update({
                    where: { email },
                    data: {
                        role: 'ADMIN',
                        emailVerified: true,
                    },
                });
                console.log('[seed-admin] Admin user seeded successfully.');
            }
            catch (err) {
                console.error('[seed-admin] Error creating admin account via auth API:', err);
            }
            return;
        }
        // User already exists. Never touch their password; just ensure the role and
        // verified flag are correct so a returning admin can still log in.
        if (existingAdmin.role !== 'ADMIN' || !existingAdmin.emailVerified) {
            console.log(`[seed-admin] Existing user ${email} found — ensuring admin role and verified status.`);
            await prisma.user.update({
                where: { email },
                data: { role: 'ADMIN', emailVerified: true },
            });
        }
    }
    catch (error) {
        console.error('[seed-admin] Failed to seed admin:', error);
    }
}
