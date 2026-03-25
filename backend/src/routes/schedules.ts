import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduleType } from '@prisma/client'
import { authenticate } from '../middlewares/authenticate.js'
import { requireProjectRole } from '../services/projectAuth.service.js'
import { prisma } from '../lib/prisma.js'
import { activityService } from '../services/activity.service.js'
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
  details: z.string().max(2000).optional(),
  location: z.string().optional(),
  projectId: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
})

const updateScheduleSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(ScheduleType).optional(),
  scheduledAt: z.string().datetime().optional(),
  details: z.string().max(2000).nullable().optional(),
  location: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  attendees: z.array(attendeeSchema).optional(),
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
            attendees: {
              create: attendeeInputs.map(a => ({
                email: a.email,
                name: a.name ?? null,
                userId: a.userId ?? null,
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
      if (body.details !== undefined) updateData.details = body.details
      if (body.location !== undefined) updateData.location = body.location
      if (body.projectId !== undefined) updateData.projectId = body.projectId

      let newAttendeeEmails: string[] = []

      if (body.attendees !== undefined) {
        const existingEmails = new Set(existing.attendees.map(a => a.email))
        const incomingAttendees = body.attendees

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
            name: a.name ?? null,
            userId: a.userId ?? null,
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
