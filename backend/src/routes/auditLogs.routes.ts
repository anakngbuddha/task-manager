import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'
import { auditLogService } from '../services/auditLog.service.js'

function toDateOrUndefined(input: unknown): Date | undefined {
  if (typeof input !== 'string' || !input) return undefined
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  const needsQuotes = /[",\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export async function auditLogRoutes(app: FastifyInstance) {
  // ─── Admin auth guard (same pattern as admin.routes.ts) ────────────
  app.addHook('preValidation', async (req, reply) => {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    })

    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden. Admin level required.' })
    }

    ;(req as any).adminUser = user
  })

  // ─── GET /api/admin/audit-logs ────────────────────────────────────
  app.get('/admin/audit-logs', async (req, reply) => {
    const q = (req.query ?? {}) as any

    const result = await auditLogService.list({
      entityType: q.entityType,
      action: q.action,
      userId: q.userId,
      projectId: q.projectId,
      search: q.search,
      dateFrom: toDateOrUndefined(q.dateFrom),
      dateTo: toDateOrUndefined(q.dateTo),
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    })

    return reply.send(result)
  })

  // ─── GET /api/admin/audit-logs/:id ────────────────────────────────
  app.get('/admin/audit-logs/:id', async (req, reply) => {
    const params = req.params as any
    const item = await auditLogService.getById(String(params.id))
    if (!item) return reply.status(404).send({ error: 'Not found' })
    return reply.send(item)
  })

  // ─── GET /api/admin/audit-logs/export ─────────────────────────────
  app.get('/admin/audit-logs/export', async (req, reply) => {
    const q = (req.query ?? {}) as any

    const items = await auditLogService.listForExport({
      entityType: q.entityType,
      action: q.action,
      userId: q.userId,
      projectId: q.projectId,
      search: q.search,
      dateFrom: toDateOrUndefined(q.dateFrom),
      dateTo: toDateOrUndefined(q.dateTo),
    })

    const header = [
      'id',
      'createdAt',
      'userId',
      'userEmail',
      'userName',
      'action',
      'entityType',
      'entityId',
      'entityName',
      'projectId',
      'ipAddress',
      'userAgent',
      'changes',
      'metadata',
    ].join(',')

    const lines = items.map((it: any) =>
      [
        it.id,
        it.createdAt?.toISOString?.() ?? it.createdAt,
        it.userId,
        it.userEmail,
        it.userName,
        it.action,
        it.entityType,
        it.entityId,
        it.entityName,
        it.projectId,
        it.ipAddress,
        it.userAgent,
        it.changes,
        it.metadata,
      ]
        .map(csvEscape)
        .join(','),
    )

    const csv = [header, ...lines].join('\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
    return reply.send(csv)
  })
}

