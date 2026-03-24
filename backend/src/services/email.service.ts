import nodemailer from 'nodemailer'
import type { ScheduleType } from '@prisma/client'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
})

const FROM = process.env.EMAIL_FROM || 'WSI TaskA <noreply@yourdomain.com>'

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  MEETING: 'Meeting',
  TRAINING: 'Training',
  REVIEW: 'Review',
  REMINDER: 'Reminder',
  OTHER: 'Event',
}

function baseLayout(title: string, accentColor: string, bodyHtml: string, footerText: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:${accentColor};padding:20px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">${title}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#8993a4;font-size:12px;line-height:1.5;">${footerText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function detailRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:6px 0;color:#6b778c;font-size:13px;width:110px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#172b4d;font-size:14px;">${value}</td>
  </tr>`
}

// ────── Schedule invitation email ──────

export async function sendScheduleInviteEmail(opts: {
  to: string[]
  scheduledBy: string
  title: string
  type: ScheduleType
  scheduledAt: Date
  details?: string | null
  location?: string | null
}) {
  const typeLabel = SCHEDULE_TYPE_LABELS[opts.type]
  const rows = [
    detailRow('Type', typeLabel),
    detailRow('When', formatDate(opts.scheduledAt)),
    opts.location ? detailRow('Location', opts.location) : '',
    detailRow('Organized by', opts.scheduledBy),
  ].join('')

  const detailsBlock = opts.details
    ? `<p style="margin:16px 0 0;color:#42526e;font-size:14px;line-height:1.6;">${opts.details}</p>`
    : ''

  const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">You have been invited to the following ${typeLabel.toLowerCase()}:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
    ${detailsBlock}`

  const html = baseLayout(
    `📅 Invitation: ${opts.title}`,
    '#0052CC',
    body,
    'You are receiving this because you were included in this schedule.',
  )

  await transporter.sendMail({
    from: FROM,
    to: opts.to.join(', '),
    subject: `Invitation: ${opts.title} — ${formatDate(opts.scheduledAt)}`,
    html,
  })
}

// ────── Schedule reminder email ──────

export async function sendScheduleReminderEmail(opts: {
  to: string[]
  scheduledBy: string
  title: string
  type: ScheduleType
  scheduledAt: Date
  details?: string | null
  location?: string | null
  timeUntil: '1 day' | '15 minutes'
}) {
  const typeLabel = SCHEDULE_TYPE_LABELS[opts.type]
  const rows = [
    detailRow('Type', typeLabel),
    detailRow('When', formatDate(opts.scheduledAt)),
    opts.location ? detailRow('Location', opts.location) : '',
    detailRow('Organized by', opts.scheduledBy),
  ].join('')

  const detailsBlock = opts.details
    ? `<p style="margin:16px 0 0;color:#42526e;font-size:14px;line-height:1.6;">${opts.details}</p>`
    : ''

  const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      <strong>${opts.title}</strong> is starting in <strong>${opts.timeUntil}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
    ${detailsBlock}`

  const html = baseLayout(
    `⏰ Reminder: ${opts.title} in ${opts.timeUntil}`,
    '#FF991F',
    body,
    'You are receiving this because you were included in this schedule.',
  )

  await transporter.sendMail({
    from: FROM,
    to: opts.to.join(', '),
    subject: `Reminder: ${opts.title} is in ${opts.timeUntil}`,
    html,
  })
}

// ────── Schedule cancellation email ──────

export async function sendScheduleCancellationEmail(opts: {
  to: string[]
  cancelledBy: string
  title: string
  type: ScheduleType
  scheduledAt: Date
}) {
  const typeLabel = SCHEDULE_TYPE_LABELS[opts.type]

  const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      The following ${typeLabel.toLowerCase()} has been <strong style="color:#DE350B;">cancelled</strong>:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${detailRow('Event', opts.title)}
      ${detailRow('Was scheduled', formatDate(opts.scheduledAt))}
      ${detailRow('Cancelled by', opts.cancelledBy)}
    </table>`

  const html = baseLayout(
    `❌ Cancelled: ${opts.title}`,
    '#DE350B',
    body,
    'This schedule has been cancelled by ' + opts.cancelledBy + '.',
  )

  await transporter.sendMail({
    from: FROM,
    to: opts.to.join(', '),
    subject: `Cancelled: ${opts.title}`,
    html,
  })
}

// ────── Task deadline email ──────

export async function sendTaskDeadlineEmail(opts: {
  to: string
  userName: string
  taskTitle: string
  projectName: string
  deadline: Date
  taskUrl: string
  timeUntil: '1 day' | '15 minutes'
}) {
  const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      Hi ${opts.userName}, your task is due in <strong>${opts.timeUntil}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${detailRow('Task', opts.taskTitle)}
      ${detailRow('Project', opts.projectName)}
      ${detailRow('Deadline', formatDate(opts.deadline))}
    </table>
    <p style="margin:20px 0 0;">
      <a href="${opts.taskUrl}"
         style="display:inline-block;padding:10px 24px;background:#0052CC;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">
        Open Task
      </a>
    </p>`

  const html = baseLayout(
    `⚠️ Deadline approaching: ${opts.taskTitle}`,
    '#FF5630',
    body,
    'You are receiving this because this task is assigned to you.',
  )

  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: `Task deadline approaching: ${opts.taskTitle} is due in ${opts.timeUntil}`,
    html,
  })
}
