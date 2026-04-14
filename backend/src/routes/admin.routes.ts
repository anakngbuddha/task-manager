import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'

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
    const topClicks = topClicksRAW.map(c => ({ element: c.elementId, count: c._count.elementId }))

    const topErrorsRAW = await prisma.analyticsEvent.groupBy({
      by: ['elementId'],
      where: { eventType: 'ERROR' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })
    const topErrors = topErrorsRAW.map(e => ({ problem: e.elementId, count: e._count.id }))

    return reply.send({ topPages, topClicks, topErrors })
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

    // 12. Device / browser breakdown (parse Session.userAgent)
    const sessions = await prisma.session.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, userAgent: { not: null } },
      select: { userAgent: true },
      take: 2000, // cap for performance
    })
    const deviceBreakdown = { mobile: 0, desktop: 0, other: 0 }
    const mobileRx = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
    const desktopRx = /windows|macintosh|linux|x11/i
    sessions.forEach(s => {
      if (!s.userAgent) return
      if (mobileRx.test(s.userAgent)) deviceBreakdown.mobile++
      else if (desktopRx.test(s.userAgent)) deviceBreakdown.desktop++
      else deviceBreakdown.other++
    })

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
}
