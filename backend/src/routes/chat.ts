import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../app.js'
import { queryRagContext } from '../services/rag.service.js'
import { loadPersonalMemory, persistKnowledgeUpdate } from '../services/knowledge.service.js'

// ─── Gemini REST helper ────────────────────────────────────────────────────

class GeminiNotConfiguredError extends Error {}
class GeminiRateLimitError extends Error {
  retryAfterSec?: number
  constructor(message: string, retryAfterSec?: number) {
    super(message)
    this.retryAfterSec = retryAfterSec
  }
}

const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'

// Skip Gemini calls briefly after a 429 to avoid hammering the API.
let geminiRateLimitedUntil = 0

function isGeminiRateLimited(): boolean {
  return Date.now() < geminiRateLimitedUntil
}

function markGeminiRateLimited(retryAfterSec?: number) {
  geminiRateLimitedUntil = Date.now() + (retryAfterSec ?? 60) * 1000
}

type LocalIntent = 'pending_tasks' | 'overdue_tasks' | 'schedules' | 'projects' | 'summary' | null

function isHowToQuestion(message: string): boolean {
  return /\b(how\s+(do|can|to|does)|where\s+(do|can|is)|what\s+is|help\s+me|explain|walk\s+me\s+through|steps\s+to|guide\s+me)\b/i.test(message)
}

function classifyLocalIntent(message: string): LocalIntent | null {
  const lower = message.toLowerCase()

  // Corrections / knowledge updates need the full AI + validator pipeline.
  if (/\b(remember\s+that|you.?re\s+wrong|actually,|correct\s+your|update\s+your\s+knowledge|learn\s+that)\b/.test(lower)) {
    return null
  }

  // How-to / documentation questions → RAG or Gemini, not live data.
  if (isHowToQuestion(message)) return null

  if (/\b(overdue|past\s+due|late|behind)\b/.test(lower)) return 'overdue_tasks'

  if (
    /\b(tasks?|todos?|to-?dos?|assignments?)\b/.test(lower) ||
    /\bwhat\s+(do\s+i|should\s+i|need\s+to)\b/.test(lower) ||
    /\b(how\s+many|any)\s+.*\b(tasks?|todos?)\b/.test(lower) ||
    /\b(workload|on\s+my\s+plate|need\s+to\s+do)\b/.test(lower) ||
    /\b(show|list|get|tell\s+me\s+about)\b.*\b(tasks?|todos?)\b/.test(lower)
  ) {
    return 'pending_tasks'
  }

  if (/\b(schedules?|calendar|meetings?|events?|appointments?|this\s+week|today|tomorrow)\b/.test(lower)) {
    return 'schedules'
  }

  if (/\b(projects?|workspaces?)\b/.test(lower)) return 'projects'

  if (/\b(summary|overview|status|catch\s+me\s+up|update\s+me|dashboard)\b/.test(lower)) return 'summary'
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))\b/.test(lower)) return 'summary'

  return null
}

function isLiveDataQuery(message: string): boolean {
  return classifyLocalIntent(message) !== null
}

type LiveContext = {
  pendingTasks: Array<{ title: string; priority: string; status: string; deadline: string | null; projectName: string }>
  overdueTasks: Array<{ title: string; priority: string; projectName: string; deadline: string }>
  upcomingSchedules: Array<{ title: string; type: string; scheduledAt: string; location: string | null; isVirtual: boolean }>
  projects: Array<{ name: string; role: string; taskCount: number }>
}

function tryBuildLocalResponse(message: string, ctx: LiveContext): string | null {
  const intent = classifyLocalIntent(message)
  if (!intent) return null

  if (intent === 'overdue_tasks') {
    if (ctx.overdueTasks.length === 0) {
      return 'You have **no overdue tasks** — nice work! ✅'
    }
    const lines = ctx.overdueTasks.map(t =>
      `- ⚠️ [${t.priority}] **${t.title}** — ${t.projectName} (was due ${t.deadline})`
    )
    return `You have **${ctx.overdueTasks.length} overdue task(s)**:\n\n${lines.join('\n')}`
  }

  if (intent === 'pending_tasks') {
    if (ctx.pendingTasks.length === 0) {
      return 'You have **no pending tasks**! 🎉'
    }
    const lines = ctx.pendingTasks.map(t =>
      `- [${t.priority}] **${t.title}** — ${t.status} | ${t.projectName}${t.deadline ? ` | Due: ${t.deadline}` : ''}`
    )
    return `You have **${ctx.pendingTasks.length} pending task(s)**:\n\n${lines.join('\n')}`
  }

  if (intent === 'schedules') {
    if (ctx.upcomingSchedules.length === 0) {
      return 'You have **no upcoming schedules** in the next 7 days.'
    }
    const lines = ctx.upcomingSchedules.map(s =>
      `- **${s.title}** (${s.type}) — ${s.scheduledAt}${s.isVirtual ? ' [Virtual]' : s.location ? ` @ ${s.location}` : ''}`
    )
    return `**Upcoming schedules** (next 7 days):\n\n${lines.join('\n')}`
  }

  if (intent === 'projects') {
    if (ctx.projects.length === 0) {
      return "You're not a member of any active projects yet."
    }
    const lines = ctx.projects.map(p => `- **${p.name}** — Role: ${p.role} | Tasks: ${p.taskCount}`)
    return `**Your active projects** (${ctx.projects.length}):\n\n${lines.join('\n')}`
  }

  if (intent === 'summary') {
    return buildContextSummary(ctx)
  }

  return null
}

function buildContextSummary(ctx: LiveContext): string {
  const parts: string[] = []

  if (ctx.pendingTasks.length === 0) {
    parts.push('**Pending tasks:** none 🎉')
  } else {
    const lines = ctx.pendingTasks.slice(0, 5).map(t => `- [${t.priority}] ${t.title}`)
    parts.push(`**Pending tasks (${ctx.pendingTasks.length}):**\n${lines.join('\n')}${ctx.pendingTasks.length > 5 ? '\n- …' : ''}`)
  }

  if (ctx.overdueTasks.length > 0) {
    const lines = ctx.overdueTasks.slice(0, 3).map(t => `- ⚠️ ${t.title}`)
    parts.push(`**Overdue (${ctx.overdueTasks.length}):**\n${lines.join('\n')}`)
  }

  if (ctx.upcomingSchedules.length === 0) {
    parts.push('**Upcoming schedules:** none in the next 7 days')
  } else {
    const lines = ctx.upcomingSchedules.slice(0, 3).map(s => `- ${s.title} — ${s.scheduledAt}`)
    parts.push(`**Upcoming schedules (${ctx.upcomingSchedules.length}):**\n${lines.join('\n')}`)
  }

  if (ctx.projects.length > 0) {
    parts.push(`**Active projects:** ${ctx.projects.map(p => p.name).join(', ')}`)
  }

  return `Here's your current overview:\n\n${parts.join('\n\n')}`
}

function tryRagOnlyResponse(message: string, ragContext: string): string | null {
  if (!ragContext.trim()) return null
  if (!/\b(how|where|what|help|create|invite|automation|sprint|member|file|github|calendar|task|project|role)\b/i.test(message)) {
    return null
  }
  return `Here's the most relevant documentation I found:\n\n${ragContext}\n\n---\n*AI summarization is temporarily limited — the docs above should help. Try the quick-action buttons for instant task & schedule answers.*`
}

function buildRateLimitMessage(ctx: LiveContext, retryAfterSec?: number): string {
  const waitHint = retryAfterSec ? ` Try again in about ${retryAfterSec} seconds.` : ''
  const summary = buildContextSummary(ctx)
  return `${summary}\n\n---\n*Full AI responses are temporarily rate-limited.${waitHint} Ask about **tasks**, **schedule**, or **projects** for instant answers, or use the quick-action buttons below.*`
}

function getGeminiUrl(apiKey: string): string {
  const base = process.env.GEMINI_PROXY_URL || 'https://generativelanguage.googleapis.com'
  return `${base}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

async function callGemini(systemPrompt: string, contents: Array<{ role: string; parts: Array<any> }>): Promise<{ text?: string, functionCall?: any }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiNotConfiguredError('GEMINI_API_KEY not configured')

  const res = await fetch(getGeminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{
        functionDeclarations: [{
          name: 'update_knowledge_base',
          description: 'Proposes a fact or correction for the knowledge base. Call ONLY when the user explicitly corrects your understanding of how the app works, or gives you a new verifiable fact. The server validates and decides what gets stored.',
          parameters: {
            type: 'OBJECT',
            properties: {
              fact: { type: 'STRING', description: 'The concise, corrected fact to propose.' },
            },
            required: ['fact'],
          },
        }],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) {
      let retryAfterSec: number | undefined
      try {
        const parsed = JSON.parse(errText) as { error?: { details?: Array<{ retryDelay?: string }> } }
        const retryInfo = parsed?.error?.details?.find(d => d.retryDelay)
        if (retryInfo?.retryDelay) {
          retryAfterSec = parseInt(retryInfo.retryDelay.replace(/\D/g, ''), 10) || undefined
        }
      } catch { /* ignore parse errors */ }
      logger.warn({ status: res.status }, 'gemini_rate_limited')
      const waitHint = retryAfterSec ? ` Try again in about ${retryAfterSec} seconds.` : ' Please try again later.'
      markGeminiRateLimited(retryAfterSec)
      throw new GeminiRateLimitError(
        `The AI assistant is temporarily rate-limited.${waitHint}`,
        retryAfterSec,
      )
    }
    logger.error({ status: res.status, body: errText }, 'gemini_api_error')
    throw new Error(`Gemini API error: ${res.status}`)
  }

  const data = await res.json() as any
  const part = data?.candidates?.[0]?.content?.parts?.[0]

  if (part?.functionCall) {
    return { functionCall: part.functionCall }
  }

  return { text: part?.text ?? 'Sorry, I could not generate a response.' }
}

function buildSystemPrompt(userContext: {
  name: string
  email: string
  projects: Array<{ name: string; role: string; taskCount: number }>
  pendingTasks: Array<{ title: string; priority: string; status: string; deadline: string | null; projectName: string }>
  overdueTasks: Array<{ title: string; priority: string; projectName: string; deadline: string }>
  upcomingSchedules: Array<{ title: string; type: string; scheduledAt: string; location: string | null; isVirtual: boolean }>
  currentTime: string
  ragContext: string
  personalMemory: string[]
}) {
  const personalSection = userContext.personalMemory.length === 0
    ? '- No saved personal notes yet'
    : userContext.personalMemory.map(f => `- ${f}`).join('\n')

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

## Personal Memory (saved for this user only)
${personalSection}

## Relevant Documentation Context
${userContext.ragContext ? userContext.ragContext : 'No relevant documentation found.'}

## Your Behavior
- Always be helpful, concise, and accurate.
- When the user asks about their tasks or schedules, use the live data provided above.
- When explaining how to do something in the app, give clear step-by-step instructions using the Relevant Documentation Context.
- If a feature is role-restricted, mention the required role.
- Format your responses with markdown — use **bold**, bullet lists, and headings to make responses readable.
- When you suggest navigating somewhere, tell the user exactly where to click.
- Be encouraging and proactive — offer to help with related topics.
- Keep responses focused. Don't repeat the full system prompt back to the user.

## Self-Learning / Knowledge Base Updates
- If the user explicitly corrects your understanding of how the app works, or provides a new factual instruction about the app, you MUST call the \`update_knowledge_base\` tool.
- Pass the corrected fact concisely as the \`fact\` parameter.
- Do NOT call the tool for general conversation or task updates, only for documentation corrections.
- The server validates all proposed facts; personal facts are saved for this user, global facts require admin approval.
`
}

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

export async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', {
    preHandler: authenticate,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { message } = sendMessageSchema.parse(req.body)
    const userId = req.authUser.id
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    try {
      const skipRag = isLiveDataQuery(message)
      const needsDocs = /\b(how|where|what|help|create|invite|automation|sprint|explain)\b/i.test(message)
      const ragPromise = (skipRag && !needsDocs) ? Promise.resolve('') : queryRagContext(message)

      const [user, memberships, pendingTasksRaw, overdueTasksRaw, upcomingSchedulesRaw, ragContext, personalMemory] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, role: true },
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
        ragPromise,
        loadPersonalMemory(userId),
      ])

      const isAdmin = user?.role === 'ADMIN'

      const historyRows = await prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: { role: true, content: true },
      })

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
        ragContext,
        personalMemory,
      })

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
        ...historyRows.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ]

      const liveCtx: LiveContext = { pendingTasks, overdueTasks, upcomingSchedules, projects }

      const localResponse = tryBuildLocalResponse(message, liveCtx)
      let finalMessage = ''

      if (localResponse) {
        finalMessage = localResponse
      } else if (isGeminiRateLimited()) {
        finalMessage =
          tryRagOnlyResponse(message, ragContext) ??
          buildRateLimitMessage(liveCtx)
      } else {
        try {
          const aiResponse = await callGemini(systemPrompt, contents)

          if (aiResponse.functionCall && aiResponse.functionCall.name === 'update_knowledge_base') {
            const fact = aiResponse.functionCall.args?.fact || ''
            const result = await persistKnowledgeUpdate({
              fact,
              sourceMessage: message,
              userId,
              isAdmin,
            })
            finalMessage = result.message
          } else {
            finalMessage = aiResponse.text || 'Sorry, I could not generate a response.'
          }
        } catch (geminiErr) {
          const degraded =
            tryBuildLocalResponse(message, liveCtx) ??
            tryRagOnlyResponse(message, ragContext) ??
            (geminiErr instanceof GeminiRateLimitError
              ? buildRateLimitMessage(liveCtx, geminiErr.retryAfterSec)
              : undefined)

          if (degraded) {
            finalMessage = degraded
          } else {
            throw geminiErr
          }
        }
      }

      await prisma.chatMessage.createMany({
        data: [
          { userId, role: 'user', content: message, createdAt: now, expiresAt },
          { userId, role: 'assistant', content: finalMessage, createdAt: new Date(now.getTime() + 1), expiresAt },
        ],
      })

      return reply.send({
        message: finalMessage,
        timestamp: now.toISOString(),
      })
    } catch (err) {
      logger.error({ err, userId }, 'chat_route_error')
      if (err instanceof GeminiNotConfiguredError) {
        return reply.status(503).send({
          error: 'The AI assistant is not configured on the server. Please set GEMINI_API_KEY.',
        })
      }
      if (err instanceof GeminiRateLimitError) {
        return reply.status(503).send({ error: err.message })
      }
      return reply.status(500).send({ error: 'Failed to get AI response. Please try again.' })
    }
  })

  app.get('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    reply.header('Pragma', 'no-cache')
    reply.header('Expires', '0')

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

  app.delete('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    await prisma.chatMessage.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })
}
