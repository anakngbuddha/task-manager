import { prisma } from '../lib/prisma.js'
import { FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { logger } from '../app.js'

// ─── Types ──────────────────────────────────────────────────────────

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE'

export type AuditEntityType =
  | 'TASK'
  | 'PROJECT'
  | 'SPRINT'
  | 'MEMBER'
  | 'AUTOMATION'
  | 'SETTINGS'
  | 'FILE'
  | 'SCHEDULE'

export interface AuditLogInput {
  userId: string
  userEmail: string
  userName?: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  entityName?: string | null
  projectId?: string | null
  changes?: Record<string, { from: unknown; to: unknown }> | null
  metadata?: Record<string, unknown> | null
  req?: FastifyRequest // Optional — used to extract IP + User-Agent
}

export interface AuditLogFilters {
  entityType?: string
  action?: string
  userId?: string
  projectId?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string // Text search on entityName
  page?: number
  pageSize?: number
}

// ─── Diff helper ────────────────────────────────────────────────────

/**
 * Compute a shallow diff between two objects. Returns only changed fields.
 * Useful for generating the `changes` payload on UPDATE operations.
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const field of fields) {
    const fromVal = before[field]
    const toVal = after[field]
    // Normalize null/undefined for comparison
    const normFrom = fromVal ?? null
    const normTo = toVal ?? null
    if (JSON.stringify(normFrom) !== JSON.stringify(normTo)) {
      changes[field] = { from: normFrom, to: normTo }
    }
  }
  return Object.keys(changes).length > 0 ? changes : null
}

// ─── Service ────────────────────────────────────────────────────────

export const auditLogService = {
  /**
   * Record an audit log entry. Fire-and-forget — never throws.
   * Failures are logged to stderr but never block the caller.
   */
  async record(input: AuditLogInput): Promise<void> {
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
          changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: input.req?.ip ?? null,
          userAgent: input.req?.headers['user-agent'] ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })
    } catch (err) {
      logger.error({ err }, 'audit_log_record_failed')
    }
  },

  /**
   * List audit logs with pagination + filtering. Admin-only.
   */
  async list(filters: AuditLogFilters) {
    const page = filters.page ?? 1
    const pageSize = Math.min(filters.pageSize ?? 50, 100)
    const skip = (page - 1) * pageSize

    const where: any = {}

    if (filters.entityType) where.entityType = filters.entityType
    if (filters.action) where.action = filters.action
    if (filters.userId) where.userId = filters.userId
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
      if (filters.dateTo) where.createdAt.lte = filters.dateTo
    }
    if (filters.search) {
      where.entityName = { contains: filters.search }
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  },

  /**
   * Get a single audit log entry by ID. Admin-only.
   */
  async getById(id: string) {
    return prisma.auditLog.findUnique({ where: { id } })
  },

  /**
   * List all entries matching filters (no pagination) for CSV export. Admin-only.
   * Caps at 10,000 rows to avoid OOM.
   */
  async listForExport(filters: AuditLogFilters) {
    const where: any = {}

    if (filters.entityType) where.entityType = filters.entityType
    if (filters.action) where.action = filters.action
    if (filters.userId) where.userId = filters.userId
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
      if (filters.dateTo) where.createdAt.lte = filters.dateTo
    }
    if (filters.search) {
      where.entityName = { contains: filters.search }
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })
  },

  /**
   * Audit logs are intentionally immutable (see schema comment for AuditLog).
   * Past versions of this service deleted records older than 90 days, which
   * silently broke that contract. We now keep the entire history; if storage
   * pressure becomes a problem, copy to a cold table rather than deleting.
   *
   * Returns 0 unconditionally so callers that still invoke this method don't
   * crash. Audit finding #9.
   */
  async cleanupOldLogs(): Promise<number> {
    return 0
  },
}
