import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { authenticate } from '../middlewares/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../app.js'
import { Pinecone } from '@pinecone-database/pinecone'

// ─── Gemini REST helper ────────────────────────────────────────────────────

// Sentinel error so the route can return a clear 503 when the server operator
// hasn't configured the API key (vs. a transient upstream failure → 502/500).
class GeminiNotConfiguredError extends Error {}

const GEMINI_MODEL = 'gemini-2.5-flash'

// Allow overriding the Gemini host with a proxy (e.g. Cloudflare Worker) to
// bypass region restrictions on the deployed backend. Mirrors the admin AI
// features (see adminIssues.ts / admin.routes.ts). Falls back to Google direct.
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
          name: "update_knowledge_base",
          description: "Appends a new fact or correction to the application's knowledge base documentation. Call this ONLY when the user explicitly corrects your understanding of how the app works, or gives you a new verifiable fact.",
          parameters: {
            type: "OBJECT",
            properties: {
              fact: { type: "STRING", description: "The concise, corrected fact to append." }
            },
            required: ["fact"]
          }
        }]
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

// ─── Build system prompt with app guide + user context ─────────────────────

function buildSystemPrompt(userContext: {
  name: string
  email: string
  projects: Array<{ name: string; role: string; taskCount: number }>
  pendingTasks: Array<{ title: string; priority: string; status: string; deadline: string | null; projectName: string }>
  overdueTasks: Array<{ title: string; priority: string; projectName: string; deadline: string }>
  upcomingSchedules: Array<{ title: string; type: string; scheduledAt: string; location: string | null; isVirtual: boolean }>
  currentTime: string
  ragContext: string
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
      // ── Fetch RAG Context (Parallel) ───────────────────────────────
      const ragPromise = (async () => {
        try {
          if (!process.env.PINECONE_API_KEY || !process.env.GEMINI_API_KEY) return ''
          const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
          const index = pc.index(process.env.PINECONE_INDEX || 'taskbot-rag')
          
          const embeddingUrl = `${process.env.GEMINI_PROXY_URL || 'https://generativelanguage.googleapis.com'}/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`
          const embedRes = await fetch(embeddingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/gemini-embedding-001',
              content: { parts: [{ text: message }] },
            })
          })
          if (!embedRes.ok) return ''
          const embedData = await embedRes.json() as any
          const vector = embedData.embedding?.values
          if (!vector) return ''

          const queryRes = await index.query({ vector, topK: 3, includeMetadata: true })
          return queryRes.matches.map(m => m.metadata?.text).filter(Boolean).join('\n\n')
        } catch (err) {
          logger.warn({ err }, 'rag_retrieval_failed')
          return ''
        }
      })()

      // ── Fetch live user context ─────────────────────────────────────
      const [user, memberships, pendingTasksRaw, overdueTasksRaw, upcomingSchedulesRaw, ragContext] = await Promise.all([
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
        ragPromise,
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
        ragContext: ragContext as string,
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
      let finalMessage = ''

      if (aiResponse.functionCall && aiResponse.functionCall.name === 'update_knowledge_base') {
        const fact = aiResponse.functionCall.args?.fact || 'New fact'
        const kbPath = path.join(process.cwd(), '../docs/knowledge-base.md')
        
        let kbContent = fs.readFileSync(kbPath, 'utf8')
        if (!kbContent.includes('## User Corrections & Learned Knowledge')) {
          kbContent += '\n\n## User Corrections & Learned Knowledge\n'
        }
        
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        kbContent += `- [${dateStr}] Learned from user: ${fact}\n`
        fs.writeFileSync(kbPath, kbContent, 'utf8')

        finalMessage = `Got it! I have learned this new information and permanently updated my knowledge base with:\n\n*${fact}*`
      } else {
        finalMessage = aiResponse.text || 'Sorry, I could not generate a response.'
      }

      // ── Persist both messages to DB ─────────────────────────────────
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
      return reply.status(500).send({ error: 'Failed to get AI response. Please try again.' })
    }
  })

  // GET /api/chat/history — Load persistent conversation history
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

  // DELETE /api/chat/history — Clear all chat history for the user
  app.delete('/chat/history', {
    preHandler: authenticate,
  }, async (req, reply) => {
    const userId = req.authUser.id
    await prisma.chatMessage.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })
}
