# QA Report: task-manager

**Reviewed:** 2026-08-26  
**Repository revision:** `e248841e992cc5112914b8409cf1ccbef0b3773e`  
**Method:** Independent static review of the source and the previous QA report. No source files were changed. Build and runtime claims are separated from what can be proven by static inspection.

## Verdict

The previous report found several real defects, but it was not fully accurate. It assigned critical severity to a low-impact analytics bug, incorrectly connected 403 responses and backend cold starts to a 401 redirect, claimed graceful shutdown was absent even though it exists, and declared the repository free of secrets despite committed debug output and user uploads. It also missed the broadest security issue: private GitHub repository data is shared across project members without owner consent.

## Corrected top risks

### C1. Cross-user private GitHub repository exposure

**Severity: Critical**  
**Locations:** `backend/src/routes/github.ts`, `backend/src/routes/taskGithubLinks.ts`

The GitHub integration treats every project member's installation as project-wide inventory:

- `GET /projects/:projectId/github/available-repos` is available to any project member and enumerates repositories from every member's GitHub installation.
- `findInstallationTokenForRepo()` tries tokens from every project member when resolving a task GitHub link. A member can therefore cause the backend to fetch private PR, issue, branch, or commit metadata through another member's installation.
- `POST /projects/:projectId/github/repos` accepts a global `githubRepository.id` without checking that the repository belongs to the caller or to an installation explicitly shared with the project.
- `assign-all` attaches every active repository from every member installation to the project.

**Fix:** Make installations private to their owner by default. Add an explicit per-repository sharing grant, require owner consent, scope every repository lookup to an authorized installation, and stop cycling through other members' tokens.

### H1. Single-use invite redemption is not atomic

**Severity: High**  
**Location:** `backend/src/routes/invites.ts`

The code reads `acceptedById`, adds a member, then updates the invite in separate operations. Concurrent requests can redeem the same invite for different users.

**Fix:** Use a transaction and atomically claim the invite with `updateMany({ where: { id, acceptedById: null, expiresAt: { gt: now } } })`. Only add the member if the claim count is one.

### H2. Task assignees are not validated against project membership

**Severity: High**  
**Location:** `backend/src/routes/tasks.ts`

Create and update accept arbitrary `assigneeId` values. This permits cross-project assignments or generic foreign-key failures.

**Fix:** Before create/update, require a matching `projectMember` row for the target project, except for the explicit unassigned/everyone case.

### H3. File and folder parent scope is not validated

**Severity: High**  
**Location:** `backend/src/routes/files.routes.ts`

Both folder creation and upload accept `parentId` after checking only the supplied `projectId`. The parent can belong to another project or another user's personal tree.

**Fix:** Load the parent and require the same `projectId`, or the same personal owner when `projectId` is null. Also require `type === 'FOLDER'`.

### H4. SVG uploads can become stored script content

**Severity: High**  
**Locations:** `backend/src/routes/upload.ts`, `backend/src/routes/files.routes.ts`

`image/svg+xml` is allowed and uploaded without application-level sanitization. Direct navigation to a hosted SVG can execute active content depending on delivery headers and transformation settings.

**Fix:** Reject SVG, or sanitize it with a proven SVG sanitizer and force safe download/content-disposition headers. Do not trust the client MIME header alone.

### H5. Webhook deduplication records success before processing succeeds

**Severity: High**  
**Location:** `backend/src/routes/webhooks/github.ts`

The delivery ID is inserted before event handling. Handler errors are caught and a 200 is returned, so GitHub will not retry and a retry would be rejected as a duplicate anyway.

**Fix:** Track processing state, mark complete only after success, and return 5xx on processing failure.

### H6. Sensitive and generated artifacts are committed

**Severity: High**  
**Locations:** `backend/email-debug.log`, `backend/uploads/`, `backend/node_modules/`, `backend/dist/`, `backend/tsconfig.tsbuildinfo`

The repository tracks files that the root `.gitignore` already excludes. `email-debug.log` exposes a Brevo-style API key prefix, sender email, and a local workstation path. `backend/uploads/` contains committed PNG, XLSX, and DOCX files that may contain user data.

**Fix:** Rotate the affected email credential as a precaution, inspect the uploaded documents for personal data, remove generated/user files from Git history, then run `git rm -r --cached` for ignored artifacts. Add secret scanning in CI.

## Confirmed functional and reliability defects

### M1. Chat APIs return the oldest messages instead of the newest

**Severity: Medium**  
**Location:** `backend/src/routes/chat.ts`

This affects both AI context and the session message API:

- AI context uses `orderBy: { createdAt: 'asc' }, take: 30`.
- `GET /chat/sessions/:sessionId/messages` uses ascending order with `take`, so a limited request returns the oldest records.

Fetch descending, take the limit, then reverse before returning or sending to the model.

### M2. Blanket 401 navigation is disruptive, but the previous explanation was wrong

**Severity: Medium**  
**Location:** `frontend/src/lib/api.ts`

Any actual 401 outside auth pages hard-navigates to `/login`, which can discard UI state. However, a backend cold start normally produces latency/network/5xx behavior, not 401, and `/admin/users/online` returns 403 for non-admins, which does not trigger this redirect.

Use a centralized session-expired flow, exclude public/background requests, preserve the intended route, and avoid hard navigation unless the session is confirmed invalid.

### M3. Non-admin clients call an admin-only presence endpoint

**Severity: Medium**  
**Locations:** `frontend/src/hooks/useOnlineUsers.ts`, `backend/src/routes/adminUserAnalytics.ts`

The hook calls `/admin/users/online` whenever enabled. Non-admins receive 403 and log noise. This does not trigger the 401 redirect described by the old report.

Gate the query by role or expose a separate project-scoped presence endpoint.

### M4. GitHub installation polling is unbounded while enabled

**Severity: Medium**  
**Location:** `frontend/src/hooks/useGithub.ts`

The pending-installation query polls every 2.5 seconds without a maximum duration. Both backend discovery endpoints currently return 204, making the polling especially wasteful.

Stop polling after a bounded timeout or after the callback state is resolved.

### M5. Route-level providers remount during navigation

**Severity: Medium**  
**Location:** `frontend/src/App.tsx`

Every protected route creates a new `TerminalProvider`, `GlobalTerminal`, and `ChatWidget`. Navigation between protected routes tears down and recreates that state.

Use one protected layout route and mount shared providers once around an `<Outlet />`.

### M6. Offline task creation generates two different optimistic IDs

**Severity: Medium**  
**Location:** `frontend/src/hooks/useTasks.ts`

`offline_${Date.now()}` is generated once for the cached row and again for the returned result. Follow-up operations can target an ID that is not in cache.

Generate one ID before queueing and reuse it everywhere.

### M7. Project message polling duplicates the socket layer

**Severity: Medium**  
**Location:** `frontend/src/hooks/useProjectMessages.ts`

The full message list refetches every three seconds despite Socket.IO delivery, increasing load and causing optimistic-row churn.

Use socket events for updates and a slower reconciliation fetch only on reconnect/focus.

### M8. Auth Redis rate-limit TTL setup is not atomic

**Severity: Medium**  
**Location:** `backend/src/app.ts`

`INCR` and `EXPIRE` are separate calls. A crash between them can leave a counter without expiry.

Use a Lua script, transaction, or `SET`/`INCR` pattern that creates the counter and TTL atomically.

### M9. Socket project events are not authorized per emission

**Severity: Medium**  
**Location:** `backend/src/index.ts`

`join:project` checks membership, but `typing:project` and `read:project` emit to any caller-supplied room without confirming membership. Socket.IO can emit to a room even when the sender never joined it.

Validate project membership for each event or track authorized joined projects in socket state.

## Lower-severity corrections and findings

### L1. Analytics DOM-path regex is broken, but it is not critical

**Severity: Low**  
**Location:** `frontend/src/hooks/useAnalytics.ts`

`split(/\\s+/)` matches a literal backslash plus `s` characters, not whitespace. Multi-class selectors are malformed. The previous report's code diagnosis was right, but critical severity was not credible because the impact is analytics quality, not availability, integrity, or security.

Use `split(/\s+/)`.

### L2. Project page state synchronization is fragile

**Severity: Low**  
**Location:** `frontend/src/pages/ProjectPage.tsx`

One effect maps `tasks` with `timeReport` but depends only on `tasks`; a second effect patches totals later. Combine this into one memo/effect with complete dependencies.

### L3. Arbitrary user presence lookup

**Severity: Low**  
**Location:** `backend/src/routes/users.ts`

Any authenticated user can request status and `lastSeenAt` for arbitrary user IDs. Scope lookups to shared projects or remove `lastSeenAt` for unrelated users.

### L4. Global analytics listeners are installed at module scope

**Severity: Low**  
**Location:** `frontend/src/hooks/useAnalytics.ts`

Click, error, rejection, and load listeners are added when the module evaluates and are never removed. Hot reload or unusual multi-bundle loading can duplicate telemetry. Register them inside an effect with cleanup.

## Corrections to the previous report

- **Original C1:** Real regex bug, wrong severity. Reclassified from Critical to Low.
- **Original C2:** The hard redirect exists, but the stated cold-start and 403 causes are incorrect. Reclassified from Critical to Medium.
- **Original M12:** The non-admin request is real, but it returns 403 and therefore does not activate the 401 handler.
- **Original L3:** False. `backend/src/index.ts` already handles SIGTERM and SIGINT, closes Socket.IO/Fastify, disconnects Prisma, and has a hard timeout.
- **Original "Secrets: verified clean":** False. Committed debug output contains credential material and personal/operational data, and committed uploads require review.
- **Original compiler claim:** Not reproducible from repository automation. There is no root CI workflow and neither package defines a test script. A local compiler pass may have occurred, but the repository does not prove or continuously enforce it.
- **Original M13 terminal XSS:** The sink is real (`dangerouslySetInnerHTML`), but exploitability was not demonstrated in the previous report. Keep it as a hardening item until every table producer is traced and escaped.

## QA process gaps missed by the previous report

- No automated test framework or `test` script in either package.
- No repository CI workflow for build, type-check, lint, tests, dependency review, or secret scanning.
- Frontend has an ESLint config but no lint script in `package.json`.
- Generated dependencies and build outputs are tracked, making searches noisy and reviews unreliable.
- The report claimed compiler success without recording commands, versions, output, or a commit-scoped CI run.

## Remediation order

1. Isolate GitHub installations and repositories by owner; add explicit sharing grants.
2. Remove sensitive/generated files from Git and history, inspect committed uploads, and rotate the exposed email credential.
3. Fix invite atomicity, file parent authorization, assignee membership validation, and webhook retry semantics.
4. Reject or sanitize SVG uploads.
5. Fix chat ordering, socket event authorization, and 401 handling.
6. Add CI with clean installs, type-check, lint, unit/integration tests, dependency audit, and secret scanning.

## Validation required after fixes

Run from a clean checkout with no committed `node_modules` or `dist` directories:

```bash
cd backend
npm ci
npm run build

cd ../frontend
npm ci
npm run build
```

Then add and run automated tests covering concurrent invite redemption, cross-project assignees/parents, private GitHub installation isolation, webhook retry behavior, latest-message pagination, SVG rejection, and unauthorized socket events.
