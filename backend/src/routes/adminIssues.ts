import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'
import { z } from 'zod'

export async function adminIssuesRoutes(app: FastifyInstance) {
  // Admin auth guard
  app.addHook('preValidation', async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any })
    if (!session) return reply.status(401).send({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden. Admin level required.' })
    }
  })

  // GET /admin/issues - Fetch recent errors
  app.get('/admin/issues', async (req, reply) => {
    const events = await prisma.analyticsEvent.findMany({
      where: { eventType: 'ERROR' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        issueAnalysis: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })
    return reply.send(events)
  })

  // POST /admin/issues/:id/analyze - Trigger AI analysis using Gemini
  app.post('/admin/issues/:id/analyze', async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.analyticsEvent.findUnique({
      where: { id, eventType: 'ERROR' },
      include: { issueAnalysis: true },
    })

    if (!event) return reply.status(404).send({ error: 'Error event not found' })

    if (event.issueAnalysis) {
      // Return cached analysis if already exists
      return reply.send(event.issueAnalysis)
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return reply.status(503).send({
        error: 'AI diagnosis is temporarily unavailable. The API key is not configured on the server.',
      })
    }

    // Prepare prompt
    const metadata = event.metadata as any
    const errorSource = event.elementId || 'Unknown Source'
    const errorMessage = metadata?.message || 'Unknown error'
    const errorStack = metadata?.stack || 'No stack trace available'

    const prompt = `
You are an expert system administrator and software engineer.
Analyze the following error log captured from our web application.
Identify the likely problem cause and provide a clear, actionable fix.

Source/Context: ${errorSource}
Error Message: ${errorMessage}
Stack Trace:
${errorStack}

Provide the response in the following strict JSON format without markdown wrapping:
{
  "cause": "A brief explanation of why this error occurred.",
  "fix": "Actionable steps to resolve the issue."
}
`

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API Error:', errorText)
        return reply.status(502).send({
          error: 'Failed to analyze error with AI. Verify the Gemini API key and model access on the server.',
        })
      }

      const data = await response.json()
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
      
      if (!textResponse) {
        return reply.status(500).send({ error: 'Received empty response from AI.' })
      }

      let parsed: { cause: string; fix: string }
      try {
        parsed = JSON.parse(textResponse)
      } catch (err) {
        // Strip markdown if AI accidentally included it
        const cleaned = textResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim()
        parsed = JSON.parse(cleaned)
      }

      // Save to database
      const issueAnalysis = await prisma.issueAnalysis.create({
        data: {
          analyticsEventId: id,
          cause: parsed.cause || 'Analysis unclear.',
          fix: parsed.fix || 'No fix suggested.',
        },
      })

      return reply.send(issueAnalysis)
    } catch (error) {
      console.error('AI Analysis failed:', error)
      return reply.status(500).send({ error: 'Internal server error during analysis.' })
    }
  })
}
