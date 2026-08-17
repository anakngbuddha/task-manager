# Graph Report - task-manager  (2026-08-17)

## Corpus Check
- 286 files · ~181,927 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1598 nodes · 4009 edges · 116 communities (72 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- package.json
- AdminAnalyticsPage.tsx
- scripts
- ErrorBoundary
- AdminIssuesPage.tsx
- AdminDocumentationPage.tsx
- writeTasks.ts
- Consent System Architecture
- tsconfig.json
- watch-rag.ts
- React + TypeScript + Vite
- backfill-knowledge-names.ts
- delete-chat-messages.ts
- delete_chat_messages.ts
- cleanup-duplicate-tasks.ts
- vercel.json
- cloudinary
- dotenv
- @fastify/jwt
- @fastify/rate-limit
- @fastify/websocket
- jsonwebtoken
- @pinecone-database/pinecone
- prisma
- @prisma/client
- socket.io
- streamifier
- zod
- test-email2.mjs
- browser-image-compression
- clsx
- @dagrejs/dagre
- @dnd-kit/sortable
- emoji-picker-react
- framer-motion
- @hookform/resolvers
- idb
- leaflet
- radix-ui
- react
- react-dom
- react-hook-form
- react-leaflet
- react-markdown
- react-router-dom
- socket.io-client
- tailwind-merge
- @tanstack/react-query
- tw-animate-css
- @types/leaflet
- vite-plugin-pwa
- @xyflow/react
- { signIn, signOut, signUp, useSession }

## God Nodes (most connected - your core abstractions)
1. `cn()` - 80 edges
2. `api` - 63 edges
3. `Button` - 48 edges
4. `authenticate()` - 41 edges
5. `requireProjectRole()` - 33 edges
6. `Badge()` - 31 edges
7. `VirtualFileSystem` - 30 edges
8. `useProject()` - 29 edges
9. `Input()` - 28 edges
10. `idempotencyPreHandler()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `createProfileWriteHandlers()` --indirect_call--> `projectRoutes()`  [INFERRED]
  frontend/src/lib/vfs/commands/writeProfile.ts → backend/src/routes/projects.ts
- `activityRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/activity.ts → backend/src/middlewares/authenticate.ts
- `automationRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/automations.ts → backend/src/middlewares/authenticate.ts
- `chatRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/chat.ts → backend/src/middlewares/authenticate.ts
- `fileRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/files.routes.ts → backend/src/middlewares/authenticate.ts

## Import Cycles
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/sprints.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/sprints.ts -> backend/src/services/automation.engine.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/admin.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/auditLogs.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/automations.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/files.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/invites.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/projects.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/schedules.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/schedules.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tags.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tasks.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tasks.ts -> backend/src/services/automation.engine.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/upload.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/admin.routes.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminIssues.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminKnowledge.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminUserAnalytics.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/analytics.routes.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`

## Communities (116 total, 44 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (69): main(), parseCorrections(), prisma, Env, envSchema, nonEmpty, parsed, isAiTesterFeatureEnabled() (+61 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (63): CreateTaskDialogProps, columnLabels, columnTextColor, columnTopBorder, getTagColor(), TAG_COLORS, TagInput(), TagInputProps (+55 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (48): app, start(), checkScheduleReminders(), checkTaskDeadlineReminders(), processScheduleWindow(), processTaskWindow(), purgExpiredChatMessages(), startNotificationCron() (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (42): LocationMap(), formatDateTime(), localDateTimeToISO(), PendingCalendarWidget(), PendingScheduleItem, scheduleTypeBadgeClass(), scheduleTypeLabel(), toLocalDateInputValue() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (25): MetricCardProps, ProjectCompletionChartProps, ProjectData, STATUS_COLORS, TasksByStatusChartProps, Card, CardAction, CardContent (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): AI Fallback Keys (Optional), BETTER_AUTH_SECRET, BETTER_AUTH_URL, BREVO_API_KEY, CEREBRAS_API_KEY, CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET, Cloudinary (Optional -- for file uploads), DATABASE_URL (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (30): deriveRole(), EffectiveRole, GlobalTerminal(), IMPORTANT: Only update when the ROUTE changes — not when the terminal, TerminalInput(), TerminalInputProps, highlight(), JsonLine() (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (29): fetchAutomationFiles(), fetchTaskCommentFiles(), fetchActivityFiles(), fetchMemberFiles(), fetchProfileFiles(), fetchProfileSettings(), fetchProjectFiles(), fetchScheduleFiles() (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (23): TimeLogDetailDialogProps, CreateSprintDialogProps, CreateTaskDialog(), getCurrentStartLocalForInput(), isPastTime(), normalizeStatus(), STATUS_LABELS, InviteMembersDialogProps (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (32): createAppJwt(), PRIVATE_KEY, requireGithubConfig(), verifyWebhookSignature(), addPendingInstallation(), clearExpectingUser(), ExpectingUser, expectingUsers (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (28): ACTION_LABELS, formatRelative(), LogEntry(), Props, ChatWidget(), Message, MessageBubble(), QUICK_PROMPTS (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (27): DateDivider(), EmptyState(), formatFullTime(), formatRelativeTime(), getDayLabel(), getInitials(), MessageBubble(), MessageBubbleProps (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (20): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSub() (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (23): createAutomationHandlers(), extractEntityId(), resolveAutomationId(), VALID_ACTIONS, VALID_TRIGGERS, WRITE_ROLES, ADMIN_OR_PM, ANY_MEMBER (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (28): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (16): authBuckets, authLimits, Bucket, injectCORSHeaders(), ALLOWED_ORIGINS, auth, globalForPrisma, adminRoutes() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (19): directRoom(), getIO(), listSchema, notificationRoutes(), createDirectMessageSchema, projectDirectMessageRoutes(), createMessageSchema, projectMessageRoutes() (+11 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (20): CompleteSprintDialogProps, BurndownChartWidget(), formatDayLabel(), VelocityChartWidget(), useProjectMembers(), Sprint, SprintBurndownPoint, SprintBurndownResponse (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (23): DependencyDiagramLayout, useDependencyDiagramLayout(), useResetDependencyDiagramLayout(), useSaveDependencyDiagramLayout(), applySubtaskOffsets(), AssigneeFilter(), buildRawGraph(), computeDagreLayout() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (13): activityRoutes(), listSchema, readReceiptRoutes(), createCommentSchema, requireTaskMembership(), taskCommentRoutes(), timeLogRoutes(), ActivityCreateInput (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (21): auditLogRoutes(), csvEscape(), toDateOrUndefined(), actionSchema, automationRoutes(), conditionSchema, createRuleSchema, updateRuleSchema (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (14): AdminRoute(), PresenceWrapper(), KANBAN_COLS, PWAUpdatePrompt(), usePresenceTracking(), isSystemAdmin(), postLoginPath(), queryClient (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (17): DONE_STATUSES, Select(), SelectContent(), SelectGroup(), SelectItem(), SelectTrigger(), SelectValue(), GithubActivityEvent (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (16): generateCode(), inviteRoutes(), createProjectSchema, projectRoutes(), updateRoleSchema, dashboardLayoutService, DashboardWidgetConfig, DashboardWidgetType (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (23): dependencies, better-auth, fastify, @fastify/cors, @fastify/multipart, @fastify/redis, @fastify/static, googleapis (+15 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (15): TerminalPanelProps, checkAdmin(), createAdminHandlers(), escapeHtml(), ADMIN_ONLY, WRITE_ROLES, ANY_MEMBER, createSprintWriteHandlers() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+14 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (17): DEFAULT_BOARD_COLUMNS, DONE_STATUSES, assignTasksSchema, completeSprintSchema, createSprintSchema, startSprintSchema, updateSprintSchema, createTaskSchema (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (18): ContributionHeatmap(), dateKeyUTC(), intensityClass(), monthLabel(), startOfDayUTC(), useAssignProjectRepo(), useDisconnectGithub(), useGithubAvailableRepos() (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (14): statusDot, statusLabels, TaskStatsWidget(), PageHeader(), useProject(), useUpdateProject(), useProjectActivity(), useTasks() (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (16): formatDuration(), OnlineUser, OnlineUserStatus, useOnlineUsers(), socket, SOCKET_OPTIONS, SOCKET_URL, AdminUserDetailPage() (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (21): axios, class-variance-authority, @dnd-kit/core, @dnd-kit/utilities, @fontsource-variable/geist, dependencies, axios, better-auth (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (21): devDependencies, concurrently, nodemon, ts-node, tsx, @types/node, @types/node-cron, @types/nodemailer (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (14): TimeSummaryWidget(), clamp(), getInitials(), statusColors, WorkloadSummaryWidget(), Badge(), badgeVariants, TimeLog (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (17): formatActivityType(), RecentActivityWidget(), useActivity(), useProjectActivity(), ActivityEvent, ActivityPage(), EVENT_CONFIG, EventConfig (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (9): CommandRegistry, ALL_COMMANDS, buildLsTable(), createNavigationHandlers(), escapeHtml(), HELP_TEXT, createMemberWriteHandlers(), createProfileWriteHandlers() (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (14): getInstallationToken(), authenticate(), AuthUser, fastify, FastifyRequest, normalizeTagName(), tagRoutes(), findInstallationTokenForRepo() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.16
Nodes (14): DashboardTerminal(), OfflineToastContext, OfflineToastContextValue, OfflineToastProvider(), Toast, ToastType, useOfflineToast(), ProjectsDashboardProject (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (14): Sidebar(), STATUS_ORDER, ConversationSidebar(), ConversationSidebarProps, DirectConversation, DropdownMenuLabel(), useMarkAllNotificationsRead(), useMarkNotificationRead() (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+9 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (10): ProjectData, ProjectListCardProps, Button, buttonVariants, useAcceptInvite(), useInvite(), KnowledgeEntry, KnowledgeUser (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.26
Nodes (12): stableStringify(), idempotencyPreHandler(), ALLOWED_MIME_TYPES, fileRoutes(), acquireIdempotency(), AcquireIdempotencyResult, attachIdempotencyContext(), completeIdempotencyFromPayload() (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.24
Nodes (12): AnalyticsWrapper(), CookieBanner(), CookiePreferences(), trackEvent(), useAnalytics(), ConsentChoices, getConsent(), getCookieValue() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (11): AnalyticsEventType, initSessionTracking(), trackEvent(), TrackOptions, api, BACKEND_ORIGIN, ADMIN_OR_PM, createProjectWriteHandlers() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (10): formatDurationMinutes(), formatUserLogTime(), prettyFieldName(), renderMetadataFallback(), renderNonTimeLogDetails(), renderTimeLogDetails(), replaceUnderscores(), TimeLogDetailDialog() (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.27
Nodes (9): MapModal(), buildNominatimViewbox(), distanceKm(), formatDistanceKm(), NOMINATIM_HEADERS, NominatimResult, reverseNominatim(), searchNominatim() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.23
Nodes (9): OfflineBanner(), useOnlineStatus(), flushOfflineQueue(), FlushResult, QueueMutationArgs, queueOrRunMutation(), MutationRecord, offlineStore (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (12): ⚡ Automations, 📅 Calendar & Schedules, Complete Application Feature Guide, 📁 Files, 🔗 GitHub Integration, 👥 Members & Invitations, 💬 Messages, 👤 Profile & Settings (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.21
Nodes (10): AuditLogAction, AuditLogEntityType, AuditLogFilters, AuditLogItem, AuditLogListResponse, useAuditLogExport(), useAuditLogs(), ACTIONS (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.20
Nodes (10): ACTION_TYPES, ActionForm, CONDITION_FIELDS, FormData, PRIORITIES, Props, RECIPIENTS, RuleBuilderModal() (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (5): typeToTitle, DASHBOARD_WIDGET_TYPES, DashboardLayoutResponse, DashboardWidgetConfig, DashboardWidgetType

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, main, name, type, version

### Community 54 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 55 - "AdminAnalyticsPage.tsx"
Cohesion: 0.28
Nodes (8): AdminAnalyticsPage(), AnalyticsAiReport, BaseAnalytics, ExtendedAnalytics, normalizeAiReport(), PRIORITY_COLORS, STATUS_COLORS, toStringArray()

### Community 56 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, db:migrate:deploy, dev, knowledge:migrate, postinstall, rag:ingest, start

### Community 58 - "AdminIssuesPage.tsx"
Cohesion: 0.32
Nodes (7): AdminIssuesPage(), AnalysisFilter, AnalyticsEvent, getIssueTitle(), getSeverity(), IssueAnalysis, severityStyles

### Community 59 - "AdminDocumentationPage.tsx"
Cohesion: 0.43
Nodes (5): ADMIN_DOC_SECTIONS, DocEntry, DocSection, AdminDocumentationPage(), matchesQuery()

### Community 60 - "writeTasks.ts"
Cohesion: 0.48
Nodes (6): createTaskWriteHandlers(), extractEntityId(), norm(), resolveTaskEntityId(), VALID_TASK_TYPES, WRITE_ROLES

### Community 61 - "Consent System Architecture"
Cohesion: 0.33
Nodes (5): 1. Storage & State Management, 2. Consent Utilities, 3. How to Add New Tracking Calls, 4. Policy Versioning, Consent System Architecture

### Community 62 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 64 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **498 isolated node(s):** `name`, `version`, `description`, `main`, `type` (+493 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createProfileWriteHandlers()` connect `Community 36` to `Community 25`, `Community 23`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `projectRoutes()` connect `Community 23` to `Community 36`, `Community 37`, `Community 42`, `Community 15`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `api` connect `Community 44` to `Community 1`, `Community 3`, `Community 4`, `Community 7`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 17`, `Community 18`, `Community 22`, `Community 25`, `Community 29`, `Community 30`, `Community 31`, `Community 34`, `Community 35`, `Community 36`, `Community 38`, `Community 39`, `Community 41`, `Community 43`, `Community 48`, `Community 50`, `Community 51`, `Community 52`, `AdminAnalyticsPage.tsx`, `AdminIssuesPage.tsx`, `writeTasks.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `authenticate()` (e.g. with `activityRoutes()` and `automationRoutes()`) actually correct?**
  _`authenticate()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _498 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.055379746835443035 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05194805194805195 - nodes in this community are weakly interconnected._