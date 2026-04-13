import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'

export async function adminRoutes(app: FastifyInstance) {
  // Middleware to ensure user is admin
  app.addHook('preValidation', async (req, reply) => {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    })

    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!user || user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden. Admin level required.' })
    }
    // inject user if needed later
    ;(req as any).adminUser = user
  })

  // GET /api/admin/metrics - High level KPIs
  app.get('/admin/metrics', async (req, reply) => {
    const totalUsers = await prisma.user.count()
    const activeProjects = await prisma.project.count({ where: { status: 'ACTIVE' } })
    const totalTasks = await prisma.task.count()
    
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: oneWeekAgo } }
    })

    return reply.send({
      totalUsers,
      activeProjects,
      totalTasks,
      recentSignups
    })
  })

  // GET /api/admin/analytics - specific business analytics points requested
  app.get('/admin/analytics', async (req, reply) => {
    // 1. "what pages user visit the most"
    // Prisma group by pageUrl where eventType = 'PAGE_VIEW'
    const topPagesRAW = await prisma.analyticsEvent.groupBy({
      by: ['pageUrl'],
      where: { eventType: 'PAGE_VIEW', pageUrl: { not: null } },
      _count: { pageUrl: true },
      orderBy: { _count: { pageUrl: 'desc' } },
      take: 10
    })
    
    const topPages = topPagesRAW.map(p => ({
      url: p.pageUrl,
      count: p._count.pageUrl
    }))

    // 2. "what they usually click" -> meaningful clicks
    const topClicksRAW = await prisma.analyticsEvent.groupBy({
      by: ['elementId'],
      where: { eventType: 'CLICK', elementId: { not: null } },
      _count: { elementId: true },
      orderBy: { _count: { elementId: 'desc' } },
      take: 10
    })
    
    const topClicks = topClicksRAW.map(c => ({
      element: c.elementId,
      count: c._count.elementId
    }))

    // 3. "what they are having problems or trouble with"
    const topErrorsRAW = await prisma.analyticsEvent.groupBy({
      by: ['elementId'], // we store error message in elementId or metadata, let's use elementId as problem context
      where: { eventType: 'ERROR' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    const topErrors = topErrorsRAW.map(e => ({
      problem: e.elementId,
      count: e._count.id
    }))

    return reply.send({
      topPages,
      topClicks,
      topErrors
    })
  })

  // GET /api/admin/users
  app.get('/admin/users', async (req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      }
    })
    return reply.send(users)
  })
}
