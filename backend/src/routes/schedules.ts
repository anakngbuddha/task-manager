import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduleAttendeeResponse, ScheduleType } from '@prisma/client'
import { authenticate } from '../middlewares/authenticate.js'
import { requireProjectRole } from '../services/projectAuth.service.js'
import { prisma } from '../lib/prisma.js'
import { activityService } from '../services/activity.service.js'
import { notificationService } from '../services/notification.service.js'
import {
  sendScheduleInviteEmail,
  sendScheduleCancellationEmail,
} from '../services/email.service.js'

const attendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  userId: z.string().optional(),
})

const createScheduleSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.nativeEnum(ScheduleType),
  scheduledAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  details: z.string().max(2000).optional(),
  location: z.string().optional(),
  projectId: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
})

const updateScheduleSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(ScheduleType).optional(),
  scheduledAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  details: z.string().max(2000).nullable().optional(),
  location: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  attendees: z.array(attendeeSchema).optional(),
})

const respondScheduleSchema = z.object({
  response: z.nativeEnum(ScheduleAttendeeResponse),
})

const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://task-manager-mauve-eta.vercel.app'

export async function scheduleRoutes(app: FastifyInstance) {

  // ─── POST /schedules ──────────────────────────────────────

  app.post(
    '/schedules',
    { preHandler: authenticate },
    async (req, reply) => {
      let body;
      try {
        body = createScheduleSchema.parse(req.body)
      } catch (err: any) {
        return reply.status(400).send({ error: 'Validation Error: ' + err.message })
      }

      const user = req.authUser

      const scheduledAt = new Date(body.scheduledAt)
      if (scheduledAt <= new Date()) {
        return reply.status(400).send({ error: 'scheduledAt must be in the future' })
      }
      if (body.endAt) {
        const endAt = new Date(body.endAt)
        if (endAt <= scheduledAt) {
          return reply.status(400).send({ error: 'endAt must be after scheduledAt' })
        }
      }

      if (body.projectId) {
        try {
          await requireProjectRole(body.projectId, user.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
        } catch {
          return reply.status(403).send({ error: 'Forbidden' })
        }
      }

      const attendeeInputs = body.attendees ?? []
      const creatorAlreadyIncluded = attendeeInputs.some(a => a.email === user.email)
      if (!creatorAlreadyIncluded) {
        attendeeInputs.unshift({ email: user.email, name: user.name ?? undefined, userId: user.id })
      }

      // Resolve attendee emails to internal users so invitations can be accepted/declined.
      const emailsToResolve = Array.from(new Set(attendeeInputs.map(a => a.email)))
      const resolvedUsers = await prisma.user.findMany({
        where: { email: { in: emailsToResolve } },
        select: { id: true, email: true, name: true },
      })
      const userByEmail = new Map(resolvedUsers.map(u => [u.email, u]))

      let schedule;
      try {
        schedule = await prisma.schedule.create({
          data: {
            title: body.title,
            type: body.type,
            scheduledAt,
            details: body.details ?? null,
            location: body.location ?? null,
            projectId: body.projectId ?? null,
            creatorId: user.id,
            endAt: body.endAt ? new Date(body.endAt) : null,
            attendees: {
              create: attendeeInputs.map(a => ({
                email: a.email,
                name: a.name ?? userByEmail.get(a.email)?.name ?? null,
                userId: a.userId ?? userByEmail.get(a.email)?.id ?? null,
                response: a.email === user.email ? ScheduleAttendeeResponse.ACCEPTED : ScheduleAttendeeResponse.PENDING,
              })),
            },
          },
          include: { attendees: true, creator: { select: { id: true, name: true, email: true } } },
        })
      } catch (err: any) {
        return reply.status(400).send({ error: 'Database Error: ' + err.message })
      }

      if (body.projectId) {
        try {
          await activityService.record({
            projectId: body.projectId,
            actorId: user.id,
            type: 'SCHEDULE_CREATED',
            entityType: 'SCHEDULE',
            entityId: schedule.id,
            metadata: { title: body.title, type: body.type },
          })
        } catch (err: any) {
          console.error('Failed to log activity:', err)
        }
      }

      try {
        const allEmails = schedule.attendees.map(a => a.email)
        await sendScheduleInviteEmail({
          to: allEmails,
          scheduledBy: user.name || user.email,
          title: schedule.title,
          type: schedule.type,
          scheduledAt: schedule.scheduledAt,
          details: schedule.details,
          location: schedule.location,
        })
      } catch (err) {
        console.error('Failed to send schedule invite emails:', err)
      }

      // Notifications + activity for all participants.
      const participants = schedule.attendees.filter(a => a.userId)
      if (participants.length > 0) {
        const participantUserIds = participants.map(p => p.userId as string)
        const memberships = await prisma.projectMember.findMany({
          where: { userId: { in: participantUserIds } },
          select: { userId: true, projectId: true },
        })
        const projectsByUser = new Map<string, string[]>()
        for (const m of memberships) {
          const arr = projectsByUser.get(m.userId) ?? []
          arr.push(m.projectId)
          projectsByUser.set(m.userId, arr)
        }

        const pickProjectIdForUser = (uid: string) => {
          const userProjects = projectsByUser.get(uid) ?? []
          if (schedule.projectId && userProjects.includes(schedule.projectId)) return schedule.projectId
          return userProjects[0] ?? null
        }

        const dayKey = schedule.scheduledAt.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
        const uniqueProjectIds = new Set<string>()
        for (const p of participants) {
          const pid = pickProjectIdForUser(p.userId as string)
          if (pid) uniqueProjectIds.add(pid)
        }

        await Promise.all(
          participants.map(async (p) => {
            const uid = p.userId as string
            const pid = pickProjectIdForUser(uid)
            await notificationService.create({
              userId: uid,
              projectId: pid ?? undefined,
              type: 'SCHEDULE_INVITED',
              title: `Invitation: ${schedule.title}`,
              body: `You were invited to a ${schedule.type.toLowerCase()} scheduled for ${schedule.scheduledAt.toISOString()}.`,
              href: `/calendar/day/${dayKey}?scheduleId=${schedule.id}`,
              data: { scheduleId: schedule.id },
            })
          }),
        )

        for (const projectId of uniqueProjectIds) {
          await activityService.record({
            projectId,
            actorId: user.id,
            type: 'SCHEDULE_INVITED',
            entityType: 'SCHEDULE',
            entityId: schedule.id,
            metadata: {
              title: schedule.title,
              scheduledAt: schedule.scheduledAt.toISOString(),
              type: schedule.type,
              dayKey,
              response: 'PENDING',
            },
          })
        }
      }

      return reply.status(201).send(schedule)
    },
  )

  // ─── GET /schedules ───────────────────────────────────────

  app.get(
    '/schedules',
    { preHandler: authenticate },
    async (req, _reply) => {
      const { from, to, projectId } = req.query as { from?: string; to?: string; projectId?: string }
      const userId = req.authUser.id

      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)

      const where: any = {
        OR: [
          { creatorId: userId },
          { attendees: { some: { userId } } },
        ],
      }

      if (Object.keys(dateFilter).length > 0) {
        where.scheduledAt = dateFilter
      }
      if (projectId) {
        where.projectId = projectId
      }

      return prisma.schedule.findMany({
        where,
        include: {
          attendees: true,
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      })
    },
  )

  // ─── GET /schedules/:id ───────────────────────────────────

  app.get(
    '/schedules/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const userId = req.authUser.id

      const schedule = await prisma.schedule.findUnique({
        where: { id },
        include: {
          attendees: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      if (!schedule) {
        return reply.status(404).send({ error: 'Schedule not found' })
      }

      const isCreator = schedule.creatorId === userId
      const isAttendee = schedule.attendees.some(a => a.userId === userId)
      if (!isCreator && !isAttendee) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      return schedule
    },
  )

  // ─── PATCH /schedules/:id ─────────────────────────────────

  app.patch(
    '/schedules/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const user = req.authUser
      const body = updateScheduleSchema.parse(req.body)

      const existing = await prisma.schedule.findUnique({
        where: { id },
        include: { attendees: true },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Schedule not found' })
      }
      if (existing.creatorId !== user.id) {
        return reply.status(403).send({ error: 'Only the creator can edit this schedule' })
      }

      const scheduledAtChanged = body.scheduledAt && new Date(body.scheduledAt).getTime() !== existing.scheduledAt.getTime()

      if (scheduledAtChanged) {
        await prisma.scheduleNotificationLog.deleteMany({ where: { scheduleId: id } })
      }

      const updateData: any = {}
      if (body.title !== undefined) updateData.title = body.title
      if (body.type !== undefined) updateData.type = body.type
      if (body.scheduledAt !== undefined) updateData.scheduledAt = new Date(body.scheduledAt)
      if (body.endAt !== undefined) updateData.endAt = body.endAt ? new Date(body.endAt) : null
      if (body.details !== undefined) updateData.details = body.details
      if (body.location !== undefined) updateData.location = body.location
      if (body.projectId !== undefined) updateData.projectId = body.projectId

      let newAttendeeEmails: string[] = []

      if (body.attendees !== undefined) {
        const existingEmails = new Set(existing.attendees.map(a => a.email))
        const existingResponseByEmail = new Map(
          existing.attendees.map(a => [a.email, a.response]),
        )
        const incomingAttendees = body.attendees

        // Resolve incoming attendee emails to internal users for response support.
        const incomingEmailsToResolve = Array.from(new Set(incomingAttendees.map(a => a.email)))
        const resolvedUsers = await prisma.user.findMany({
          where: { email: { in: incomingEmailsToResolve } },
          select: { id: true, email: true, name: true },
        })
        const userByEmail = new Map(resolvedUsers.map(u => [u.email, u]))

        const creatorIncluded = incomingAttendees.some(a => a.email === user.email)
        if (!creatorIncluded) {
          incomingAttendees.unshift({ email: user.email, name: user.name ?? undefined, userId: user.id })
        }

        newAttendeeEmails = incomingAttendees
          .filter(a => !existingEmails.has(a.email))
          .map(a => a.email)

        await prisma.scheduleAttendee.deleteMany({ where: { scheduleId: id } })
        await prisma.scheduleAttendee.createMany({
          data: incomingAttendees.map(a => ({
            scheduleId: id,
            email: a.email,
            name: a.name ?? userByEmail.get(a.email)?.name ?? null,
            userId: a.userId ?? userByEmail.get(a.email)?.id ?? null,
            response:
              a.email === user.email
                ? ScheduleAttendeeResponse.ACCEPTED
                : existingResponseByEmail.get(a.email) ?? ScheduleAttendeeResponse.PENDING,
          })),
        })
      }

      const schedule = await prisma.schedule.update({
        where: { id },
        data: updateData,
        include: {
          attendees: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      if (newAttendeeEmails.length > 0) {
        try {
          await sendScheduleInviteEmail({
            to: newAttendeeEmails,
            scheduledBy: user.name || user.email,
            title: schedule.title,
            type: schedule.type,
            scheduledAt: schedule.scheduledAt,
            details: schedule.details,
            location: schedule.location,
          })
        } catch (err) {
          console.error('Failed to send invite emails to new attendees:', err)
        }
      }

      return schedule
    },
  )

  // ─── PATCH /schedules/:id/respond ─────────────────────────
  // Used by invitees to accept/decline a schedule invitation.
  app.patch(
    '/schedules/:id/respond',
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const user = req.authUser
      const body = respondScheduleSchema.parse(req.body)

      const attendee = await prisma.scheduleAttendee.findFirst({
        where: { scheduleId: id, userId: user.id },
      })

      if (!attendee) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const updated = await prisma.scheduleAttendee.update({
        where: { scheduleId_email: { scheduleId: id, email: attendee.email } },
        data: { response: body.response },
      })

      const schedule = await prisma.schedule.findUnique({
        where: { id },
        include: { attendees: true },
      })

      if (schedule) {
        const participants = schedule.attendees.filter(a => a.userId)
        if (participants.length > 0) {
          const participantUserIds = participants.map(p => p.userId as string)
          const memberships = await prisma.projectMember.findMany({
            where: { userId: { in: participantUserIds } },
            select: { userId: true, projectId: true },
          })
          const projectsByUser = new Map<string, string[]>()
          for (const m of memberships) {
            const arr = projectsByUser.get(m.userId) ?? []
            arr.push(m.projectId)
            projectsByUser.set(m.userId, arr)
          }

          const pickProjectIdForUser = (uid: string) => {
            const userProjects = projectsByUser.get(uid) ?? []
            if (schedule.projectId && userProjects.includes(schedule.projectId)) return schedule.projectId
            return userProjects[0] ?? null
          }

          const dayKey = schedule.scheduledAt.toISOString().slice(0, 10)

          const responseType =
            body.response === ScheduleAttendeeResponse.ACCEPTED ? 'SCHEDULE_INVITE_ACCEPTED' : 'SCHEDULE_INVITE_DECLINED'
          const responseText = body.response === ScheduleAttendeeResponse.ACCEPTED ? 'accepted' : 'declined'

          const uniqueProjectIds = new Set<string>()
          for (const p of participants) {
            const pid = pickProjectIdForUser(p.userId as string)
            if (pid) uniqueProjectIds.add(pid)
          }

          await Promise.all(
            participants.map(async (p) => {
              const uid = p.userId as string
              const pid = pickProjectIdForUser(uid)
              await notificationService.create({
                userId: uid,
                projectId: pid ?? undefined,
                type: responseType,
                title: `${responseText[0].toUpperCase()}${responseText.slice(1)}: ${schedule.title}`,
                body: `${user.name || user.email} ${responseText} the invitation for ${schedule.title}.`,
                href: `/calendar/day/${dayKey}?scheduleId=${schedule.id}`,
                data: { scheduleId: schedule.id, response: body.response },
              })
            }),
          )

          for (const projectId of uniqueProjectIds) {
            await activityService.record({
              projectId,
              actorId: user.id,
              type: responseType,
              entityType: 'SCHEDULE',
              entityId: schedule.id,
              metadata: {
                title: schedule.title,
                scheduledAt: schedule.scheduledAt.toISOString(),
                type: schedule.type,
                dayKey,
                response: body.response,
              },
            })
          }
        }
      }

      return reply.status(200).send({
        scheduleId: updated.scheduleId,
        response: updated.response,
      })
    },
  )

  // ─── DELETE /schedules/:id ────────────────────────────────

  app.delete(
    '/schedules/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const user = req.authUser

      const schedule = await prisma.schedule.findUnique({
        where: { id },
        include: { attendees: true },
      })

      if (!schedule) {
        return reply.status(404).send({ error: 'Schedule not found' })
      }
      if (schedule.creatorId !== user.id) {
        return reply.status(403).send({ error: 'Only the creator can delete this schedule' })
      }

      try {
        const attendeeEmails = schedule.attendees.map(a => a.email)
        if (attendeeEmails.length > 0) {
          await sendScheduleCancellationEmail({
            to: attendeeEmails,
            cancelledBy: user.name || user.email,
            title: schedule.title,
            type: schedule.type,
            scheduledAt: schedule.scheduledAt,
          })
        }
      } catch (err) {
        console.error('Failed to send cancellation emails:', err)
      }

      await prisma.schedule.delete({ where: { id } })
      return reply.status(204).send()
    },
  )

  // ─── GET /projects/:projectId/schedules ───────────────────

  app.get(
    '/projects/:projectId/schedules',
    { preHandler: authenticate },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      try {
        await requireProjectRole(projectId, req.authUser.id, ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'])
      } catch {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      return prisma.schedule.findMany({
        where: { projectId },
        include: {
          attendees: true,
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      })
    },
  )
}
