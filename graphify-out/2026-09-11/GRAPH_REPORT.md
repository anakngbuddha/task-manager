# Graph Report - task-manager  (2026-08-17)

## Corpus Check
- 287 files · ~183,156 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1601 nodes · 4014 edges · 128 communities (85 shown, 43 thin omitted)
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
- OfflineToast.tsx
- writeAutomations.ts
- useTaskGithubLinks.ts
- socket.ts
- RecentActivityWidget.tsx
- AuthLayout.tsx
- @fastify/static
- googleapis
- node-cron
- @types/jsonwebtoken
- ua-parser-js
- class-variance-authority

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
- `automationRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/automations.ts → backend/src/middlewares/authenticate.ts
- `chatRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/chat.ts → backend/src/middlewares/authenticate.ts
- `fileRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/files.routes.ts → backend/src/middlewares/authenticate.ts
- `githubRoutes()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/routes/github.ts → backend/src/middlewares/authenticate.ts

## Import Cycles
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tasks.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tasks.ts -> backend/src/services/automation.engine.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/admin.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/auditLogs.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/automations.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/files.routes.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/invites.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/projects.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/schedules.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/sprints.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/tags.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/upload.ts -> backend/src/services/auditLog.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/schedules.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 3-file cycle: `backend/src/app.ts -> backend/src/routes/sprints.ts -> backend/src/services/automation.engine.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/admin.routes.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminIssues.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminKnowledge.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/adminUserAnalytics.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`
- 4-file cycle: `backend/src/app.ts -> backend/src/routes/analytics.routes.ts -> backend/src/lib/auth.ts -> backend/src/services/email.service.ts -> backend/src/app.ts`

## Communities (128 total, 43 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (69): main(), parseCorrections(), prisma, Env, envSchema, nonEmpty, parsed, isAiTesterFeatureEnabled() (+61 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (22): getCurrentStartLocalForInput(), getTodayLocalDateForInput(), isPastTime(), linkStatusBadge, linkTypeIcon, normalizeStatus(), priorityBadge, sanitizeUrl() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (48): app, start(), checkScheduleReminders(), checkTaskDeadlineReminders(), processScheduleWindow(), processTaskWindow(), purgExpiredChatMessages(), startNotificationCron() (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (42): LocationMap(), formatDateTime(), localDateTimeToISO(), PendingCalendarWidget(), PendingScheduleItem, scheduleTypeBadgeClass(), scheduleTypeLabel(), toLocalDateInputValue() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (29): MetricCardProps, ProjectCompletionChartProps, ProjectData, STATUS_COLORS, TasksByStatusChartProps, Card, CardAction, CardContent (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): AI Fallback Keys (Optional), BETTER_AUTH_SECRET, BETTER_AUTH_URL, BREVO_API_KEY, CEREBRAS_API_KEY, CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET, Cloudinary (Optional -- for file uploads), DATABASE_URL (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (24): deriveRole(), EffectiveRole, GlobalTerminal(), IMPORTANT: Only update when the ROUTE changes — not when the terminal, TerminalInput(), TerminalInputProps, highlight(), JsonLine() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (23): fetchAutomationFiles(), fetchTaskCommentFiles(), fetchActivityFiles(), fetchMemberFiles(), fetchProfileFiles(), fetchProfileSettings(), fetchProjectFiles(), fetchScheduleFiles() (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (26): TimeLogDetailDialogProps, CreateSprintDialogProps, InviteMembersDialogProps, addWeeks(), StartSprintDialog(), toLocalDatetimeInput(), ProjectData, ProjectListCardProps (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (28): addPendingInstallation(), clearExpectingUser(), ExpectingUser, expectingUsers, getAllExpectingUserIds(), isUserExpecting(), peekPendingInstallations(), PendingInstallation (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (23): ACTION_LABELS, formatRelative(), LogEntry(), Props, ChatWidget(), Message, MessageBubble(), QUICK_PROMPTS (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.26
Nodes (13): getDayLabel(), shouldShowDivider(), useProjectDirectInbox(), useProjectDirectMessages(), useSendProjectDirectMessage(), useProjectMessages(), useSendProjectMessage(), useDirectSeen() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (20): Sidebar(), STATUS_ORDER, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (27): ADMIN_OR_PM, ANY_MEMBER, createGithubHandlers(), execGithubLink(), execGithubSetmap(), execGithubStatus(), ADMIN_ONLY, createMemberWriteHandlers() (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (28): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (20): authBuckets, authLimits, Bucket, injectCORSHeaders(), ALLOWED_ORIGINS, auth, globalForPrisma, adminRoutes() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): directRoom(), listSchema, notificationRoutes(), createDirectMessageSchema, projectDirectMessageRoutes(), createMessageSchema, NotificationCreateInput, notificationService (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (13): BurndownChartWidget(), formatDayLabel(), VelocityChartWidget(), SprintBurndownPoint, SprintBurndownResponse, SprintStatus, SprintTask, useCreateSprint() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (21): DependencyDiagramLayout, useDependencyDiagramLayout(), useResetDependencyDiagramLayout(), useSaveDependencyDiagramLayout(), applySubtaskOffsets(), buildRawGraph(), computeDagreLayout(), ConnectModalState (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (19): authenticate(), AuthUser, fastify, FastifyRequest, activityRoutes(), listSchema, readReceiptRoutes(), normalizeTagName() (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (20): actionSchema, automationRoutes(), conditionSchema, createRuleSchema, updateRuleSchema, VALID_ACTION_TYPES, VALID_TRIGGERS, attendeeSchema (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (8): PresenceWrapper(), PWAUpdatePrompt(), usePresenceTracking(), queryClient, MembersPage(), Mode, PrivacyPage(), SettingsPage()

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (17): CompleteSprintDialogProps, DONE_STATUSES, CreateTaskDialog(), getCurrentStartLocalForInput(), isPastTime(), normalizeStatus(), STATUS_LABELS, StartSprintDialogProps (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (16): generateCode(), inviteRoutes(), createProjectSchema, projectRoutes(), updateRoleSchema, dashboardLayoutService, DashboardWidgetConfig, DashboardWidgetType (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (25): dependencies, better-auth, fastify, @fastify/cors, @fastify/jwt, @fastify/multipart, @fastify/redis, @fastify/websocket (+17 more)

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (17): OutputLineType, nextId(), useTerminalHook(), BANNER, checkAdmin(), createAdminHandlers(), escapeHtml(), createProfileWriteHandlers() (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+14 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (26): DEFAULT_BOARD_COLUMNS, DONE_STATUSES, getIO(), projectMessageRoutes(), assignTasksSchema, completeSprintSchema, createSprintSchema, sprintRoutes() (+18 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (29): ContributionHeatmap(), dateKeyUTC(), intensityClass(), monthLabel(), startOfDayUTC(), useAssignAllProjectRepos(), useAssignProjectRepo(), useDisconnectGithub() (+21 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (16): statusDot, statusLabels, TaskStatsWidget(), useProject(), useCompleteSprint(), useStartSprint(), useTasks(), useUpdateTask() (+8 more)

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (7): formatDuration(), OnlineUser, OnlineUserStatus, useOnlineUsers(), AdminUserDetailPage(), statusStyles, UserAnalyticsResponse

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (21): axios, clsx, @dnd-kit/core, @dnd-kit/utilities, @fontsource-variable/geist, dependencies, axios, better-auth (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (21): devDependencies, concurrently, nodemon, ts-node, tsx, @types/node, @types/node-cron, @types/nodemailer (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (12): TimeSummaryWidget(), clamp(), getInitials(), statusColors, WorkloadSummaryWidget(), Badge(), badgeVariants, TimeLog (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (14): useActivity(), ActivityEvent, ActivityPage(), EVENT_CONFIG, EventConfig, EventPill(), FILTER_OPTIONS, FilterKey (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (7): CommandRegistry, ALL_COMMANDS, buildLsTable(), createNavigationHandlers(), escapeHtml(), HELP_TEXT, VirtualFileSystem

### Community 37 - "Community 37"
Cohesion: 0.30
Nodes (9): createAppJwt(), getInstallationToken(), PRIVATE_KEY, requireGithubConfig(), verifyWebhookSignature(), findInstallationTokenForRepo(), parseGithubUrl(), resolveAutoStatus() (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (11): PageHeader(), DashboardTerminal(), useProjectActivity(), ProjectsDashboardProject, ProjectsDashboardResponse, useCreateProject(), useProjectsDashboard(), DashboardPage() (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.28
Nodes (7): ConversationSidebar(), ConversationSidebarProps, DirectConversation, STATUS_CONFIG, useMyStatus(), UserStatus, UserStatusInfo

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+9 more)

### Community 41 - "Community 41"
Cohesion: 0.16
Nodes (16): columnLabels, columnTextColor, columnTopBorder, getTagColor(), TAG_COLORS, TagInput(), TagInputProps, TagPill() (+8 more)

### Community 42 - "Community 42"
Cohesion: 0.26
Nodes (12): stableStringify(), idempotencyPreHandler(), ALLOWED_MIME_TYPES, fileRoutes(), acquireIdempotency(), AcquireIdempotencyResult, attachIdempotencyContext(), completeIdempotencyFromPayload() (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.24
Nodes (12): AnalyticsWrapper(), CookieBanner(), CookiePreferences(), trackEvent(), useAnalytics(), ConsentChoices, getConsent(), getCookieValue() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (7): AnalyticsEventType, initSessionTracking(), trackEvent(), TrackOptions, api, BACKEND_ORIGIN, ANY_MEMBER

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (9): formatDurationMinutes(), formatUserLogTime(), prettyFieldName(), renderMetadataFallback(), renderNonTimeLogDetails(), renderTimeLogDetails(), replaceUnderscores(), TimeLogDetailDialog() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (10): MapModal(), DialogFooter(), buildNominatimViewbox(), distanceKm(), formatDistanceKm(), NOMINATIM_HEADERS, NominatimResult, reverseNominatim() (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.23
Nodes (9): OfflineBanner(), useOnlineStatus(), flushOfflineQueue(), FlushResult, QueueMutationArgs, queueOrRunMutation(), MutationRecord, offlineStore (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (12): ⚡ Automations, 📅 Calendar & Schedules, Complete Application Feature Guide, 📁 Files, 🔗 GitHub Integration, 👥 Members & Invitations, 💬 Messages, 👤 Profile & Settings (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (8): AuditLogAction, AuditLogEntityType, AuditLogFilters, AuditLogItem, AuditLogListResponse, useAuditLogExport(), useAuditLogs(), AdminAuditLogsPage()

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
Cohesion: 0.27
Nodes (9): getApiErrorMessage(), AdminAnalyticsPage(), AnalyticsAiReport, BaseAnalytics, ExtendedAnalytics, normalizeAiReport(), PRIORITY_COLORS, STATUS_COLORS (+1 more)

### Community 56 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, db:migrate:deploy, dev, knowledge:migrate, postinstall, rag:ingest, start

### Community 58 - "AdminIssuesPage.tsx"
Cohesion: 0.32
Nodes (7): AdminIssuesPage(), AnalysisFilter, AnalyticsEvent, getIssueTitle(), getSeverity(), IssueAnalysis, severityStyles

### Community 59 - "AdminDocumentationPage.tsx"
Cohesion: 0.23
Nodes (13): FileExplorer(), formatBytes(), getFileIcon(), StagedFile, FileExplorerDialog(), FileNode, FileType, TaskAttachment (+5 more)

### Community 60 - "writeTasks.ts"
Cohesion: 0.21
Nodes (12): createTaskWriteHandlers(), extractEntityId(), norm(), resolveTaskEntityId(), VALID_TASK_TYPES, WRITE_ROLES, MOUNT_TABLE, MountEntry (+4 more)

### Community 61 - "Consent System Architecture"
Cohesion: 0.33
Nodes (5): 1. Storage & State Management, 2. Consent Utilities, 3. How to Add New Tracking Calls, 4. Policy Versioning, Consent System Architecture

### Community 62 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 64 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 72 - "@fastify/jwt"
Cohesion: 0.26
Nodes (9): CreateTaskDialogProps, useCreateTask(), useTaskSync(), createSocket(), HIERARCHY_LEVEL, TASK_TYPE_CONFIG, TaskType, VALID_PARENT_TYPES (+1 more)

### Community 74 - "@fastify/websocket"
Cohesion: 0.33
Nodes (8): ProjectContributionMember, ProjectContributionsResponse, useProjectContributions(), useProjectMembers(), useRemoveProjectMember(), useUpdateMemberRole(), AssigneeFilter(), ProjectMembersPage()

### Community 75 - "jsonwebtoken"
Cohesion: 0.27
Nodes (8): DateDivider(), EmptyState(), formatFullTime(), formatRelativeTime(), MessageBubble(), MessageBubbleProps, TypingIndicator(), resolveFileUrl()

### Community 77 - "prisma"
Cohesion: 0.31
Nodes (7): TimeLogTimelineItemProps, Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 78 - "@prisma/client"
Cohesion: 0.50
Nodes (3): @prisma/client, runValidationTest(), @prisma/client

### Community 79 - "socket.io"
Cohesion: 0.29
Nodes (7): useUpdateProject(), ArchivedProjectsPage(), ArchiveTab, containerVariants, DONE_TASK_STATUSES, itemVariants, ProjectWithTaskSummary

### Community 80 - "streamifier"
Cohesion: 0.43
Nodes (5): AdminRoute(), isSystemAdmin(), postLoginPath(), LandingPage(), LoginPage()

### Community 84 - "clsx"
Cohesion: 0.43
Nodes (6): getInitials(), ALLOWED_EXTENSIONS, ALLOWED_FILE_TYPES, MentionMember, MessageInputBar(), MessageInputBarProps

### Community 116 - "OfflineToast.tsx"
Cohesion: 0.29
Nodes (5): OfflineToastContext, OfflineToastContextValue, OfflineToastProvider(), Toast, ToastType

### Community 117 - "writeAutomations.ts"
Cohesion: 0.43
Nodes (6): createAutomationHandlers(), extractEntityId(), resolveAutomationId(), VALID_ACTIONS, VALID_TRIGGERS, WRITE_ROLES

### Community 118 - "useTaskGithubLinks.ts"
Cohesion: 0.47
Nodes (5): TaskGithubLinks(), TaskGithubLink, useAddTaskGithubLink(), useRemoveTaskGithubLink(), useTaskGithubLinks()

### Community 119 - "socket.ts"
Cohesion: 0.40
Nodes (3): socket, SOCKET_OPTIONS, SOCKET_URL

### Community 120 - "RecentActivityWidget.tsx"
Cohesion: 0.70
Nodes (3): formatActivityType(), RecentActivityWidget(), useProjectActivity()

## Knowledge Gaps
- **498 isolated node(s):** `name`, `version`, `description`, `main`, `type` (+493 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createProfileWriteHandlers()` connect `Community 25` to `Community 36`, `Community 13`, `Community 23`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `projectRoutes()` connect `Community 23` to `Community 42`, `Community 15`, `Community 19`, `Community 20`, `Community 25`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `api` connect `Community 44` to `Community 1`, `Community 3`, `Community 4`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 17`, `Community 18`, `Community 22`, `Community 25`, `Community 29`, `Community 30`, `Community 31`, `Community 34`, `Community 36`, `Community 38`, `Community 39`, `Community 41`, `Community 43`, `Community 48`, `Community 50`, `Community 51`, `Community 52`, `AdminAnalyticsPage.tsx`, `AdminIssuesPage.tsx`, `AdminDocumentationPage.tsx`, `writeTasks.ts`, `@fastify/jwt`, `@fastify/websocket`, `socket.io`, `writeAutomations.ts`, `useTaskGithubLinks.ts`, `RecentActivityWidget.tsx`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `authenticate()` (e.g. with `activityRoutes()` and `automationRoutes()`) actually correct?**
  _`authenticate()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _498 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.055379746835443035 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._