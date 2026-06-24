import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../app.js'
import { queryRagContext } from '../services/rag.service.js'
import { loadPersonalMemory, persistKnowledgeUpdate, addDirectKnowledge, deleteKnowledgeByName, updateKnowledgeByName } from '../services/knowledge.service.js'
import { DirectFactValidationError, DIRECT_FACT_MAX_LEN } from '../services/knowledgeGuard.service.js'
import { isAiTesterFeatureEnabled } from '../config/features.js'

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
  if (process.env.FALLBACK_GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY) return false
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
    /\b(my|pending)\s+(tasks?|todos?|to-?dos?|assignments?)\b/.test(lower) ||
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
    if (ctx.pendingTasks.length === 0 && ctx.overdueTasks.length === 0) {
      return 'You have **no pending tasks**! 🎉'
    }
    if (ctx.pendingTasks.length === 0 && ctx.overdueTasks.length > 0) {
      return `You have **no non-overdue tasks**, but you do have **${ctx.overdueTasks.length} overdue task(s)** that need attention.`
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

async function callGemini(apiKey: string | undefined, systemPrompt: string, contents: Array<{ role: string; parts: Array<any> }>): Promise<{ text?: string, functionCall?: any }> {
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

async function callOpenAICompatible(
  apiUrl: string,
  model: string,
  apiKey: string | undefined,
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<any> }>
): Promise<{ text?: string, functionCall?: any }> {
  if (!apiKey) throw new Error(`API key not configured for ${apiUrl}`)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...contents.map(c => ({
      role: c.role === 'model' ? 'assistant' : 'user',
      content: c.parts.map(p => p.text).join('\n')
    }))
  ]

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      tools: [{
        type: 'function',
        function: {
          name: 'update_knowledge_base',
          description: 'Proposes a fact or correction for the knowledge base. Call ONLY when the user explicitly corrects your understanding of how the app works, or gives you a new verifiable fact. The server validates and decides what gets stored.',
          parameters: {
            type: 'object',
            properties: {
              fact: { type: 'string', description: 'The concise, corrected fact to propose.' },
            },
            required: ['fact'],
          },
        }
      }],
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.95,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) {
      throw new GeminiRateLimitError(`Rate limited on ${apiUrl}`)
    }
    logger.error({ status: res.status, body: errText }, `openai_compatible_api_error_on_${apiUrl}`)
    throw new Error(`API error on ${apiUrl}: ${res.status}`)
  }

  const data = await res.json() as any
  const choice = data?.choices?.[0]?.message

  if (choice?.tool_calls?.length > 0) {
    const call = choice.tool_calls[0].function
    let args = {}
    try {
      args = JSON.parse(call.arguments)
    } catch {}
    return { functionCall: { name: call.name, args } }
  }

  return { text: choice?.content ?? 'Sorry, I could not generate a response.' }
}

async function callAiWithFallbacks(systemPrompt: string, contents: Array<{ role: string; parts: Array<any> }>): Promise<{ text?: string, functionCall?: any }> {
  // 1. Primary Gemini
  try {
    return await callGemini(process.env.GEMINI_API_KEY, systemPrompt, contents)
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError && !process.env.FALLBACK_GEMINI_API_KEY && !process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      throw err // No keys at all
    }
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Primary Gemini failed, falling back to secondary Gemini')
    
    // 2. Fallback Gemini
    try {
      if (process.env.FALLBACK_GEMINI_API_KEY) {
        return await callGemini(process.env.FALLBACK_GEMINI_API_KEY, systemPrompt, contents)
      }
      throw new Error('Fallback Gemini key not provided')
    } catch (err2) {
      logger.warn({ err: err2 instanceof Error ? err2.message : String(err2) }, 'Fallback Gemini failed, falling back to Groq')
      
      // 3. Groq
      try {
        if (process.env.GROQ_API_KEY) {
          return await callOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            'llama-3.3-70b-versatile',
            process.env.GROQ_API_KEY,
            systemPrompt,
            contents
          )
        }
        throw new Error('Groq key not provided')
      } catch (err3) {
        logger.warn({ err: err3 instanceof Error ? err3.message : String(err3) }, 'Groq failed, falling back to Cerebras')
        
        // 4. Cerebras
        try {
          if (process.env.CEREBRAS_API_KEY) {
            return await callOpenAICompatible(
              'https://api.cerebras.ai/v1/chat/completions',
              'gpt-oss-120b',
              process.env.CEREBRAS_API_KEY,
              systemPrompt,
              contents
            )
          }
          throw new Error('Cerebras key not provided')
        } catch (err4) {
          logger.error({ err: err4 instanceof Error ? err4.message : String(err4) }, 'All AI providers failed')
          throw err // Bubble up the first error so the degraded response logic triggers properly
        }
      }
    }
  }
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
${userContext.pendingTasks.length === 0 && userContext.overdueTasks.length === 0
  ? '- No pending tasks 🎉'
  : userContext.pendingTasks.length === 0
    ? '- No non-overdue pending tasks.'
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
- You are TaskBot. You are NOT Gemini, ChatGPT, or Claude. You are NOT trained by Google or OpenAI. Never claim otherwise.
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
  sessionId: z.string().optional(),
})

const KNOWLEDGE_NAME_REGEX = /^[a-z0-9][a-z0-9\-_]{0,63}$/

function parseNamedFactCommand(message: string, command: '/add' | '/update'): { name: string; fact: string } | null {
  const trimmed = message.trimStart()
  const prefix = `${command} `
  if (!trimmed.toLowerCase().startsWith(prefix)) return null

  const rest = trimmed.slice(prefix.length)
  const nameMatch = rest.match(/^([a-z0-9][a-z0-9\-_]{0,63})\b/)
  if (!nameMatch) return null

  const name = nameMatch[1]
  const factStart = (nameMatch.index ?? 0) + name.length
  const fact = rest.slice(factStart).replace(/^\s+/, '')
  return { name, fact }
}

function parseDeleteCommand(message: string): string | null {
  const trimmed = message.trimStart()
  if (!trimmed.toLowerCase().startsWith('/delete ')) return null
  const name = trimmed.slice('/delete '.length).trim().split(/\s+/)[0]
  return name || null
}

async function resolveChatSession(
  userId: string,
  providedSessionId: string | undefined,
  expiresAt: Date,
  defaultTopic: string,
): Promise<{ sessionId: string; isNewSession: boolean }> {
  if (providedSessionId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: providedSessionId, userId },
    })
    if (!session) {
      throw new Error('SESSION_NOT_FOUND')
    }
    await prisma.chatSession.update({
      where: { id: providedSessionId },
      data: { expiresAt },
    })
    return { sessionId: providedSessionId, isNewSession: false }
  }

  const newSession = await prisma.chatSession.create({
    data: {
      userId,
      expiresAt,
      topic: defaultTopic,
    },
  })
  return { sessionId: newSession.id, isNewSession: true }
}

async function persistCommandExchange(
  userId: string,
  sessionId: string,
  command: string,
  response: string,
  now: Date,
): Promise<void> {
  await prisma.chatMessage.createMany({
    data: [
      { userId, sessionId, role: 'user', content: command, createdAt: now },
      { userId, sessionId, role: 'assistant', content: response, createdAt: new Date(now.getTime() + 1) },
    ],
  })
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: now },
  })
}

async function sendCommandReply(
  reply: any,
  params: {
    userId: string
    providedSessionId?: string
    command: string
    response: string
    now: Date
    expiresAt: Date
  },
) {
  const { sessionId } = await resolveChatSession(
    params.userId,
    params.providedSessionId,
    params.expiresAt,
    'Knowledge Command',
  )
  await persistCommandExchange(params.userId, sessionId, params.command, params.response, params.now)
  return reply.send({
    sessionId,
    message: params.response,
    timestamp: params.now.toISOString(),
  })
}

export async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', {
    preHandler: authenticate,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { message, sessionId: providedSessionId } = sendMessageSchema.parse(req.body)
    const userId = req.authUser.id
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    try {
      const userObj = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      const role = userObj?.role || 'USER'
      const actor = { userId, role }

      if (message.startsWith('/') && isAiTesterFeatureEnabled()) {
        try {
          const parts = message.trim().split(/\s+/)
          const cmd = parts[0].toLowerCase()

          if (cmd === '/add') {
            const parsed = parseNamedFactCommand(message, '/add')
            if (!parsed?.name) throw new Error('Usage: /add <name> <fact>')
            if (!KNOWLEDGE_NAME_REGEX.test(parsed.name)) return reply.status(400).send({ error: 'INVALID_NAME' })
            if (!parsed.fact) return reply.status(400).send({ error: 'INVALID_FACT' })
            if (parsed.fact.length > DIRECT_FACT_MAX_LEN) return reply.status(400).send({ error: 'INVALID_FACT' })

            await addDirectKnowledge(actor, parsed.name, parsed.fact)
            const scopeLabel = role === 'AI_TESTER' || role === 'ADMIN' ? 'global' : 'personal'
            const statusMsg = role === 'AI_TESTER' ? ' (pending admin approval)' : role === 'ADMIN' ? ' (live for all users)' : ''
            const response = `✅ Knowledge entry \`${parsed.name}\` added to **${scopeLabel}** scope${statusMsg}.`
            return sendCommandReply(reply, {
              userId,
              providedSessionId,
              command: message,
              response,
              now,
              expiresAt,
            })
          }

          if (cmd === '/delete') {
            const name = parseDeleteCommand(message)
            if (!name) throw new Error('Usage: /delete <name>')
            if (!KNOWLEDGE_NAME_REGEX.test(name)) return reply.status(400).send({ error: 'INVALID_NAME' })

            await deleteKnowledgeByName(actor, name)
            const response = `🗑️ Knowledge entry \`${name}\` deleted successfully.`
            return sendCommandReply(reply, {
              userId,
              providedSessionId,
              command: message,
              response,
              now,
              expiresAt,
            })
          }

          if (cmd === '/update') {
            const parsed = parseNamedFactCommand(message, '/update')
            if (!parsed?.name) throw new Error('Usage: /update <name> <new fact>')
            if (!KNOWLEDGE_NAME_REGEX.test(parsed.name)) return reply.status(400).send({ error: 'INVALID_NAME' })
            if (!parsed.fact) return reply.status(400).send({ error: 'INVALID_FACT' })
            if (parsed.fact.length > DIRECT_FACT_MAX_LEN) return reply.status(400).send({ error: 'INVALID_FACT' })

            await updateKnowledgeByName(actor, parsed.name, parsed.fact)
            const response = `✅ Knowledge entry \`${parsed.name}\` updated successfully.`
            return sendCommandReply(reply, {
              userId,
              providedSessionId,
              command: message,
              response,
              now,
              expiresAt,
            })
          }

          if (cmd === '/knowledge-list') {
            const listWhere =
              role === 'ADMIN'
                ? { scope: 'GLOBAL' as const }
                : { userId }

            const entries = await prisma.chatKnowledgeEntry.findMany({
              where: listWhere,
              select: { name: true, scope: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 50,
            })

            const response =
              entries.length === 0
                ? 'No knowledge entries found.'
                : `Your accessible knowledge entries:\n\n${entries
                    .map((e) => `- **${e.name || 'unnamed'}** (${e.scope}, ${e.status})`)
                    .join('\n')}`

            return sendCommandReply(reply, {
              userId,
              providedSessionId,
              command: message,
              response,
              now,
              expiresAt,
            })
          }

          if (cmd === '/knowledge-help') {
            const response =
              '**Available Commands:**\n' +
              '- `/add <name> <fact>`\n' +
              '- `/delete <name>`\n' +
              '- `/update <name> <new fact>`\n' +
              '- `/knowledge-list`\n' +
              '- `/knowledge-help`'
            return sendCommandReply(reply, {
              userId,
              providedSessionId,
              command: message,
              response,
              now,
              expiresAt,
            })
          }

          return reply.status(400).send({ error: 'UNKNOWN_COMMAND' })
        } catch (err: any) {
          if (err instanceof DirectFactValidationError) {
            return reply.status(400).send({ error: err.message })
          }
          if (err.message === 'KNOWLEDGE_NAME_EXISTS') {
            return reply.status(409).send({ error: 'A knowledge entry with this name already exists.' })
          }
          if (err.message === 'KNOWLEDGE_NOT_FOUND') {
            return reply.status(404).send({ error: 'No knowledge entry found with that name that you can access.' })
          }
          if (err.message === 'SESSION_NOT_FOUND') {
            return reply.status(404).send({ error: 'Session not found or unauthorized.' })
          }
          return reply.status(400).send({ error: err.message })
        }
      }

      if (message.startsWith('/') && !isAiTesterFeatureEnabled()) {
        return reply.status(403).send({ error: 'Knowledge commands are not enabled on this server.' })
      }

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

      let sessionId = providedSessionId
      let isNewSession = false

      if (sessionId) {
        const session = await prisma.chatSession.findFirst({
          where: { id: sessionId, userId }
        })
        if (!session) {
          return reply.status(404).send({ error: 'Session not found or unauthorized.' })
        }
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { expiresAt }
        })
      } else {
        const newSession = await prisma.chatSession.create({
          data: {
            userId,
            expiresAt,
            topic: 'New Chat'
          }
        })
        sessionId = newSession.id
        isNewSession = true
      }

      const historyRows = await prisma.chatMessage.findMany({
        where: { sessionId },
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
          const aiResponse = await callAiWithFallbacks(systemPrompt, contents)

          if (aiResponse.functionCall && aiResponse.functionCall.name === 'update_knowledge_base') {
            const fact = aiResponse.functionCall.args?.fact || ''
            const result = await persistKnowledgeUpdate({
              fact,
              sourceMessage: message,
              userId,
              isAdmin,
              userRole: user?.role
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
          { userId, sessionId, role: 'user', content: message, createdAt: now },
          { userId, sessionId, role: 'assistant', content: finalMessage, createdAt: new Date(now.getTime() + 1) },
        ],
      })

      if (isNewSession) {
        // Generate topic asynchronously
        const generateTopicPrompt = `Generate a concise, 2-4 word topic for this chat based on the following first message. Respond ONLY with the topic.\n\nUser: ${message}`
        callAiWithFallbacks(generateTopicPrompt, [{ role: 'user', parts: [{ text: generateTopicPrompt }] }])
          .then(res => {
            const topic = res.text?.trim().replace(/^["']|["']$/g, '').substring(0, 200) || 'New Chat'
            return prisma.chatSession.update({
              where: { id: sessionId! },
              data: { topic }
            })
          })
          .catch(err => logger.error({ err }, 'failed_to_generate_topic'))
      }

      return reply.send({
        sessionId,
        message: finalMessage,
        timestamp: now.toISOString(),
      })
    } catch (err: any) {
      logger.error({ err, userId }, 'chat_route_error')
      if (err instanceof GeminiNotConfiguredError || err.message === 'GEMINI_NOT_CONFIGURED') {
        return reply.status(503).send({
          error: 'The AI assistant is not configured on the server. Please set GEMINI_API_KEY.',
        })
      }
      if (err.message === 'GROQ_NOT_CONFIGURED') {
        return reply.status(503).send({ error: 'Groq API key is not configured.' })
      }
      if (err.message === 'CEREBRAS_NOT_CONFIGURED') {
        return reply.status(503).send({ error: 'Cerebras API key is not configured.' })
      }
      if (err instanceof GeminiRateLimitError) {
        return reply.status(503).send({ error: err.message })
      }
      return reply.status(500).send({ error: err.message || 'Failed to get AI response. Please try again.' })
    }
  })

  app.get('/chat/sessions', {
    preHandler: authenticate,
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    const userId = req.authUser.id
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        topic: true,
        updatedAt: true,
      },
      take: 100,
    })
    return reply.send({ sessions })
  })

  app.get('/chat/sessions/:sessionId/messages', {
    preHandler: authenticate,
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    const userId = req.authUser.id
    const { sessionId } = req.params as { sessionId: string }
    const { limit } = req.query as { limit?: string }
    const take = Math.min(parseInt(limit || '50', 10), 100)

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    })

    if (!session) {
      return reply.status(404).send({ error: 'Session not found.' })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
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

  app.delete('/chat/sessions/:sessionId', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    const { sessionId } = req.params as { sessionId: string }
    await prisma.chatSession.deleteMany({
      where: { id: sessionId, userId }
    })
    return reply.status(204).send()
  })

  app.delete('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    await prisma.chatSession.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })
}
