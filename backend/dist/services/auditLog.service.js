import { prisma } from '../lib/prisma.js';
// ─── Diff helper ────────────────────────────────────────────────────
/**
 * Compute a shallow diff between two objects. Returns only changed fields.
 * Useful for generating the `changes` payload on UPDATE operations.
 */
export function computeChanges(before, after, fields) {
    const changes = {};
    for (const field of fields) {
        const fromVal = before[field];
        const toVal = after[field];
        // Normalize null/undefined for comparison
        const normFrom = fromVal ?? null;
        const normTo = toVal ?? null;
        if (JSON.stringify(normFrom) !== JSON.stringify(normTo)) {
            changes[field] = { from: normFrom, to: normTo };
        }
    }
    return Object.keys(changes).length > 0 ? changes : null;
}
// ─── Service ────────────────────────────────────────────────────────
export const auditLogService = {
    /**
     * Record an audit log entry. Fire-and-forget — never throws.
     * Failures are logged to stderr but never block the caller.
     */
    async record(input) {
        try {
            await prisma.auditLog.create({
                data: {
                    userId: input.userId,
                    userEmail: input.userEmail,
                    userName: input.userName ?? null,
                    action: input.action,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    entityName: input.entityName ?? null,
                    projectId: input.projectId ?? null,
                    changes: (input.changes ?? undefined),
                    ipAddress: input.req?.ip ?? null,
                    userAgent: input.req?.headers['user-agent'] ?? null,
                    metadata: (input.metadata ?? undefined),
                },
            });
        }
        catch (err) {
            console.error('[audit-log] Failed to record audit log:', err);
        }
    },
    /**
     * List audit logs with pagination + filtering. Admin-only.
     */
    async list(filters) {
        const page = filters.page ?? 1;
        const pageSize = Math.min(filters.pageSize ?? 50, 100);
        const skip = (page - 1) * pageSize;
        const where = {};
        if (filters.entityType)
            where.entityType = filters.entityType;
        if (filters.action)
            where.action = filters.action;
        if (filters.userId)
            where.userId = filters.userId;
        if (filters.projectId)
            where.projectId = filters.projectId;
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo)
                where.createdAt.lte = filters.dateTo;
        }
        if (filters.search) {
            where.entityName = { contains: filters.search };
        }
        const [items, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
            }),
            prisma.auditLog.count({ where }),
        ]);
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    },
    /**
     * Get a single audit log entry by ID. Admin-only.
     */
    async getById(id) {
        return prisma.auditLog.findUnique({ where: { id } });
    },
    /**
     * List all entries matching filters (no pagination) for CSV export. Admin-only.
     * Caps at 10,000 rows to avoid OOM.
     */
    async listForExport(filters) {
        const where = {};
        if (filters.entityType)
            where.entityType = filters.entityType;
        if (filters.action)
            where.action = filters.action;
        if (filters.userId)
            where.userId = filters.userId;
        if (filters.projectId)
            where.projectId = filters.projectId;
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo)
                where.createdAt.lte = filters.dateTo;
        }
        if (filters.search) {
            where.entityName = { contains: filters.search };
        }
        return prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10000,
        });
    },
    /**
     * Delete audit logs older than the retention period (90 days).
     * Called from the notification cron job.
     */
    async cleanupOldLogs() {
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        try {
            const result = await prisma.auditLog.deleteMany({
                where: { createdAt: { lt: cutoff } },
            });
            if (result.count > 0) {
                console.log(`[audit-log] Cleaned up ${result.count} audit logs older than 90 days`);
            }
            return result.count;
        }
        catch (err) {
            console.error('[audit-log] Failed to cleanup old logs:', err);
            return 0;
        }
    },
};
