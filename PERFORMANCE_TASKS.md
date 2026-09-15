# Performance Optimization Tasks

**Created:** 2026-09-15  
**Branch:** `perf/optimization-pass`  
**Base revision:** `f9173993be50210de778e500ea4cf77cb59a7556`  
**Scope:** front-end delivery cost, API payload size, DB query shape, plus the automated verification this repo did not previously have.

---

## How the original wishlist was triaged

The requested list was audited against the actual source before any code was written. Several items were already satisfied by the existing toolchain, and implementing them again would have been busywork.

| Requested item | Verdict | Reason |
| --- | --- | --- |
| Lazy loading | **Implemented (T1)** | `App.tsx` statically imported all 35 page components. Highest-impact change in the repo. |
| Pagination of high-stored tables | **Implemented (T7, T8)** | `GET /projects/:id/tasks` returned every task in a project with 6 nested relations and no limit. |
| Remove unused dependencies | **Implemented (T5)** | `shadcn` (a CLI) was a production dependency; two more were misclassified. |
| Debounce of input handlers | **Implemented (T9)** | No debounce utility existed anywhere in the codebase. |
| Index database | **Partially implemented (T10)** | The schema was already well indexed. Only *composite* indexes matching real query shapes were missing. Single-column FK indexes already exist implicitly under InnoDB. |
| Loading skeletons | **Implemented (T3)** | Zero measurable perf gain, real perceived-performance gain. Doubles as the `Suspense` fallback for T1. |
| Caching of frequently used API | **Already done, tuned (T11)** | TanStack Query is configured with `staleTime: 60s`. The real defect was `useProjectMessages` polling every 3s on top of Socket.IO. |
| Multiple lazy query | **Covered by T1 + T7** | Route-level splitting plus opt-in cursor paging is the concrete form of this. |
| Minify JS and CSS | **No action needed** | Vite minifies both in production builds by default (esbuild for JS, Lightning CSS/esbuild for CSS). Adding a minifier would be a no-op. |
| Defer non-critical scripts | **No action needed** | `index.html` ships a single `<script type="module">`, which is deferred by specification. There are no blocking scripts to defer. |

---

## Phase 1: bundle size and route splitting

### T1. Code-split every route component

**Status:** done  
**File:** `frontend/src/App.tsx`

**Problem.** All 35 page modules were imported statically at the top of `App.tsx`. Because they sit in one module graph, a visitor landing on `/login` downloaded and parsed:

- `ProjectDependencyDiagramPage.tsx` (50 KB source) plus `@xyflow/react` and `@dagrejs/dagre`
- `CalendarPage.tsx` (45 KB) and `DayViewPage.tsx` (38 KB) plus `leaflet` / `react-leaflet`
- `recharts` via the admin analytics pages
- `emoji-picker-react`, `react-markdown`, and the whole `pages/admin` tree

None of that is reachable from the login screen.

**Change.** Convert all route components to `React.lazy(() => import(...))`. `LandingPage` stays eager because `/` is the public entry point and an extra round trip there would directly regress LCP. `GlobalTerminal` and `ChatWidget` are also lazied, with a `null` fallback since they are overlays.

**Acceptance criteria.**
- `npm run build` emits one JS chunk per lazy route rather than a single monolithic bundle.
- Navigating to `/login` in a cold browser session downloads no diagram, chart, or map code.
- Every route present before the change still resolves to the same component.

---

### T2. Mount shared providers once instead of per route

**Status:** done  
**File:** `frontend/src/App.tsx`

**Problem.** Each of the 22 protected routes rendered its own `<ProtectedRoute>` wrapper, which created a fresh `TerminalProvider`, `GlobalTerminal`, and `ChatWidget`. Navigating between two protected routes tore down and recreated that state, discarding open terminal and chat state on every hop. This is finding **M5** in `QA_REPORT.md`.

**Change.** Replace `ProtectedRoute`/`AdminRoute` with `ProtectedLayout`/`AdminLayout` layout routes that render `<Outlet />`. Providers now mount once for the whole protected subtree.

**Acceptance criteria.**
- Navigating `/dashboard` to `/calendar` and back does not remount `TerminalProvider`.
- Auth and admin authorization redirects behave exactly as before.
- Fixes QA_REPORT M5.

---

### T3. Loading skeletons as the suspense fallback

**Status:** done  
**Files:** `frontend/src/components/ui/skeleton.tsx`, `frontend/src/components/ui/RouteFallback.tsx`

**Problem.** Route transitions and session checks rendered a bare `<p>Loading...</p>`, which reads as a broken page.

**Change.** Add a `Skeleton` primitive plus a `RouteFallback` that renders a page-shaped placeholder (header bar, stat row, content rows). The `Suspense` boundary lives *inside* the layout and wraps only `<Outlet />`, so the sidebar and providers stay mounted while the next chunk loads.

**Acceptance criteria.**
- No route transition shows a blank white page.
- The fallback never replaces already-rendered chrome.

---

### T4. Split heavy vendors into named chunks

**Status:** done  
**File:** `frontend/vite.config.ts`

**Problem.** With a single vendor graph, code splitting at the route level still pulls shared vendor code into a common chunk that every entry loads.

**Change.** Add `build.rollupOptions.output.manualChunks` grouping `@xyflow`+`dagre`, `recharts`+`d3`, `leaflet`, `framer-motion`, `emoji-picker-react`, the `react-markdown` unified stack, `socket.io`, `radix-ui`, `react-router`, and React core into separate chunks. Set `chunkSizeWarningLimit` to 900 KB so genuine regressions still warn.

**Acceptance criteria.**
- `dist/assets` contains distinctly named `vendor-*` chunks.
- The diagram, chart, and map vendor chunks are requested only when their route is visited.

---

## Phase 2: dependency hygiene

### T5. Fix misclassified and unused dependencies

**Status:** done  
**File:** `frontend/package.json`

| Package | Action | Reason |
| --- | --- | --- |
| `shadcn` | **removed** | A scaffolding CLI. Never imported by application code, and it was listed as a production dependency. |
| `@types/leaflet` | moved to `devDependencies` | Type-only package. |
| `vite-plugin-pwa` | moved to `devDependencies` | Build-time only, imported solely by `vite.config.ts`. |
| `leaflet`, `react-leaflet` | **kept** | Genuinely used by `components/calendar/MapModal.tsx`, `LocationMap.tsx`, and `LocationPicker.tsx`. They are now isolated in a lazy vendor chunk instead (T4). |

**Acceptance criteria.**
- A production install no longer pulls the `shadcn` CLI or Leaflet typings.
- The build still succeeds and maps still render.

---

### T6. Add typecheck, lint, and verify scripts

**Status:** done  
**Files:** `frontend/package.json`, `backend/package.json`

**Problem.** Neither package defined a `test`, `lint`, or `typecheck` script. The frontend shipped an ESLint config with no way to run it. This is the QA process gap called out in `QA_REPORT.md`.

**Change.** Add `typecheck`, `lint`, and `verify` to both packages, plus `prisma:validate` on the backend.

**Note.** `lint` is deliberately **not** part of the CI gate yet. The repository contains a committed `frontend/errors.txt`, which suggests pre-existing lint or type noise. Turning lint into a required check in the same PR would block it on unrelated debt. Land this, run `npm run lint` locally, fix the backlog, then promote it to a required check.

---

## Phase 3: data layer

### T7. Cursor pagination for project tasks (server)

**Status:** done  
**Files:** `backend/src/services/task.service.ts`, `backend/src/routes/tasks.ts`

**Problem.** `taskService.getAll()` ran an unbounded `findMany` for a project and eagerly included `assignee`, `children`, `parent`, `blockingTasks` (with the full blocked task), `blockedByTasks` (with the full blocking task), and `tags` (with the full tag). A 2,000-task project returns a multi-megabyte JSON payload on every board mount.

**Change.** Add `taskService.getPage(projectId, { limit, cursor })` using keyset pagination ordered by `(createdAt desc, id desc)`, returning `{ items, nextCursor, hasMore }`. The route accepts optional `?limit` and `?cursor`.

**Backwards compatibility is deliberate:** when neither query parameter is present the route still returns the plain array from `getAll()`. No existing front-end caller breaks, and the board can be migrated to paging incrementally.

**Acceptance criteria.**
- `GET /projects/:id/tasks` with no params returns the same array as before.
- `GET /projects/:id/tasks?limit=25` returns an envelope with at most 25 items and a `nextCursor`.
- Following `nextCursor` walks the full set with no duplicates and no gaps.
- `limit` is validated to 1..200 and rejects garbage with a 400.

---

### T8. Do not narrow the existing response shape yet

**Status:** deliberately deferred  
**File:** `backend/src/services/task.service.ts`

The nested includes are wider than the board needs (`assignee: true` returns every user column; dependency includes return whole task rows). Narrowing them to explicit `select` blocks would cut payload size further.

It is **not** done in this PR because it silently changes the response shape, and with no test suite in the repo there is nothing to catch a page that reads a dropped field. `getPage` intentionally reuses the exact same include shape as `getAll` so pagination can be adopted without a behavioral diff.

**Follow-up:** after T12 lands and tests exist, audit every consumer of `useTasks`, then narrow the includes in one commit.

---

### T9. Debounce hook for input handlers

**Status:** done  
**File:** `frontend/src/hooks/useDebounce.ts`

**Problem.** No debounce utility existed. Every filter and search input fires state updates (and in some cases query refetches) on every keystroke.

**Change.** Add `useDebounce(value, delay)` for debounced values and `useDebouncedCallback(fn, delay)` for handlers. Both clean up their timers on unmount, and `useDebouncedCallback` exposes `.cancel()` and `.flush()`.

**Adoption is intentionally left to follow-up commits** so this PR does not rewrite unrelated page logic. Priority call sites: the audit log search in `useAuditLogs` (currently keys the query on the raw filter object, so every keystroke is a new cache entry and a new request), members search, and the terminal input.

---

### T10. Composite indexes matching real query shapes

**Status:** done  
**Files:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260915000000_task_perf_indexes/migration.sql`

**Honest assessment.** The schema was already in good shape. Almost every hot path already had an index, and under InnoDB every foreign key column (`sprintId`, `parentId`, `assigneeId`, `projectId`) already carries an implicit single-column index. Blanket "add more indexes" would have been cargo-culting.

Three genuinely missing **composite** indexes on `Task`, each tied to a query the code actually runs:

| Index | Serves |
| --- | --- |
| `(projectId, status)` | Board column grouping and every `DONE_STATUSES` filter. |
| `(projectId, sprintId)` | Sprint backlog and sprint report queries. |
| `(projectId, createdAt)` | The `getPage` keyset ordering from T7. Without it, paging degrades to a filesort over the project. |

The pre-existing `@@index([projectId])` is now a prefix of these and is redundant, but it is left in place: dropping an index is a separate, riskier change that deserves its own migration.

**Acceptance criteria.**
- `npx prisma validate` passes.
- `npx prisma migrate deploy` applies cleanly against an existing database.
- `EXPLAIN` on the paginated task query reports an index scan, not a filesort.

---

### T11. Stop redundant polling on top of Socket.IO

**Status:** done  
**Files:** `frontend/src/hooks/useProjectMessages.ts`, `frontend/src/hooks/useTasks.ts`

**Problem.** `useProjectMessages` refetched the entire message list every **3 seconds** even though the backend already emits `message:project` over Socket.IO on every send. That is 20 full list fetches per minute per open tab, and it caused optimistic-row churn. This is finding **M7** in `QA_REPORT.md`.

**Change.** Socket delivery stays the primary path. The poll drops to a 20s reconciliation interval, with `refetchOnWindowFocus` and `refetchOnReconnect` enabled so a tab that missed events while backgrounded catches up immediately instead of relying on a fast timer.

Also fixes **M6** while in the file: offline task creation generated `offline_${Date.now()}` twice, once for the cached row and once for the returned result, so the two could disagree and follow-up mutations could target an id absent from cache. A single id is now generated before queueing and reused.

**Acceptance criteria.**
- Sending a message still appears for other members effectively instantly.
- Network panel shows roughly 3 message fetches per minute, not 20.
- An offline-created task keeps one stable id.
- Fixes QA_REPORT M6 and M7.

---

## Phase 4: validation and verification testing

### T12. Bundle budget checker

**Status:** done  
**File:** `frontend/scripts/check-bundle-budget.mjs`

A zero-dependency Node script (`node:fs`, `node:zlib` only) run after `vite build`. It parses `dist/index.html` to identify the real entry chunk, then asserts:

1. **`dist/` and `dist/index.html` exist** so a silently failed build cannot pass.
2. **At least 10 JS chunks were emitted.** This is the structural regression test for T1: if someone reverts a `React.lazy` back to a static import, the chunk count collapses and CI fails. This assertion is the point of the script.
3. **Entry chunk gzip is within budget** (default 250 KB).
4. **No single chunk exceeds** the max-chunk budget (default 1200 KB raw).
5. **Total JS is within budget** (default 8 MB raw).

Every budget is overridable by environment variable (`BUDGET_ENTRY_GZIP_KB`, `BUDGET_MAX_CHUNK_KB`, `BUDGET_TOTAL_KB`, `BUDGET_MIN_CHUNKS`). Size budgets are set deliberately loose on first landing: the structural check is the real gate, and the script always prints a full size table so the numbers can be tightened once a real baseline is recorded from CI output.

**Acceptance criteria.**
- Passes on this branch.
- Fails if a lazy route import is converted back to a static import.

---

### T13. CI verification workflow

**Status:** done  
**File:** `.github/workflows/verify.yml`

**Problem.** The repository had **no CI workflow at all**. `QA_REPORT.md` notes that the previous report claimed compiler success without any commit-scoped run to prove it. Nothing enforced that `main` even compiles.

**Change.** A `verify` workflow on every pull request and every push to `main`, with two jobs:

- **backend:** clean install, `prisma validate`, `tsc` build.
- **frontend:** install, `tsc -b` typecheck, `vite build`, bundle budget check.

**Known limitation, called out on purpose:** the frontend job uses `npm install` rather than `npm ci`. T5 edits `package.json` without regenerating `package-lock.json`, and `npm ci` hard-fails when the two disagree. See T14.

**Acceptance criteria.**
- The workflow runs and passes on this PR.
- A type error anywhere in either package fails the PR.

---

### T14. Regenerate the frontend lockfile (requires a local run)

**Status:** **open, needs you**

This cannot be done from a code-editing session because it requires actually resolving the npm registry:

```bash
cd frontend
npm install
git add package-lock.json
git commit -m "chore: regenerate lockfile after dependency cleanup"
```

Then switch the frontend CI job from `npm install` to `npm ci` so builds become reproducible.

---

## Manual validation checklist

Run from a clean checkout.

```bash
# Backend
cd backend
npm ci
npx prisma validate
npm run build

# Frontend
cd ../frontend
npm install
npm run typecheck
npm run build
node scripts/check-bundle-budget.mjs
```

### Functional smoke test

| # | Check | Expected |
| --- | --- | --- |
| 1 | Cold-load `/` with the network panel open | No diagram, chart, or map vendor chunk requested |
| 2 | Cold-load `/login`, then log in | Skeleton appears briefly, dashboard renders, no blank page |
| 3 | Visit `/projects/:id/dependencies` | Diagram vendor chunk loads on demand and the graph renders |
| 4 | Visit `/calendar`, open the map modal | Map vendor chunk loads on demand and tiles render |
| 5 | Navigate `/dashboard` to `/calendar` to `/dashboard` | Terminal and chat widget state survives (T2) |
| 6 | Open a project as a non-member | Still 403, no authorization regression from the layout refactor |
| 7 | Open a project as a plain MEMBER | Can still only change task status; role gates unchanged |
| 8 | Send a project message with two browsers open | Arrives near-instantly via socket, not on a 20s timer |
| 9 | `GET /projects/:id/tasks` | Unchanged plain array response |
| 10 | `GET /projects/:id/tasks?limit=5`, then follow `nextCursor` | Full set walked, no duplicates, no gaps |
| 11 | `GET /projects/:id/tasks?limit=0` and `?limit=9999` | Both rejected with 400 |
| 12 | Go offline, create a task, come back online | One stable id, task syncs once (T11 / QA M6) |

### Measure before and after

The structural checks above prove the change happened. To prove it *helped*, capture the same numbers on `main` and on this branch:

1. Chrome DevTools, Network tab, disable cache, Fast 3G throttling, hard reload `/login`. Record transferred bytes and JS request count.
2. Lighthouse in an incognito window against `/` and `/dashboard`. Record FCP, LCP, and Total Blocking Time.
3. `EXPLAIN` the paginated task query before and after the migration.

Record the results in the PR description. Do not claim a percentage improvement without these numbers.

---

## Explicitly out of scope

This PR is performance only. It does **not** touch the security findings in `QA_REPORT.md`, several of which outrank everything here on severity:

- **C1** cross-user private GitHub repository exposure (critical)
- **H1** non-atomic invite redemption
- **H2** task assignees not validated against project membership
- **H3** file and folder parent scope not validated
- **H4** unsanitized SVG upload
- **H6** committed secrets and artifacts: `backend/email-debug.log` (contains an email API key prefix), `backend/uploads/`, `backend/node_modules/`, `backend/dist/`

**H6 should be handled before this PR is a priority.** A committed credential and committed user uploads are a live exposure, and the tracked `node_modules` and `dist` directories make every code search in this repo unreliable. Fix that first.
