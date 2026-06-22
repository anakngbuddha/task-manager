import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Pinecone } from '@pinecone-database/pinecone'

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'taskbot-rag'
const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || 'https://generativelanguage.googleapis.com'

function getPinecone(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) return null
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
}

function getGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY || null
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = getGeminiKey()
  if (!apiKey) return null

  const url = `${GEMINI_PROXY_URL}/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.warn('rag_embedding_failed', response.status, errText)
    return null
  }

  const data = await response.json() as { embedding?: { values?: number[] } }
  return data.embedding?.values ?? null
}

export async function queryRagContext(message: string, topK = 3): Promise<string> {
  try {
    const pc = getPinecone()
    const apiKey = getGeminiKey()
    if (!pc || !apiKey) return ''

    const vector = await generateEmbedding(message)
    if (!vector) return ''

    const index = pc.index(PINECONE_INDEX_NAME)
    const queryRes = await index.query({ vector, topK, includeMetadata: true })
    return queryRes.matches
      .map(m => m.metadata?.text)
      .filter(Boolean)
      .join('\n\n')
  } catch (err) {
    console.warn('rag_retrieval_failed', err)
    return ''
  }
}

export async function upsertKnowledgeVector(
  id: string,
  fact: string,
  metadata: Record<string, string | number | boolean> = {},
): Promise<string | null> {
  const pc = getPinecone()
  if (!pc) {
    console.warn('pinecone_not_configured')
    return null
  }

  const embedding = await generateEmbedding(fact)
  if (!embedding) return null

  const pineconeId = `knowledge-${id}`
  const index = pc.index(PINECONE_INDEX_NAME)
  await index.upsert({
    records: [{
      id: pineconeId,
      values: embedding,
      metadata: {
        text: fact,
        source: 'chat-knowledge',
        scope: 'global',
        ...metadata,
      },
    }],
  })

  return pineconeId
}

export async function deleteKnowledgeVector(pineconeId: string): Promise<void> {
  const pc = getPinecone()
  if (!pc) return

  try {
    const index = pc.index(PINECONE_INDEX_NAME)
    await index.deleteOne({ id: pineconeId })
  } catch (err) {
    console.warn('rag_delete_failed', pineconeId, err)
  }
}

function chunkMarkdown(markdown: string): Array<{ id: string; text: string; metadata: Record<string, string> }> {
  const sections = markdown.split(/\n(?=## )/g)

  return sections.map((section, index) => {
    const lines = section.trim().split('\n')
    const headingMatch = lines[0].match(/^#+\s*(.*)/)
    const title = headingMatch ? headingMatch[1].trim() : `Section ${index + 1}`

    return {
      id: `chunk-${index}`,
      text: section.trim(),
      metadata: {
        title,
        source: 'knowledge-base.md',
      },
    }
  }).filter(chunk => chunk.text.length > 10)
}

export function getKnowledgeBasePath(): string {
  return path.join(process.cwd(), '../docs/knowledge-base.md')
}

export async function ingestCanonicalDocs(): Promise<void> {
  const pc = getPinecone()
  const apiKey = getGeminiKey()
  if (!pc || !apiKey) {
    console.error('Error: PINECONE_API_KEY and GEMINI_API_KEY must be set')
    process.exit(1)
  }

  const docPath = getKnowledgeBasePath()
  const markdown = fs.readFileSync(docPath, 'utf8')

  const currentHash = crypto.createHash('sha256').update(markdown).digest('hex')
  const hashPath = path.join(process.cwd(), '.rag-hash')

  if (fs.existsSync(hashPath)) {
    const previousHash = fs.readFileSync(hashPath, 'utf8').trim()
    if (previousHash === currentHash) {
      console.log('No changes detected in knowledge-base.md. Skipping embedding.')
      return
    }
  }

  const chunks = chunkMarkdown(markdown)
  console.log(`Created ${chunks.length} chunks from knowledge-base.md`)

  const indexListResponse = await pc.listIndexes()
  const indexNames = indexListResponse.indexes?.map(i => i.name) || []

  if (!indexNames.includes(PINECONE_INDEX_NAME)) {
    console.log(`Creating index '${PINECONE_INDEX_NAME}'...`)
    await pc.createIndex({
      name: PINECONE_INDEX_NAME,
      dimension: 3072,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    })
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  const index = pc.index(PINECONE_INDEX_NAME)
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, string> }> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Embedding chunk ${i + 1}/${chunks.length}: "${chunk.metadata.title}"`)
    try {
      const embedding = await generateEmbedding(chunk.text)
      if (embedding) {
        vectors.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            text: chunk.text,
            ...chunk.metadata,
          },
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to embed chunk ${i + 1}:`, message)
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  if (vectors.length > 0) {
    await index.upsert({ records: vectors })
    fs.writeFileSync(hashPath, currentHash, 'utf8')
    console.log('Canonical docs ingestion complete.')
  }
}

export async function ingestApprovedGlobalKnowledge(
  entries: Array<{ id: string; fact: string }>,
): Promise<void> {
  for (const entry of entries) {
    const pineconeId = await upsertKnowledgeVector(entry.id, entry.fact)
    if (pineconeId) {
      console.log(`Indexed global knowledge: ${entry.id}`)
    }
  }
}
