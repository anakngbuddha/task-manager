import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma.js';
const isProd = process.env.NODE_ENV === 'production' || process.env.BETTER_AUTH_URL?.startsWith('https://');
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'mysql',
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },
    trustedOrigins: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://task-manager-mauve-eta.vercel.app',
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
    advanced: {
        crossSubdomainCookies: {
            enabled: false,
        },
        defaultCookieAttributes: {
            // In dev we run over http://localhost, so Secure cookies would be dropped
            secure: isProd,
            httpOnly: true,
            // localhost:5174 -> localhost:3000 is same-site; Lax works in dev
            sameSite: isProd ? 'none' : 'lax',
            // Partitioned cookies require Secure; but breaks cross-domain OAuth callbacks
            partitioned: false,
        },
    },
});
