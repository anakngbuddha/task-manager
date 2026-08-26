# QA Report — task-manager

**Date:** 2026-08-26
**Scope:** Full-project static analysis (backend, frontend, root scripts) using the graphify knowledge graph (`graphify-out/`) plus manual code review and compiler checks.
**Constraint honored:** No source files were modified. This report is the only artifact created.

---

## Executive Summary

| Area | Critical | High | Medium | Low |
|---|---|---|---|---|
| Backend | 0 | 6 | 9 | 6 |
| Frontend | 2 | 3 | 6 | 4 |
| **Total** | **2** | **9** | **15** | **10** |

**Compiler status:** `tsc --noEmit` passes cleanly on both `backend/` and `frontend/` (the historical errors recorded in `frontend/errors.txt` appear fixed). The bugs below are logic, security, concurrency, and design defects that the compiler cannot catch.

---

## 🔴 Critical

### C1. Broken regex in analytics DOM path builder — `frontend/src/hooks/useAnalytics.ts` (~L100)
The class-splitting regex is double-escaped inside a regex literal, so it splits on the literal string `\s+` instead of whitespace:
```js
nodeName += '.' + el.className.trim().split(/\\s+/).join('.');
```
Every multi-class element becomes one giant class token (`a.btn.primary`), producing wrong analytics selectors for all tracked events.

### C2. 401 handler causes redirect loops / spurious logouts — `frontend/src/lib/api.ts` (L60–73)
Any 401 from any endpoint — including transient backend cold-starts or background polls like `useNotifications` (every 10s) and non-admin calls to `/admin/users/online` — hard-navigates via `window.location.href = '/login'`, destroying app state with no retry/backoff.

---

## 🟠 High Severity

### Backend

**H1. Race condition in invite acceptance (double-spend of single-use invites)** — `backend/src/routes/invites.ts` (~L108–135)
The `acceptedById` check and update are two separate non-atomic operations; two concurrent redemptions both pass the check and both users become members. Fix: conditional `updateMany({ where: { id, acceptedById: null } })`.

**H2. Task assignee never validated against project membership** — `backend/src/routes/tasks.ts` (~L296–305)
`assigneeId` accepts any string; assigning an arbitrary or cross-project user either succeeds (integrity violation) or surfaces as a generic 500 FK error.

**H3. Chat history sends the *oldest* 30 messages, not the latest** — `backend/src/routes/chat.ts` (~L1180)
```ts
orderBy: { createdAt: 'asc' }, take: 30
```
Once a session exceeds 30 messages, the model loses all recent context. Should be `desc` + reverse.

**H4. IDOR on file upload `parentId`** — `backend/src/routes/files.routes.ts` (~L99–120, also ~L60–75)
`projectId` membership is checked but `parentId` from form fields is used verbatim — a member of project A can nest files under another project's/user's folders.

**H5. `assign-all` exposes all members' private GitHub repos to the project** — `backend/src/routes/github.ts` (~L361–405)
A PROJECT_MANAGER can attach every repo installed by *any* member (including unrelated personal repos) to their project.

**H6. SVG uploads allowed — stored XSS vector** — `backend/src/routes/upload.ts` (L9–21), `files.routes.ts` (L22–33)
`image/svg+xml` is in `ALLOWED_MIME_TYPES`; SVGs can contain `<script>` and are served back unsanitized.

### Frontend

**H7. Unbounded 2.5s polling** — `frontend/src/hooks/useGithub.ts` (L76–96)
`useGithubPendingInstallation` polls 2 endpoints every 2.5 s indefinitely while enabled — no timeout/max attempts (~48 req/min per open tab).

**H8. Fragile cascading state sync in ProjectPage** — `frontend/src/pages/ProjectPage.tsx` (L87–107)
First effect maps tasks→hours using `timeReport?.byTask` but its deps are only `[tasks]`; patched by a second effect keyed on `taskTimeTotalHours`. Works only by accident of effect ordering; risk of double `setLocalTasks`.

**H9. Terminal/chat providers remount on every navigation** — `frontend/src/App.tsx` (L66–100)
Each route wraps its own `<ProtectedRoute>` → fresh `<TerminalProvider>`, `<GlobalTerminal>`, `<ChatWidget>` per route element, tearing down sockets and context state on every navigation.

---

## 🟡 Medium Severity

### Backend

| # | Finding | Location |
|---|---|---|
| M1 | Redis rate-limit counter can become a permanent block: if crash between `INCR` and `EXPIRE`, key lives forever | `src/app.ts` ~L216–232 |
| M2 | Transient GitHub API failure permanently deletes installation records (destructive action on network blip) | `src/routes/github.ts` ~L141–160 |
| M3 | Webhook handler errors swallowed → returns 200, dedup already recorded → GitHub never retries lost events | `src/routes/webhooks/github.ts` ~L60–76 |
| M4 | Unbounded parent-chain walk in cycle detection — hangs event loop on corrupt/cyclic data (no visited-set/depth cap) | `src/routes/tasks.ts` ~L110–125, ~L682–697 |
| M5 | Webhook actor attribution fabricates activity authors: unassigned PR events credited to a random first-found member | `src/routes/webhooks/github.ts` ~L320–330, ~L610 |
| M6 | Open CORS proxy (`*` origin/headers) blindly relays Gemini traffic incl. API keys — free relay abuse + key probing | `gemini-proxy-worker.js` L17–40 |
| M7 | Inconsistent CORS headers between `injectCORSHeaders` and `@fastify/cors` registration (`set-cookie`, unconditional credentials) | `src/app.ts` ~L57–64 vs ~L140–152 |
| M8 | `toNodeHandler(auth)` constructed inside the `onRequest` hook on every auth request instead of hoisted once | `src/app.ts` ~L268 |
| M9 | Timezone inconsistency: admin "today" metrics & hourly histograms use server-local time vs UTC epoch math elsewhere | `src/routes/admin.routes.ts` ~L191, `adminUserAnalytics.ts` ~L90 |

### Frontend

| # | Finding | Location |
|---|---|---|
| M10 | Offline optimistic ID mismatch: `offline_${Date.now()}` generated twice — returned ID never matches cached optimistic row, follow-up updates silently no-op | `src/hooks/useTasks.ts` L30–45 |
| M11 | Socket double-connect churn in dev/StrictMode; brief event loss during session-load race | `src/hooks/useTaskSync.ts` L20–26, L90–95 |
| M12 | Non-admins unconditionally call admin-only `/admin/users/online` → 403 every mount → triggers C2 full-page redirect | `src/hooks/useOnlineUsers.ts` L17–55 |
| M13 | `dangerouslySetInnerHTML` with `html: true` in table lines — injection point if any caller builds table HTML from unsanitized server data | `src/components/terminal/TerminalOutput.tsx` L76, L90 |
| M14 | 3-second full-message-list polling despite existing Socket.IO layer — wasteful, flickers optimistic messages | `src/hooks/useProjectMessages.ts` L12 |
| M15 | Idempotency-Key stamped on *every* POST including login/analytics — retried auth/analytics POSTs could be deduped unexpectedly | `src/lib/api.ts` L14–23 |

---

## 🟢 Low Severity

### Backend

| # | Finding | Location |
|---|---|---|
| L1 | 403-vs-404 distinction leaks task-ID existence to non-members (full row fetched before role check); same pattern in tags/timeLogs/comments | `src/routes/tasks.ts` ~L146–163 |
| L2 | Typo'd/dead code: `purgExpiredChatMessages`; unused `popPendingInstallation` after polling endpoint disabled | `src/jobs/notificationCron.ts` ~L37, `src/lib/pendingInstallations.ts` |
| L3 | No SIGTERM/SIGINT graceful shutdown — Prisma, Redis, Socket.IO, cron jobs cut hard on deploy | `src/index.ts` |
| L4 | Check-then-update race in `markRead` (benign; should be one conditional `updateMany`) | `src/services/notification.service.ts` ~L39–48 |
| L5 | Mention regex `@(\w+)` matches email substrings ("@gmail") — spurious mention notifications | `src/routes/projectMessages.ts` ~L100–115 |
| L6 | `FEATURE_AI_TESTER` defaults to **enabled** when unset — knowledge slash-command endpoints on by default in prod | `src/config/env.ts` ~L96–101 |

### Frontend

| # | Finding | Location |
|---|---|---|
| L7 | No Vite dev proxy — dev relies on direct CORS-with-credentials to `localhost:3000` | `vite.config.ts` |
| L8 | Index-keyed editable rows in rule builder — deleting/reordering conditions binds input state to wrong row | `RuleBuilderModal.tsx` L270 (also CalendarPage L716, AdminAnalyticsPage L860) |
| L9 | Dead Bearer-token path reading `localStorage['__better-auth-session']` — better-auth uses cookies; fragile/dead code | `src/hooks/useAnalytics.ts` L15–27 |
| L10 | Cache purge before render not awaited — stale chunk could execute before deletion completes | `src/main.tsx` L9–25 |

---

## ✅ Verified Clean

- **TypeScript:** `tsc --noEmit` passes on both backend and frontend; all errors previously logged in `frontend/errors.txt` are resolved.
- **SQL injection:** none found — the sole `$queryRaw` usage (`activity.service.ts` ~L60) uses tagged-template parameters correctly.
- **Secrets:** no hardcoded secrets found (seed credentials removed per audit note in `seed-admin.ts`).
- **Socket cleanup:** `useTaskSync` and `usePresenceTracking` correctly remove listeners/disconnect.
- **PWA config:** workbox `NetworkOnly` for `/api/` with correct denylist.
- **XSS in terminal JSON output:** strings properly escaped.

## Top Remediation Priorities

1. **C2 / M12** — Replace blanket 401 redirect with per-request handling + retry/backoff; gate admin calls by role.
2. **H1** — Make invite acceptance atomic (`updateMany` with `acceptedById: null` guard).
3. **H3** — Flip chat history ordering to fetch latest messages.
4. **H4/H5/H6** — Validate `parentId` ownership, scope repo assignment, sanitize/deny SVG uploads.
5. **M2/M3** — Stop deleting installations on transient errors; return 500 on webhook processing failure so GitHub retries.
