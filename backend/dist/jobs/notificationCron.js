import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { purgeExpiredIdempotencyKeys } from '../services/idempotency.service.js';
import { notificationService } from '../services/notification.service.js';
import { sendScheduleReminderEmail, sendTaskDeadlineEmail, } from '../services/email.service.js';
import { scheduleCalendarUrl } from '../lib/publicUrls.js';
import { runAutomations } from '../services/automation.engine.js';
import { FRONTEND_URL } from '../config/constants.js';
import { logger } from '../app.js';
export function startNotificationCron() {
    cron.schedule('*/5 * * * *', async () => {
        logger.info('cron_notification_tick');
        try {
            await purgeExpiredIdempotencyKeys();
            await purgExpiredChatMessages();
            // Audit log retention is intentionally infinite (audit finding #9).
            // Move to an archival table if storage pressure ever becomes an issue.
            await checkScheduleReminders();
            await checkTaskDeadlineReminders();
        }
        catch (err) {
            logger.error({ err }, 'cron_top_level_error');
        }
    });
    logger.info('cron_notification_started');
}
// ─── Chat session purge (30-day TTL; messages cascade on delete) ─
async function purgExpiredChatMessages() {
    try {
        const result = await prisma.chatSession.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
        if (result.count > 0) {
            logger.info({ count: result.count }, 'cron_chat_sessions_purged');
        }
    }
    catch (err) {
        logger.error({ err }, 'cron_chat_purge_error');
    }
}
// ─── Schedule reminders ───────────────────────────────────
async function checkScheduleReminders() {
    const now = new Date();
    await processScheduleWindow(now, 'SCHEDULE_1DAY', 23 * 60 + 50, 24 * 60 + 10, '1 day');
    await processScheduleWindow(now, 'SCHEDULE_15MIN', 10, 20, '15 minutes');
}
async function processScheduleWindow(now, type, minMinutes, maxMinutes, timeUntil) {
    const windowStart = new Date(now.getTime() + minMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + maxMinutes * 60 * 1000);
    const schedules = await prisma.schedule.findMany({
        where: {
            scheduledAt: { gte: windowStart, lte: windowEnd },
        },
        include: {
            attendees: true,
            creator: { select: { id: true, name: true, email: true } },
        },
    });
    for (const schedule of schedules) {
        for (const attendee of schedule.attendees) {
            if (!attendee.userId)
                continue;
            if (attendee.response === 'DECLINED')
                continue;
            try {
                const alreadySent = await prisma.scheduleNotificationLog.findUnique({
                    where: {
                        scheduleId_userId_type: {
                            scheduleId: schedule.id,
                            userId: attendee.userId,
                            type,
                        },
                    },
                });
                if (alreadySent)
                    continue;
                const viewInAppUrl = scheduleCalendarUrl(FRONTEND_URL, schedule.id, schedule.scheduledAt);
                await sendScheduleReminderEmail({
                    to: [attendee.email],
                    scheduledBy: schedule.creator.name || schedule.creator.email,
                    title: schedule.title,
                    type: schedule.type,
                    scheduledAt: schedule.scheduledAt,
                    details: schedule.details,
                    location: schedule.location,
                    isVirtual: schedule.isVirtual,
                    timeUntil,
                    viewInAppUrl,
                });
                await prisma.scheduleNotificationLog.create({
                    data: {
                        scheduleId: schedule.id,
                        userId: attendee.userId,
                        type,
                    },
                });
                await notificationService.create({
                    userId: attendee.userId,
                    projectId: schedule.projectId ?? undefined,
                    type: 'SCHEDULE_REMINDER',
                    title: `${schedule.title} in ${timeUntil}`,
                    body: `Your ${schedule.type.toLowerCase()} is starting in ${timeUntil}.`,
                    href: `/schedules`,
                });
                logger.info({ type, scheduleTitle: schedule.title, email: attendee.email }, 'cron_schedule_reminder_sent');
            }
            catch (err) {
                logger.error({ err, type, scheduleId: schedule.id, email: attendee.email }, 'cron_schedule_reminder_error');
            }
        }
    }
}
// ─── Task deadline reminders ──────────────────────────────
async function checkTaskDeadlineReminders() {
    const now = new Date();
    await processTaskWindow(now, 'TASK_DEADLINE_1DAY', 23 * 60 + 50, 24 * 60 + 10, '1 day');
    await processTaskWindow(now, 'TASK_DEADLINE_15MIN', 10, 20, '15 minutes');
}
async function processTaskWindow(now, type, minMinutes, maxMinutes, timeUntil) {
    const windowStart = new Date(now.getTime() + minMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + maxMinutes * 60 * 1000);
    const tasks = await prisma.task.findMany({
        where: {
            deadline: { gte: windowStart, lte: windowEnd },
            status: { notIn: ['DONE', 'READY'] },
        },
        include: {
            project: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
        },
    });
    for (const task of tasks) {
        try {
            let recipients;
            if (task.assignee) {
                recipients = [task.assignee];
            }
            else {
                const members = await prisma.projectMember.findMany({
                    where: { projectId: task.projectId },
                    include: { user: { select: { id: true, name: true, email: true } } },
                });
                recipients = members.map(m => m.user);
            }
            for (const recipient of recipients) {
                try {
                    const alreadySent = await prisma.scheduleNotificationLog.findUnique({
                        where: {
                            taskId_userId_type: {
                                taskId: task.id,
                                userId: recipient.id,
                                type,
                            },
                        },
                    });
                    if (alreadySent)
                        continue;
                    const taskUrl = `${FRONTEND_URL}/projects/${task.projectId}?task=${task.id}`;
                    await sendTaskDeadlineEmail({
                        to: recipient.email,
                        userName: recipient.name || recipient.email,
                        taskTitle: task.title,
                        projectName: task.project.name,
                        deadline: task.deadline,
                        taskUrl,
                        timeUntil,
                    });
                    await prisma.scheduleNotificationLog.create({
                        data: {
                            taskId: task.id,
                            userId: recipient.id,
                            type,
                        },
                    });
                    await notificationService.create({
                        userId: recipient.id,
                        projectId: task.projectId,
                        type: 'TASK_DEADLINE',
                        title: `${task.title} due in ${timeUntil}`,
                        body: `Deadline approaching for task in ${task.project.name}.`,
                        href: `/projects/${task.projectId}?task=${task.id}`,
                    });
                    logger.info({ type, taskTitle: task.title, email: recipient.email }, 'cron_task_deadline_sent');
                }
                catch (err) {
                    logger.error({ err, type, taskId: task.id, email: recipient.email }, 'cron_task_deadline_error');
                }
            }
            // Fire automation engine for TASK_DEADLINE_APPROACHING (only on 1DAY window to avoid duplicates)
            if (type === 'TASK_DEADLINE_1DAY') {
                runAutomations({
                    projectId: task.projectId,
                    actorId: 'system',
                    triggerType: 'TASK_DEADLINE_APPROACHING',
                    task: {
                        id: task.id,
                        title: task.title,
                        status: task.status,
                        priority: task.priority,
                        assigneeId: task.assignee?.id ?? null,
                        sprintId: null,
                        projectId: task.projectId,
                    },
                }).catch((err) => logger.error({ err, taskId: task.id }, 'automation_deadline_hook_error'));
            }
        }
        catch (err) {
            logger.error({ err, taskId: task.id, type }, 'cron_task_processing_error');
        }
    }
}
