import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { notificationService } from '../services/notification.service.js';
import { sendScheduleReminderEmail, sendTaskDeadlineEmail, } from '../services/email.service.js';
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://task-manager-mauve-eta.vercel.app';
export function startNotificationCron() {
    cron.schedule('*/5 * * * *', async () => {
        console.log('[cron] Running notification checks...');
        try {
            await checkScheduleReminders();
            await checkTaskDeadlineReminders();
        }
        catch (err) {
            console.error('[cron] Top-level error:', err);
        }
    });
    console.log('[cron] Notification cron started (every 5 minutes)');
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
                await sendScheduleReminderEmail({
                    to: [attendee.email],
                    scheduledBy: schedule.creator.name || schedule.creator.email,
                    title: schedule.title,
                    type: schedule.type,
                    scheduledAt: schedule.scheduledAt,
                    details: schedule.details,
                    location: schedule.location,
                    timeUntil,
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
                console.log(`[cron] Sent ${type} for schedule "${schedule.title}" to ${attendee.email}`);
            }
            catch (err) {
                console.error(`[cron] Error sending ${type} for schedule ${schedule.id} to ${attendee.email}:`, err);
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
                    console.log(`[cron] Sent ${type} for task "${task.title}" to ${recipient.email}`);
                }
                catch (err) {
                    console.error(`[cron] Error sending ${type} for task ${task.id} to ${recipient.email}:`, err);
                }
            }
        }
        catch (err) {
            console.error(`[cron] Error processing task ${task.id} for ${type}:`, err);
        }
    }
}
