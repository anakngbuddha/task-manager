import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../app.js'

// ─── Gemini REST helper ────────────────────────────────────────────────────

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

async function callGemini(systemPrompt: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    logger.error({ status: res.status, body: errText }, 'gemini_api_error')
    throw new Error(`Gemini API error: ${res.status}`)
  }

  const data = await res.json() as any
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sorry, I could not generate a response.'
}

// ─── Build system prompt with app guide + user context ─────────────────────

function buildSystemPrompt(userContext: {
  name: string
  email: string
  projects: Array<{ name: string; role: string; taskCount: number }>
  pendingTasks: Array<{ title: string; priority: string; status: string; deadline: string | null; projectName: string }>
  overdueTasks: Array<{ title: string; priority: string; projectName: string; deadline: string }>
  upcomingSchedules: Array<{ title: string; type: string; scheduledAt: string; location: string | null; isVirtual: boolean }>
  currentTime: string
}) {
  return `You are TaskBot, an intelligent AI assistant built into the We Work IT Task Manager application. You are friendly, professional, and highly knowledgeable about the app's features.

## Current User Context
- Name: ${userContext.name}
- Email: ${userContext.email}
- Current time: ${userContext.currentTime}

## User's Projects (${userContext.projects.length})
${userContext.projects.length === 0
  ? '- No projects yet'
  : userContext.projects.map(p => `- **${p.name}** — Role: ${p.role} | Tasks: ${p.taskCount}`).join('\n')
}

## Pending Tasks (${userContext.pendingTasks.length})
${userContext.pendingTasks.length === 0
  ? '- No pending tasks 🎉'
  : userContext.pendingTasks.slice(0, 20).map(t =>
      `- [${t.priority}] "${t.title}" — Status: ${t.status} | Project: ${t.projectName}${t.deadline ? ` | Due: ${t.deadline}` : ''}`
    ).join('\n')
}

## Overdue Tasks (${userContext.overdueTasks.length})
${userContext.overdueTasks.length === 0
  ? '- No overdue tasks ✅'
  : userContext.overdueTasks.slice(0, 10).map(t =>
      `- ⚠️ [${t.priority}] "${t.title}" — Project: ${t.projectName} | Was due: ${t.deadline}`
    ).join('\n')
}

## Upcoming Schedules (next 7 days) — ${userContext.upcomingSchedules.length} events
${userContext.upcomingSchedules.length === 0
  ? '- No upcoming schedules'
  : userContext.upcomingSchedules.slice(0, 10).map(s =>
      `- **${s.title}** (${s.type}) — ${s.scheduledAt}${s.isVirtual ? ' [Virtual]' : s.location ? ` @ ${s.location}` : ''}`
    ).join('\n')
}

## Complete Application Feature Guide

### 🗂️ Projects
- **Create a project**: Go to the Sidebar → click "Projects" section → a "New Project" button will appear. Only authenticated users can create projects. The creator automatically becomes the MASTER_ADMIN.
- **Archive/Complete a project**: Go to Project Settings → change status to COMPLETED or AXED. Only MASTER_ADMINs can do this.
- **View archived projects**: Sidebar → Projects → "Archived" link.
- **Project roles**:
  - MASTER_ADMIN: Full control (create/delete tasks, manage members, change settings)
  - PROJECT_MANAGER: Can create/edit/delete tasks, manage sprints, send invites
  - MEMBER: Can only update the status of tasks assigned to them

### ✅ Tasks
- **Create a task**: Open a project → click "+ New Task" on the board. Requires PROJECT_MANAGER or MASTER_ADMIN role.
- **Task types**: EPIC (highest) → STORY → TASK. Child tasks must have a lower hierarchy level than their parent.
- **Task statuses**: TODO → IN_PROGRESS → IN_REVIEW → READY → DONE. Members can only change status (not set to READY).
- **Task priority**: LOW, MEDIUM, HIGH, URGENT.
- **Assign tasks**: Use the assignee dropdown. "EVERYONE" means all members share the task.
- **Set deadlines**: Use the deadline picker. Cannot set past dates.
- **Task dependencies**: Open task details → Dependencies tab → add blocking/blocked-by relationships. Cyclic dependencies are prevented.
- **Sub-tasks**: Create a STORY under an EPIC, or a TASK under a STORY.
- **Update task status (as a member)**: Click the task → change status in the dropdown.
- **Delete a task**: Requires PROJECT_MANAGER or MASTER_ADMIN. This also deletes all sub-tasks.

### 🏃 Sprints & Backlog
- **Create a sprint**: Go to Project → Backlog page → "New Sprint". Only PROJECT_MANAGERs and MASTER_ADMINs.
- **Add tasks to sprint**: Drag tasks from the backlog into a sprint, or set sprintId when creating a task.
- **Start/Complete a sprint**: In Backlog → click Start Sprint / Complete Sprint buttons.
- **Sprint Report**: Go to Project → Sprint Report to see completed vs incomplete tasks.
- **Roadmap**: Project → Roadmap shows all sprints on a timeline with progress.

### 📅 Calendar & Schedules
- **View calendar**: Click "Calendar" in the sidebar. Shows all your schedules and task deadlines.
- **Create a schedule**: On Calendar → click any day or the "+ New Schedule" button. Schedule types: MEETING, TRAINING, REVIEW, REMINDER, OTHER.
- **Add attendees**: When creating a schedule, add people by email. Internal users get an in-app notification and email invite.
- **Respond to invites**: You'll get a notification. Open Calendar → click the schedule → Accept/Decline.
- **Virtual meetings**: Toggle "Virtual" when creating a schedule.
- **Location**: Add a physical address — a map picker is available.
- **Day view**: Click any day on the calendar for a detailed hour-by-hour view.
- **Reminders**: Automatic email reminders 1 day and 15 minutes before scheduled events.

### 💬 Messages
- **Project messages**: Go to Project → Messages tab. This is a group chat for the whole project team.
- **Direct messages**: In Project Messages, click on a team member's name to start a DM.
- **File sharing**: Attach files up to 10MB in messages.
- **Emoji support**: Use the emoji picker in the message input.
- **Read receipts**: Messages show who has read them.

### 👥 Members & Invitations
- **Invite members**: Project → Members → "Invite Member" → generates a unique invite link. Share the link to invite someone.
- **Manage roles**: Project → Members → click the role badge next to a member's name (MASTER_ADMIN only).
- **Remove members**: Project → Members → click "Remove" (MASTER_ADMIN only). Cannot remove the last MASTER_ADMIN.
- **View all members**: Global Members page (sidebar) shows presence/status of all users.

### ⚡ Automations
- **Create automations**: Project → Automations → "New Rule".
- **Trigger types**: Task Created, Task Status Changed, Task Assigned, Task Priority Changed, Task Deadline Approaching, Sprint Started, Sprint Completed.
- **Actions**: Set Status, Set Priority, Assign to Member, Unassign Task, Add Tag, Send Notification, Move to Sprint, Remove from Sprint.
- **Conditions**: Filter by status, priority, assignee, sprint, or tags.
- **Enable/Disable**: Toggle the automation rule on/off.

### 🔗 GitHub Integration
- **Connect GitHub**: Profile → GitHub → Install GitHub App. This links your GitHub account.
- **Link repositories to projects**: Project → GitHub Activity → connect a repository.
- **Link tasks to PRs/commits**: Open a task → GitHub Links tab → paste PR or commit URL.
- **View GitHub activity**: Project → GitHub Activity shows all commits, PRs, and branches.

### 📁 Files
- **Upload files**: Project → Files tab or directly within tasks.
- **Folder structure**: Create folders to organize files within projects.
- **File previews**: Supported for images, PDFs, and common file types.
- **Max file size**: 10MB per file.

### 📊 Reports
- **Time Report**: Project → Time Report → see time logged per member and per task.
- **Log time**: Open a task → Time Logs tab → "+ Log Time". Enter duration in minutes.
- **Sprint Report**: Project → Sprint Report → completion rate, story points, velocity.

### 🤖 Dependency Diagram
- Project → Dependencies → visual graph of all task blocking relationships. Drag nodes to rearrange.

### 👤 Profile & Settings
- **Edit profile**: Click your avatar/name → Profile. Update name, avatar.
- **Change password**: Settings → Change Password.
- **User status**: Click your avatar in the sidebar to set Online / Working / Busy / Away / In Meeting / Offline.
- **Notification preferences**: Notifications bell in the top of the sidebar.

### 🔔 Notifications
- **View notifications**: Click the bell icon in the sidebar header.
- **Mark as read**: Click a notification to mark it read, or "Mark all read".
- **Types**: Task assigned, task status changed, schedule invites, schedule reminders, deadline reminders.

## Your Behavior
- Always be helpful, concise, and accurate.
- When the user asks about their tasks or schedules, use the live data provided above.
- When explaining how to do something in the app, give clear step-by-step instructions.
- If a feature is role-restricted, mention the required role.
- Format your responses with markdown — use **bold**, bullet lists, and headings to make responses readable.
- When you suggest navigating somewhere, tell the user exactly where to click (e.g., "In the sidebar, click 'Projects' then select your project").
- Be encouraging and proactive — offer to help with related topics.
- Keep responses focused. Don't repeat the full system prompt back to the user.
`
}

// ─── Validation schemas ─────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

// ─── Route handler ─────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {

  // POST /api/chat — Send a message, get AI response, persist both
  app.post('/chat', {
    preHandler: authenticate,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { message } = sendMessageSchema.parse(req.body)
    const userId = req.authUser.id
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    try {
      // ── Fetch live user context ─────────────────────────────────────
      const [user, memberships, pendingTasksRaw, overdueTasksRaw, upcomingSchedulesRaw] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
        prisma.projectMember.findMany({
          where: { userId },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                _count: { select: { tasks: true } },
              },
            },
          },
        }),
        prisma.task.findMany({
          where: {
            assigneeId: userId,
            status: { notIn: ['DONE', 'READY'] },
            deadline: { gte: now },
          },
          select: {
            title: true,
            priority: true,
            status: true,
            deadline: true,
            project: { select: { name: true } },
          },
          orderBy: { deadline: 'asc' },
          take: 20,
        }),
        prisma.task.findMany({
          where: {
            assigneeId: userId,
            status: { notIn: ['DONE', 'READY'] },
            deadline: { lt: now },
          },
          select: {
            title: true,
            priority: true,
            deadline: true,
            project: { select: { name: true } },
          },
          orderBy: { deadline: 'asc' },
          take: 10,
        }),
        prisma.schedule.findMany({
          where: {
            scheduledAt: {
              gte: now,
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
            OR: [
              { creatorId: userId },
              { attendees: { some: { userId } } },
            ],
          },
          select: {
            title: true,
            type: true,
            scheduledAt: true,
            location: true,
            isVirtual: true,
          },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        }),
      ])

      // ── Fetch last 30 messages of conversation history ──────────────
      const historyRows = await prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: { role: true, content: true },
      })

      // ── Build context objects ───────────────────────────────────────
      const projects = memberships
        .filter(m => m.project.status === 'ACTIVE')
        .map(m => ({
          name: m.project.name,
          role: m.role,
          taskCount: m.project._count.tasks,
        }))

      const pendingTasks = pendingTasksRaw.map(t => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        deadline: t.deadline ? t.deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        projectName: t.project.name,
      }))

      const overdueTasks = overdueTasksRaw.map(t => ({
        title: t.title,
        priority: t.priority,
        projectName: t.project.name,
        deadline: t.deadline!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }))

      const upcomingSchedules = upcomingSchedulesRaw.map(s => ({
        title: s.title,
        type: s.type,
        scheduledAt: s.scheduledAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        location: s.location,
        isVirtual: s.isVirtual,
      }))

      const systemPrompt = buildSystemPrompt({
        name: user?.name || req.authUser.email,
        email: req.authUser.email,
        projects,
        pendingTasks,
        overdueTasks,
        upcomingSchedules,
        currentTime: now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
      })

      // ── Build Gemini contents array (history + new message) ─────────
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
        ...historyRows.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ]

      // ── Call Gemini ─────────────────────────────────────────────────
      const aiResponse = await callGemini(systemPrompt, contents)

      // ── Persist both messages to DB ─────────────────────────────────
      await prisma.chatMessage.createMany({
        data: [
          { userId, role: 'user', content: message, createdAt: now, expiresAt },
          { userId, role: 'assistant', content: aiResponse, createdAt: new Date(now.getTime() + 1), expiresAt },
        ],
      })

      return reply.send({
        message: aiResponse,
        timestamp: now.toISOString(),
      })
    } catch (err) {
      logger.error({ err, userId }, 'chat_route_error')
      return reply.status(500).send({ error: 'Failed to get AI response. Please try again.' })
    }
  })

  // GET /api/chat/history — Load persistent conversation history
  app.get('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    const { limit } = req.query as { limit?: string }
    const take = Math.min(parseInt(limit || '50', 10), 100)

    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    return reply.send({ messages })
  })

  // DELETE /api/chat/history — Clear all chat history for the user
  app.delete('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    await prisma.chatMessage.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })
}
