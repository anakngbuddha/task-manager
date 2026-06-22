import fs from 'fs'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { getKnowledgeBasePath, ingestApprovedGlobalKnowledge } from '../src/services/rag.service.js'

dotenv.config()

const MARKER = '## User Corrections & Learned Knowledge'
const prisma = new PrismaClient()

function parseCorrections(markdown: string): string[] {
  const idx = markdown.indexOf(MARKER)
  if (idx < 0) return []

  const section = markdown.slice(idx + MARKER.length)
  const facts: string[] = []

  for (const line of section.split('\n')) {
    const match = line.match(/^-\s*\[[^\]]+\]\s*Learned from user:\s*(.+)\s*$/)
    if (match) {
      facts.push(match[1].trim())
    }
  }

  return facts
}

async function main() {
  const kbPath = getKnowledgeBasePath()
  const markdown = fs.readFileSync(kbPath, 'utf8')
  const facts = parseCorrections(markdown)

  if (facts.length === 0) {
    console.log('No corrections found in knowledge-base.md to migrate.')
    return
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.error('No admin user found. Create an admin before running migration.')
    process.exit(1)
  }

  console.log(`Migrating ${facts.length} fact(s) attributed to admin ${admin.email}`)

  const created: Array<{ id: string; fact: string }> = []

  for (const fact of facts) {
    const existing = await prisma.chatKnowledgeEntry.findFirst({
      where: { scope: 'GLOBAL', fact, status: 'APPROVED' },
    })
    if (existing) {
      console.log(`Skipping duplicate: ${fact}`)
      continue
    }

    const entry = await prisma.chatKnowledgeEntry.create({
      data: {
        userId: admin.id,
        fact,
        scope: 'GLOBAL',
        status: 'APPROVED',
        category: 'migration',
        sourceMessage: 'Migrated from knowledge-base.md',
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    })
    created.push({ id: entry.id, fact })
    console.log(`Created DB entry: ${fact}`)
  }

  if (created.length > 0 && process.env.PINECONE_API_KEY && process.env.GEMINI_API_KEY) {
    await ingestApprovedGlobalKnowledge(created)
    for (const entry of created) {
      await prisma.chatKnowledgeEntry.update({
        where: { id: entry.id },
        data: { pineconeId: `knowledge-${entry.id}` },
      })
    }
  } else {
    console.warn('Pinecone/Gemini not configured — skipped vector indexing.')
  }

  const stripped = markdown.slice(0, markdown.indexOf(MARKER)).trimEnd() + '\n'
  fs.writeFileSync(kbPath, stripped, 'utf8')
  console.log('Removed corrections section from knowledge-base.md')
  console.log('Migration complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
