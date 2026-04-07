import { BrevoClient } from '@getbrevo/brevo';
// ────── Brevo client setup ──────
const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || '',
});
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'noreply@example.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'We Work IT';
// ────── Helper: send via Brevo (non-blocking fire-and-forget) ──────
function sendEmail(opts) {
    const toList = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((email) => ({ email }));
    brevo.transactionalEmails
        .sendTransacEmail({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: toList,
        subject: opts.subject,
        htmlContent: opts.html,
    })
        .then(() => {
        console.log(`[email] Sent "${opts.subject}" to ${toList.map((t) => t.email).join(', ')}`);
    })
        .catch((err) => {
        console.error(`[email] Failed to send "${opts.subject}":`, err);
    });
}
// ────── Utility helpers ──────
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function formatDate(date) {
    return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}
const SCHEDULE_TYPE_LABELS = {
    MEETING: 'Meeting',
    TRAINING: 'Training',
    REVIEW: 'Review',
    REMINDER: 'Reminder',
    OTHER: 'Event',
};
function baseLayout(title, accentColor, bodyHtml, footerText) {
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
</html>`;
}
function detailRow(label, value) {
    return `
  <tr>
    <td style="padding:6px 0;color:#6b778c;font-size:13px;width:110px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#172b4d;font-size:14px;">${value}</td>
  </tr>`;
}
// ────── Schedule invitation email ──────
export function sendScheduleInviteEmail(opts) {
    const typeLabel = SCHEDULE_TYPE_LABELS[opts.type];
    const safeTitle = escapeHtml(opts.title);
    const safeScheduledBy = escapeHtml(opts.scheduledBy);
    const rows = [
        detailRow('Type', escapeHtml(typeLabel)),
        detailRow('When', escapeHtml(formatDate(opts.scheduledAt))),
        opts.location ? detailRow('Location', escapeHtml(opts.location)) : '',
        detailRow('Organized by', safeScheduledBy),
    ].join('');
    const detailsBlock = opts.details
        ? `<p style="margin:16px 0 0;color:#42526e;font-size:14px;line-height:1.6;">${escapeHtml(opts.details)}</p>`
        : '';
    const btnBlock = opts.viewInAppUrl
        ? `<p style="margin:20px 0 0;">
         <a href="${escapeHtml(opts.viewInAppUrl)}"
            style="display:inline-block;padding:10px 24px;background:#0052CC;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">
           Open Context
         </a>
       </p>`
        : '';
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">You have been invited to the following ${escapeHtml(typeLabel.toLowerCase())}:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
    ${detailsBlock}
    ${btnBlock}`;
    const html = baseLayout(`📅 Invitation: ${safeTitle}`, '#0052CC', body, 'You are receiving this because you were included in this schedule.');
    sendEmail({
        to: opts.to,
        subject: `Invitation: ${opts.title} — ${formatDate(opts.scheduledAt)}`,
        html,
    });
}
// ────── Schedule reminder email ──────
export function sendScheduleReminderEmail(opts) {
    const typeLabel = SCHEDULE_TYPE_LABELS[opts.type];
    const safeTitle = escapeHtml(opts.title);
    const safeScheduledBy = escapeHtml(opts.scheduledBy);
    const rows = [
        detailRow('Type', escapeHtml(typeLabel)),
        detailRow('When', escapeHtml(formatDate(opts.scheduledAt))),
        opts.location ? detailRow('Location', escapeHtml(opts.location)) : '',
        detailRow('Organized by', safeScheduledBy),
    ].join('');
    const detailsBlock = opts.details
        ? `<p style="margin:16px 0 0;color:#42526e;font-size:14px;line-height:1.6;">${escapeHtml(opts.details)}</p>`
        : '';
    const btnBlock = opts.viewInAppUrl
        ? `<p style="margin:20px 0 0;">
         <a href="${escapeHtml(opts.viewInAppUrl)}"
            style="display:inline-block;padding:10px 24px;background:#0052CC;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">
           Open Context
         </a>
       </p>`
        : '';
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      <strong>${safeTitle}</strong> is starting in <strong>${escapeHtml(opts.timeUntil)}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
    ${detailsBlock}
    ${btnBlock}`;
    const html = baseLayout(`⏰ Reminder: ${safeTitle} in ${escapeHtml(opts.timeUntil)}`, '#FF991F', body, 'You are receiving this because you were included in this schedule.');
    sendEmail({
        to: opts.to,
        subject: `Reminder: ${opts.title} is in ${opts.timeUntil}`,
        html,
    });
}
// ────── Schedule cancellation email ──────
export function sendScheduleCancellationEmail(opts) {
    const typeLabel = SCHEDULE_TYPE_LABELS[opts.type];
    const safeTitle = escapeHtml(opts.title);
    const safeCancelledBy = escapeHtml(opts.cancelledBy);
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      The following ${escapeHtml(typeLabel.toLowerCase())} has been <strong style="color:#DE350B;">cancelled</strong>:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${detailRow('Event', safeTitle)}
      ${detailRow('Was scheduled', escapeHtml(formatDate(opts.scheduledAt)))}
      ${detailRow('Cancelled by', safeCancelledBy)}
    </table>`;
    const html = baseLayout(`❌ Cancelled: ${safeTitle}`, '#DE350B', body, 'This schedule has been cancelled by ' + safeCancelledBy + '.');
    sendEmail({
        to: opts.to,
        subject: `Cancelled: ${opts.title}`,
        html,
    });
}
// ────── Task deadline email ──────
export function sendTaskDeadlineEmail(opts) {
    const safeUserName = escapeHtml(opts.userName);
    const safeTaskTitle = escapeHtml(opts.taskTitle);
    const safeProjectName = escapeHtml(opts.projectName);
    const safeTaskUrl = escapeHtml(opts.taskUrl);
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      Hi ${safeUserName}, your task is due in <strong>${escapeHtml(opts.timeUntil)}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${detailRow('Task', safeTaskTitle)}
      ${detailRow('Project', safeProjectName)}
      ${detailRow('Deadline', escapeHtml(formatDate(opts.deadline)))}
    </table>
    <p style="margin:20px 0 0;">
      <a href="${safeTaskUrl}"
         style="display:inline-block;padding:10px 24px;background:#0052CC;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">
        Open Task
      </a>
    </p>`;
    const html = baseLayout(`⚠️ Deadline approaching: ${safeTaskTitle}`, '#FF5630', body, 'You are receiving this because this task is assigned to you.');
    sendEmail({
        to: opts.to,
        subject: `Task deadline approaching: ${opts.taskTitle} is due in ${opts.timeUntil}`,
        html,
    });
}
// ────── Password Reset OTP Email ──────
export function sendPasswordResetOTPEmail(opts) {
    const safeUserName = escapeHtml(opts.userName || 'there');
    const safeOtp = escapeHtml(opts.otp);
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      Hi ${safeUserName},
    </p>
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      We received a request to reset your password. Use the following 6-digit code to complete the reset:
    </p>
    <div style="background:#eceff1;padding:24px;border-radius:8px;text-align:center;margin:24px 0;">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#0052CC;">${safeOtp}</span>
    </div>
    <p style="margin:24px 0 0;color:#6b778c;font-size:13px;line-height:1.5;">
      If you did not request this, please ignore this email or contact support if you have concerns.
    </p>
  `;
    const html = baseLayout('Password Reset Code', '#0052CC', body, 'You received this email because a password reset was requested for your account.');
    sendEmail({
        to: opts.to,
        subject: 'Your Password Reset Code',
        html,
    });
}
// ────── Email Verification ──────
export function sendVerificationEmail(opts) {
    const safeUserName = escapeHtml(opts.userName || 'there');
    const safeUrl = escapeHtml(opts.url);
    const body = `
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      Hi ${safeUserName},
    </p>
    <p style="margin:0 0 16px;color:#172b4d;font-size:15px;">
      Welcome! Please verify your email address to complete your registration. This link will expire shortly.
    </p>
    <p style="margin:20px 0 0;text-align:center;">
      <a href="${safeUrl}"
         style="display:inline-block;padding:12px 28px;background:#0052CC;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
        Verify My Email
      </a>
    </p>
    <p style="margin:24px 0 0;color:#6b778c;font-size:13px;line-height:1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${safeUrl}" style="color:#0052CC;text-decoration:underline;word-break:break-all;">${safeUrl}</a>
    </p>
  `;
    const html = baseLayout('Verify your email address', '#0052CC', body, 'You received this email because you created an account. If you did not request this, please ignore it.');
    sendEmail({
        to: opts.to,
        subject: 'Action Required: Verify your email address',
        html,
    });
}
