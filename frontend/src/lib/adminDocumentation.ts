export type DocEntry = {
  name: string
  usage?: string
  description: string
  access: string
}

export type DocSection = {
  id: string
  title: string
  description: string
  entries: DocEntry[]
}

export const ADMIN_DOC_SECTIONS: DocSection[] = [
  {
    id: 'admin-console',
    title: 'Admin Console',
    description: 'Web pages available from the admin area (system ADMIN role required).',
    entries: [
      { name: 'Dashboard', usage: '/admin/dashboard', description: 'Platform KPIs: users, projects, tasks, DAU/WAU, churn risk, consent overview.', access: 'Admin' },
      { name: 'Analytics', usage: '/admin/analytics', description: 'Charts for page views, clicks, errors, trends, devices, locations, and AI-generated reports.', access: 'Admin' },
      { name: 'Users', usage: '/admin/users', description: 'List users, ban/unban, change roles (USER / AI Tester / ADMIN), create AI Tester accounts (max 5).', access: 'Admin' },
      { name: 'User Detail', usage: '/admin/users/:id', description: 'Per-user sessions, time in app, top pages/clicks, hourly activity, live presence.', access: 'Admin' },
      { name: 'Issues', usage: '/admin/issues', description: 'Recent client/server errors from analytics with optional Gemini diagnosis.', access: 'Admin' },
      { name: 'Chatbot Knowledge', usage: '/admin/knowledge', description: 'Approve, reject, or revoke global AI knowledge submitted by testers or admins.', access: 'Admin' },
      { name: 'Audit Logs', usage: '/admin/audit-logs', description: 'Immutable audit trail with filters and CSV export.', access: 'Admin' },
      { name: 'Documentation', usage: '/admin/documentation', description: 'This reference — all admin, terminal, and chatbot functions.', access: 'Admin' },
    ],
  },
  {
    id: 'admin-api',
    title: 'Admin API Endpoints',
    description: 'REST endpoints behind the admin UI (all require system ADMIN).',
    entries: [
      { name: 'GET /admin/metrics', description: 'Dashboard summary metrics.', access: 'Admin' },
      { name: 'GET /admin/analytics', description: 'Top pages, clicks, errors, performance.', access: 'Admin' },
      { name: 'GET /admin/analytics/extended', description: '30-day extended analytics bundle.', access: 'Admin' },
      { name: 'POST /admin/analytics/report', description: 'AI natural-language analytics report (12/hr limit).', access: 'Admin' },
      { name: 'GET /admin/users', description: 'Paginated user list.', access: 'Admin' },
      { name: 'POST /admin/users/ai-tester', description: 'Create AI Tester account (name, email, password).', access: 'Admin' },
      { name: 'PATCH /admin/users/:id/status', description: 'Ban or unban user (active | banned).', access: 'Admin' },
      { name: 'PATCH /admin/users/:id/role', description: 'Set system role: USER | AI_TESTER | ADMIN.', access: 'Admin' },
      { name: 'GET /admin/users/online', description: 'Live online/idle/offline presence for all users.', access: 'Admin' },
      { name: 'GET /admin/users/:id/analytics', description: '30-day per-user activity analytics.', access: 'Admin' },
      { name: 'DELETE /admin/projects/:id', description: 'Hard-delete project (requires confirmName in body).', access: 'Admin' },
      { name: 'GET /admin/issues', description: 'Last 100 ERROR analytics events.', access: 'Admin' },
      { name: 'POST /admin/issues/:id/analyze', description: 'Gemini diagnosis for an error (10/hr limit).', access: 'Admin' },
      { name: 'GET /admin/knowledge/pending', description: 'Global knowledge awaiting approval.', access: 'Admin' },
      { name: 'GET /admin/knowledge/approved', description: 'Approved global knowledge entries.', access: 'Admin' },
      { name: 'POST /admin/knowledge/:id/approve', description: 'Approve and index in vector store.', access: 'Admin' },
      { name: 'POST /admin/knowledge/:id/reject', description: 'Reject with reason.', access: 'Admin' },
      { name: 'DELETE /admin/knowledge/:id', description: 'Revoke approved global entry.', access: 'Admin' },
      { name: 'GET /admin/audit-logs', description: 'Paginated audit log list.', access: 'Admin' },
      { name: 'GET /admin/audit-logs/export', description: 'CSV export with filters.', access: 'Admin' },
    ],
  },
  {
    id: 'terminal-nav',
    title: 'Terminal — Navigation & Read',
    description: 'Open the terminal with Ctrl+` from any project view. Type help <command> for live help.',
    entries: [
      { name: 'pwd', usage: 'pwd', description: 'Print current virtual directory.', access: 'All users' },
      { name: 'cd', usage: 'cd <path>', description: 'Change directory; cd projects/<name> switches project context.', access: 'All users' },
      { name: 'ls', usage: 'ls [path]', description: 'List directory contents.', access: 'All users' },
      { name: 'cat', usage: 'cat <file>', description: 'Print JSON file contents.', access: 'All users' },
      { name: 'find', usage: 'find <path> [--key=value]', description: 'Search files with filters.', access: 'All users' },
      { name: 'stat', usage: 'stat [path]', description: 'Directory aggregate statistics.', access: 'All users' },
      { name: 'whoami', usage: 'whoami', description: 'Show user, project, role, and cwd.', access: 'All users' },
      { name: 'clear', usage: 'clear', description: 'Clear terminal output (or Ctrl+L).', access: 'All users' },
      { name: 'help', usage: 'help [command]', description: 'Command reference.', access: 'All users' },
      { name: 'project-report', usage: 'project-report', description: 'List all projects and task states.', access: 'All users' },
    ],
  },
  {
    id: 'terminal-project',
    title: 'Terminal — Project Commands',
    description: 'Project roles: MASTER_ADMIN, PROJECT_MANAGER, MEMBER. System ADMIN maps to MASTER_ADMIN in the terminal.',
    entries: [
      { name: 'touch (task)', usage: 'touch tasks/<status>/<name> --assignee=... --deadline=...', description: 'Create task. Requires assignee and deadline.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'rm (task)', usage: 'rm tasks/<status>/<file>', description: 'Delete a task.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'mv (task)', usage: 'mv tasks/<from>/... tasks/<to>/', description: 'Move task between status columns.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'edit (task)', usage: 'edit tasks/... [--title=] [--priority=] [--deadline=]', description: 'Update task fields in place.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'touch (sprint)', usage: 'touch sprints/<name> [--goal=]', description: 'Create sprint.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'rm (sprint)', usage: 'rm sprints/<file>', description: 'Delete sprint.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'start', usage: 'start sprints/<file>', description: 'Start a planning sprint.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'close', usage: 'close sprints/<file>', description: 'Complete an active sprint.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'rm (member)', usage: 'rm members/<email>', description: 'Remove project member.', access: 'MASTER_ADMIN only' },
      { name: 'setrole', usage: 'setrole members/<email> --role=MEMBER|PROJECT_MANAGER', description: 'Change member project role.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'invite', usage: 'invite <email>', description: 'Invite user to project.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'msg', usage: 'msg "message"', description: 'Post to project channel.', access: 'All project members' },
      { name: 'dm', usage: 'dm <email> "message"', description: 'Send direct message.', access: 'All project members' },
      { name: 'log', usage: 'log tasks/... --minutes=60', description: 'Log time on a task.', access: 'All project members' },
      { name: 'touch (schedule)', usage: 'touch schedules/<name> --at=<ISO>', description: 'Create schedule/event.', access: 'All project members' },
      { name: 'github', usage: 'github status | link | setmap ...', description: 'GitHub integration status, install URL, PR status mapping.', access: 'All project members (setmap: managers)' },
      { name: 'touch (project)', usage: 'touch project <name>', description: 'Create new project.', access: 'All authenticated users' },
      { name: 'archive / project-close', usage: 'archive', description: 'Mark project completed.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'project-axe / axe-project', usage: 'project-axe [projectId]', description: 'Discontinue project (AXED).', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'project-reopen', usage: 'project-reopen [projectId]', description: 'Re-open completed/axed project.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'toggle', usage: 'toggle automations/<name>', description: 'Enable/disable automation rule.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
      { name: 'rm (automation)', usage: 'rm automations/<name>', description: 'Delete automation rule.', access: 'MASTER_ADMIN, PROJECT_MANAGER' },
    ],
  },
  {
    id: 'terminal-profile',
    title: 'Terminal — Profile & Navigation',
    description: 'Personal account and SPA navigation from the terminal.',
    entries: [
      { name: 'passwd', usage: 'passwd <current> <new>', description: 'Change account password.', access: 'All users' },
      { name: 'mkdir', usage: 'mkdir profile/files/<folder>', description: 'Create personal file folder.', access: 'All users' },
      { name: 'upload', usage: 'upload [profile/files | projects/...]', description: 'Upload file via browser picker.', access: 'All users' },
      { name: 'open', usage: 'open profile | settings | backlog | admin | ...', description: 'Navigate to app pages without full reload.', access: 'All users (admin route still requires ADMIN)' },
    ],
  },
  {
    id: 'terminal-admin',
    title: 'Terminal — Platform Admin Commands',
    description: 'System ADMIN only. Same capabilities as parts of the admin web console.',
    entries: [
      { name: 'users', usage: 'users', description: 'List all platform users.', access: 'System ADMIN' },
      { name: 'metrics', usage: 'metrics', description: 'Print platform health summary.', access: 'System ADMIN' },
      { name: 'audit', usage: 'audit [n]', description: 'Show last n audit log entries (default 20, max 50).', access: 'System ADMIN' },
      { name: 'ban', usage: 'ban <email>', description: 'Suspend user account and revoke sessions.', access: 'System ADMIN' },
      { name: 'unban', usage: 'unban <email>', description: 'Reactivate suspended user.', access: 'System ADMIN' },
      { name: 'purge-project', usage: 'purge-project <project-id>', description: 'Permanently delete project and all data (interactive confirm).', access: 'System ADMIN' },
    ],
  },
  {
    id: 'chat-commands',
    title: 'Chatbot Slash Commands',
    description: 'Type in WeBot chat when FEATURE_AI_TESTER is enabled. Names: lowercase alphanumeric, hyphens, underscores (max 64 chars). Facts: max 500 chars.',
    entries: [
      { name: '/add', usage: '/add <name> <fact>', description: 'Add named knowledge. USER → personal; AI Tester → global PENDING; Admin → global live.', access: 'USER, AI_TESTER, ADMIN' },
      { name: '/delete', usage: '/delete <name>', description: 'Delete own entries. Admin deletes global by name. Cannot delete own approved global (non-admin).', access: 'USER, AI_TESTER, ADMIN' },
      { name: '/update', usage: '/update <name> <new fact>', description: 'Update fact. Non-admin global edits revert to PENDING.', access: 'USER, AI_TESTER, ADMIN' },
      { name: '/knowledge-list', usage: '/knowledge-list', description: 'List accessible entries. Admin sees global only; others see own.', access: 'USER, AI_TESTER, ADMIN' },
      { name: '/knowledge-help', usage: '/knowledge-help', description: 'Show slash command help in chat.', access: 'USER, AI_TESTER, ADMIN' },
    ],
  },
  {
    id: 'chat-natural',
    title: 'Chatbot — Natural Language Learning',
    description: 'When users correct the AI in normal chat, it may call update_knowledge_base (no slash command).',
    entries: [
      { name: 'Personal memory', description: 'USER: saved for that user only. Validator blocks global queue for normal users.', access: 'USER' },
      { name: 'Global pending', description: 'AI_TESTER: submitted for admin review at /admin/knowledge; admins notified.', access: 'AI_TESTER' },
      { name: 'Global live', description: 'ADMIN: auto-approved and indexed when validator returns queue_global.', access: 'ADMIN' },
      { name: 'Rejected facts', description: 'Injection, security, off-topic, or duplicate facts are rejected with a reason.', access: 'All roles' },
    ],
  },
  {
    id: 'roles',
    title: 'System Roles Reference',
    description: 'Two role layers: system role (User.role) and project role (ProjectMember.role).',
    entries: [
      { name: 'USER', description: 'Standard account. Personal chat memory; slash /add creates personal knowledge.', access: 'Default signup' },
      { name: 'AI_TESTER', description: 'Max 5 accounts. Slash /add creates global PENDING knowledge. No admin UI access.', access: 'Admin assigns or creates' },
      { name: 'ADMIN', description: 'Full admin console, terminal admin commands, global knowledge auto-approved.', access: 'Admin promotes' },
      { name: 'MASTER_ADMIN', description: 'Project owner-level permissions in terminal and project settings.', access: 'Per project' },
      { name: 'PROJECT_MANAGER', description: 'Manage tasks, sprints, invites; cannot remove members alone.', access: 'Per project' },
      { name: 'MEMBER', description: 'Standard project participant.', access: 'Per project' },
    ],
  },
]
