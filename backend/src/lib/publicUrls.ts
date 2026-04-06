/**
 * Absolute URL to the calendar day view with a specific schedule selected.
 * Uses UTC YYYY-MM-DD from scheduledAt (matches notifications in schedules routes).
 */
export function scheduleCalendarUrl(
  frontendBase: string,
  scheduleId: string,
  scheduledAt: Date,
): string {
  const base = frontendBase.replace(/\/+$/, '')
  const dayKey = scheduledAt.toISOString().slice(0, 10)
  const q = new URLSearchParams({ scheduleId })
  return `${base}/calendar/day/${dayKey}?${q.toString()}`
}
