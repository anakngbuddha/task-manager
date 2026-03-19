import { prisma } from '../lib/prisma.js';
export const USER_STATUSES = ['ONLINE', 'WORKING', 'BUSY', 'AWAY', 'MEETING', 'OFFLINE'];
function normalizeStatus(s) {
    const up = String(s ?? '').toUpperCase();
    if (USER_STATUSES.includes(up))
        return up;
    return 'ONLINE';
}
export const userStatusService = {
    async getStatus(userId) {
        try {
            const rows = await prisma.$queryRaw `
        SELECT status
        FROM user_statuses
        WHERE userId = ${userId}
        LIMIT 1
      `;
            if (!rows?.[0]?.status)
                return 'ONLINE';
            return normalizeStatus(rows[0].status);
        }
        catch {
            return 'ONLINE';
        }
    },
    async setStatus(userId, status) {
        const next = normalizeStatus(status);
        try {
            await prisma.$executeRaw `
        INSERT INTO user_statuses (userId, status, updatedAt)
        VALUES (${userId}, ${next}, NOW())
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          updatedAt = NOW()
      `;
        }
        catch {
            // If table isn't migrated yet, ignore (UI will fall back to ONLINE).
        }
        return next;
    },
};
