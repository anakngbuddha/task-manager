import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'
import { UAParser } from 'ua-parser-js'

export async function adminRoutes(app: FastifyInstance) {
  // ─── Admin auth guard ────────────────────────────────────────────
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
    ;(req as any).adminUser = user
  })

  // ─── GET /api/admin/metrics ──────────────────────────────────────
  app.get('/admin/metrics', async (req, reply) => {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      totalUsers,
      activeProjects,
      totalTasks,
      recentSignups,
      completedTasks,
      overdueTasks,
      totalInvites,
      acceptedInvites,
      totalNotifications,
      readNotifications,
      dauCount,
      wauCount,
      churnRiskUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.task.count(),
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.task.count({ where: { completedAt: { not: null } } }),
      prisma.task.count({
        where: {
          deadline: { lt: now },
          completedAt: null,
          status: { not: 'DONE' },
        }
      }),
      prisma.projectInvite.count(),
      prisma.projectInvite.count({ where: { acceptedById: { not: null } } }),
      prisma.notification.count(),
      prisma.notification.count({ where: { readAt: { not: null } } }),
      prisma.session.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.session.findMany({
        where: { createdAt: { gte: oneWeekAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.user.count({
        where: {
          role: { not: 'admin' },
          lastSeenAt: { lt: oneWeekAgo },
        }
      }),
    ])

    // Avg time to complete a task (in days)
    const completedTasksSample = await prisma.task.findMany({
      where: { completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 500,
    })

    const avgCompletionDays =
      completedTasksSample.length === 0
        ? 0
        : Math.round(
            completedTasksSample.reduce((acc, t) => {
              const ms = t.completedAt!.getTime() - t.createdAt.getTime()
              return acc + ms / (1000 * 60 * 60 * 24)
            }, 0) / completedTasksSample.length
          )

    const taskCompletionRate =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
    const inviteAcceptanceRate =
      totalInvites === 0 ? 0 : Math.round((acceptedInvites / totalInvites) * 100)
    const notificationReadRate =
      totalNotifications === 0 ? 0 : Math.round((readNotifications / totalNotifications) * 100)

    // ── NEW (medium priority): Projects with unread group chats ──────
    // For each project, find the latest message and compare with all members' lastReadAt
    const projectsWithMessages = await prisma.projectMessage.groupBy({
      by: ['projectId'],
      _max: { createdAt: true },
    })

    let projectsWithUnreadChats = 0
    for (const pm of projectsWithMessages) {
      const latestMsgAt = pm._max.createdAt
      if (!latestMsgAt) continue
      // Check if any member's read state is behind the latest message
      const staleMemberCount = await prisma.projectChatReadState.count({
        where: {
          projectId: pm.projectId,
          lastReadAt: { lt: latestMsgAt },
        }
      })
      if (staleMemberCount > 0) projectsWithUnreadChats++
    }

    // ── Phase 4: Consent Overview ────────────────────────────────────
    const allUsers = await prisma.user.findMany({ select: { consent: true } })
    let acceptedAll = 0
    let essentialOnly = 0
    let noChoice = 0

    allUsers.forEach(u => {
      if (!u.consent) {
        noChoice++
      } else {
        const c = u.consent as any
        if (c.analytics && c.preferences) {
          acceptedAll++
        } else {
          essentialOnly++
        }
      }
    })
    const consentOverview = { acceptedAll, essentialOnly, noChoice }

    return reply.send({
      totalUsers,
      activeProjects,
      totalTasks,
      recentSignups,
      taskCompletionRate,
      overdueTasks,
      avgCompletionDays,
      inviteAcceptanceRate,
      notificationReadRate,
      dauCount: dauCount.length,
      wauCount: wauCount.length,
      churnRiskUsers,
      // Medium priority — NEW
      projectsWithUnreadChats,
      consentOverview,
    })
  })

  // ─── GET /api/admin/analytics ────────────────────────────────────
  app.get('/admin/analytics', async (req, reply) => {
    const topPagesRAW = await prisma.analyticsEvent.groupBy({
      by: ['pageUrl'],
      where: { eventType: 'PAGE_VIEW', pageUrl: { not: null } },
      _count: { pageUrl: true },
      orderBy: { _count: { pageUrl: 'desc' } },
      take: 10
    })
    const topPages = topPagesRAW.map(p => ({ url: p.pageUrl, count: p._count.pageUrl }))

    const topClicksRAW = await prisma.analyticsEvent.groupBy({
      by: ['elementId'],
      where: { eventType: 'CLICK', elementId: { not: null } },
      _count: { elementId: true },
      orderBy: { _count: { elementId: 'desc' } },
      take: 10
    })
    
    // Enrich top clicks with recent metadata
    const topClicks = await Promise.all(topClicksRAW.map(async c => {
      const recent = await prisma.analyticsEvent.findFirst({
        where: { eventType: 'CLICK', elementId: c.elementId },
        orderBy: { createdAt: 'desc' }
      })
      const meta = recent?.metadata as any
      return { 
        element: c.elementId, 
        count: c._count.elementId,
        text: meta?.originalText || c.elementId,
        path: meta?.domPath || ''
      }
    }))

    const topErrorsRAW = await prisma.analyticsEvent.groupBy({
      by: ['elementId'],
      where: { eventType: 'ERROR' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })
    
    // Enrich top errors with recent metadata
    const topErrors = await Promise.all(topErrorsRAW.map(async e => {
      const recent = await prisma.analyticsEvent.findFirst({
        where: { eventType: 'ERROR', elementId: e.elementId },
        orderBy: { createdAt: 'desc' }
      })
      const meta = recent?.metadata as any
      return { 
        problem: e.elementId, 
        count: e._count.id,
        source: meta?.source || 'Unknown',
        stack: meta?.stack || ''
      }
    }))

    const perfEvents = await prisma.analyticsEvent.findMany({
      where: { eventType: 'PERFORMANCE', elementId: 'PAGE_LOAD' },
      select: { metadata: true }
    });
    let avgLoadTime = 0;
    if (perfEvents.length > 0) {
      const totalLoad = perfEvents.reduce((acc, ev) => acc + ((ev.metadata as any)?.loadTimeMs || 0), 0);
      avgLoadTime = Math.round(totalLoad / perfEvents.length);
    }

    return reply.send({ topPages, topClicks, topErrors, performance: { avgLoadTime } })
  })

  // ─── GET /api/admin/analytics/extended ──────────────────────────
  app.get('/admin/analytics/extended', async (req, reply) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Previously implemented (high priority) ───────────────────────

    // 1. Task completion trend
    const completedRecent = await prisma.task.findMany({
      where: { completedAt: { gte: thirtyDaysAgo, not: null } },
      select: { completedAt: true },
    })
    const completionByDay: Record<string, number> = {}
    completedRecent.forEach(t => {
      const d = t.completedAt!.toISOString().slice(0, 10)
      completionByDay[d] = (completionByDay[d] ?? 0) + 1
    })
    const completionTrend = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      completionTrend.push({ date: d, count: completionByDay[d] ?? 0 })
    }

    // 2. Priority distribution
    const priorityDistRAW = await prisma.task.groupBy({
      by: ['priority'],
      _count: { id: true },
    })
    const priorityDistribution = priorityDistRAW.map(p => ({ priority: p.priority, count: p._count.id }))

    // 3. Task status distribution
    const statusDistRAW = await prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    const statusDistribution = statusDistRAW.map(s => ({ status: s.status, count: s._count.id }))

    // 4. Peak usage hours
    const recentEvents = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    })
    const hourBuckets: Record<number, number> = {}
    recentEvents.forEach(e => {
      const h = e.createdAt.getHours()
      hourBuckets[h] = (hourBuckets[h] ?? 0) + 1
    })
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      count: hourBuckets[h] ?? 0,
    }))

    // 5. Notification read rate trend
    const notificationsRecent = await prisma.notification.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, readAt: true },
    })
    const notifByDay: Record<string, { total: number; read: number }> = {}
    notificationsRecent.forEach(n => {
      const d = n.createdAt.toISOString().slice(0, 10)
      if (!notifByDay[d]) notifByDay[d] = { total: 0, read: 0 }
      notifByDay[d].total++
      if (n.readAt) notifByDay[d].read++
    })
    const notificationReadTrend = Object.entries(notifByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, read }]) => ({
        date,
        readRate: total === 0 ? 0 : Math.round((read / total) * 100),
      }))

    // ── NEW (medium priority) ────────────────────────────────────────

    // 6. Sprint completion rate
    const [totalSprints, completedSprints] = await Promise.all([
      prisma.sprint.count(),
      prisma.sprint.count({ where: { status: 'COMPLETED' } }),
    ])
    const sprintCompletionRate =
      totalSprints === 0 ? 0 : Math.round((completedSprints / totalSprints) * 100)

    // 7. Most commented tasks (top 10)
    const commentCountsRaw = await prisma.taskComment.groupBy({
      by: ['taskId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const taskIds = commentCountsRaw.map(r => r.taskId)
    const taskTitles = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true },
    })
    const titleMap = Object.fromEntries(taskTitles.map(t => [t.id, t.title]))
    const mostCommentedTasks = commentCountsRaw.map(r => ({
      taskId: r.taskId,
      title: titleMap[r.taskId] ?? 'Unknown Task',
      count: r._count.id,
    }))

    // 8. Average tasks per user (across all projects)
    const [totalTaskCount, totalMembers] = await Promise.all([
      prisma.task.count({ where: { assigneeId: { not: null } } }),
      prisma.projectMember.count(),
    ])
    const avgTasksPerUser =
      totalMembers === 0 ? 0 : Math.round((totalTaskCount / totalMembers) * 10) / 10

    // 9. Tag usage (top 10 most used tags)
    const tagUsageRaw = await prisma.taskTag.groupBy({
      by: ['tagId'],
      _count: { taskId: true },
      orderBy: { _count: { taskId: 'desc' } },
      take: 10,
    })
    const tagIds = tagUsageRaw.map(r => r.tagId)
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true, color: true },
    })
    const tagMap = Object.fromEntries(tags.map(t => [t.id, t]))
    const tagUsage = tagUsageRaw.map(r => ({
      tagId: r.tagId,
      name: tagMap[r.tagId]?.name ?? 'Unknown',
      color: tagMap[r.tagId]?.color ?? '#6366f1',
      count: r._count.taskId,
    }))

    // 10. Subtask usage rate
    const [subtaskCount, totalTaskCountAll] = await Promise.all([
      prisma.task.count({ where: { parentId: { not: null } } }),
      prisma.task.count(),
    ])
    const subtaskUsageRate =
      totalTaskCountAll === 0 ? 0 : Math.round((subtaskCount / totalTaskCountAll) * 100)

    // 11. DM vs group chat ratio
    const [directMessages, groupMessages] = await Promise.all([
      prisma.projectDirectMessage.count(),
      prisma.projectMessage.count(),
    ])
    const chatRatio = { directMessages, groupMessages }

    // 12. Device / OS breakdown & Location (parse AnalyticsEvent SESSION_START)
    const sessionEvents = await prisma.analyticsEvent.findMany({
      where: { eventType: 'SESSION_START', createdAt: { gte: thirtyDaysAgo } },
      select: { metadata: true },
      take: 2000, // cap for performance
    })
    
    const deviceBreakdownMap: Record<string, number> = {}
    const locationBreakdownMap: Record<string, number> = {}

    sessionEvents.forEach(e => {
      const meta = e.metadata as any
      const uaString = meta?.userAgent || ''
      
      // Location logic
      const timeZone = meta?.timeZone || 'Unknown'
      locationBreakdownMap[timeZone] = (locationBreakdownMap[timeZone] || 0) + 1

      if (!uaString) {
        deviceBreakdownMap['Unknown'] = (deviceBreakdownMap['Unknown'] || 0) + 1
        return
      }
      
      const parser = new UAParser(uaString)
      const os = parser.getOS()
      const osName = os.name || 'Unknown OS'
      
      let versionStr = ''
      if (os.version) {
         // Only take the major version if possible, to avoid too many fragments
         versionStr = ` ${os.version.split('.')[0]}`
      }
      
      const label = `${osName}${versionStr}`
      deviceBreakdownMap[label] = (deviceBreakdownMap[label] || 0) + 1
    })

    const deviceBreakdown = Object.entries(deviceBreakdownMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 combinations

    const topLocations = Object.entries(locationBreakdownMap)
      .map(([name, value]) => {
         const formattedName = name === 'Unknown' ? name : name.replace(/_/g, ' ').replace(/\//g, ' / ')
         return { name: formattedName, value }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    // 13. Top Email Domains
    const allUsers = await prisma.user.findMany({
      select: { email: true }
    })

    const emailDomainMap: Record<string, number> = {}
    allUsers.forEach(u => {
      const parts = u.email.split('@')
      if (parts.length === 2) {
        const domain = parts[1].toLowerCase()
        emailDomainMap[domain] = (emailDomainMap[domain] || 0) + 1
      }
    })

    const topEmailDomains = Object.entries(emailDomainMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    return reply.send({
      // High priority (existing)
      completionTrend,
      priorityDistribution,
      statusDistribution,
      peakHours,
      notificationReadTrend,
      // Medium priority (new)
      sprintCompletionRate,
      mostCommentedTasks,
      avgTasksPerUser,
      tagUsage,
      subtaskUsageRate,
      chatRatio,
      deviceBreakdown,
      topLocations,
      topEmailDomains,
    })
  })

  // ─── GET /api/admin/users ────────────────────────────────────────
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
        lastSeenAt: true,
      }
    })
    return reply.send(users)
  })

  // ─── PATCH /api/admin/users/:id/status ───────────────────────────
  // Ban or unban a user account (status: 'active' | 'banned')
  app.patch('/admin/users/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status } = req.body as { status: string }

    if (!['active', 'banned'].includes(status)) {
      return reply.status(400).send({ error: 'status must be "active" or "banned"' })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return reply.status(404).send({ error: 'User not found' })
    if (target.role === 'admin') {
      return reply.status(403).send({ error: 'Cannot ban a system admin.' })
    }

    if (status === 'banned') {
      // Revoke all active sessions to immediately log the user out
      await prisma.session.deleteMany({ where: { userId: id } })
      await prisma.user.update({ where: { id }, data: { role: 'banned' } })
    } else {
      // Restore to regular user
      await prisma.user.update({ where: { id }, data: { role: 'user' } })
    }

    return reply.send({ id, status })
  })

  // ─── DELETE /api/admin/projects/:id ─────────────────────────────
  // Hard-delete a project and all related data (cascades via Prisma)
  app.delete('/admin/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    // Delete in dependency order to satisfy FK constraints
    await prisma.$transaction([
      prisma.automationLog.deleteMany({ where: { projectId: id } }),
      prisma.automationRule.deleteMany({ where: { projectId: id } }),
      prisma.projectMessage.deleteMany({ where: { projectId: id } }),
      prisma.projectDirectMessage.deleteMany({ where: { projectId: id } }),
      prisma.projectChatReadState.deleteMany({ where: { projectId: id } }),
      prisma.taskComment.deleteMany({ where: { task: { projectId: id } } }),
      prisma.timeLog.deleteMany({ where: { task: { projectId: id } } }),
      prisma.taskTag.deleteMany({ where: { task: { projectId: id } } }),
      prisma.task.deleteMany({ where: { projectId: id } }),
      prisma.sprint.deleteMany({ where: { projectId: id } }),
      prisma.projectMember.deleteMany({ where: { projectId: id } }),
      prisma.projectInvite.deleteMany({ where: { projectId: id } }),
      prisma.activityEvent.deleteMany({ where: { projectId: id } }),
      prisma.auditLog.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ])

    return reply.status(204).send()
  })
}
