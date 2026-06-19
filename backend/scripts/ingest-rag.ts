import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Pinecone } from '@pinecone-database/pinecone'
import dotenv from 'dotenv'

dotenv.config()

const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'taskbot-rag'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || 'https://generativelanguage.googleapis.com'

if (!PINECONE_API_KEY || !GEMINI_API_KEY) {
  console.error('Error: PINECONE_API_KEY and GEMINI_API_KEY must be set in .env')
  process.exit(1)
}

const pc = new Pinecone({ apiKey: PINECONE_API_KEY })

/**
 * Call Gemini to get an embedding vector (3072 dimensions for gemini-embedding-001)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const url = `${GEMINI_PROXY_URL}/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini embedding failed: ${response.status} ${errText}`)
  }

  const data = await response.json()
  return data.embedding.values
}

/**
 * Splits markdown content by headings (##)
 */
function chunkMarkdown(markdown: string): Array<{ id: string, text: string, metadata: any }> {
  // Simple heuristic: split by top-level or secondary headings
  const sections = markdown.split(/\n(?=## )/g)
  
  return sections.map((section, index) => {
    const lines = section.trim().split('\n')
    // First line is usually the heading
    const headingMatch = lines[0].match(/^#+\s*(.*)/)
    const title = headingMatch ? headingMatch[1].trim() : `Section ${index + 1}`
    
    return {
      id: `chunk-${index}`,
      text: section.trim(),
      metadata: {
        title,
        source: 'knowledge-base.md'
      }
    }
  }).filter(chunk => chunk.text.length > 10) // Filter out empty chunks
}

async function main() {
  console.log('1. Reading knowledge-base.md...')
  const docPath = path.join(process.cwd(), '../docs/knowledge-base.md')
  const markdown = fs.readFileSync(docPath, 'utf8')

  const currentHash = crypto.createHash('sha256').update(markdown).digest('hex')
  const hashPath = path.join(process.cwd(), '.rag-hash')
  
  if (fs.existsSync(hashPath)) {
    const previousHash = fs.readFileSync(hashPath, 'utf8').trim()
    if (previousHash === currentHash) {
      console.log('✅ No changes detected in knowledge-base.md. Skipping embedding to save API calls.')
      return
    }
  }

  console.log('2. Chunking document...')
  const chunks = chunkMarkdown(markdown)
  console.log(`   -> Created ${chunks.length} chunks.`)

  console.log(`3. Checking if Pinecone index '${PINECONE_INDEX_NAME}' exists...`)
  const indexListResponse = await pc.listIndexes()
  const indexNames = indexListResponse.indexes?.map(i => i.name) || []
  
  if (!indexNames.includes(PINECONE_INDEX_NAME)) {
    console.log(`   -> Creating index '${PINECONE_INDEX_NAME}' (this may take a minute)...`)
    await pc.createIndex({
      name: PINECONE_INDEX_NAME,
      dimension: 3072, // gemini-embedding-001 outputs 3072 dimensions
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1' // Default region for free tier
        }
      }
    })
    console.log('   -> Index created successfully.')
    // Wait a few seconds for the index to be fully initialized on Pinecone's backend
    await new Promise(resolve => setTimeout(resolve, 5000))
  } else {
    console.log('   -> Index already exists.')
  }

  const index = pc.index(PINECONE_INDEX_NAME)

  console.log('4. Generating embeddings and upserting to Pinecone...')
  
  const vectors = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`   -> Embedding chunk ${i + 1}/${chunks.length}: "${chunk.metadata.title}"`)
    try {
      const embedding = await generateEmbedding(chunk.text)
      vectors.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          text: chunk.text,
          ...chunk.metadata
        }
      })
    } catch (err: any) {
      console.error(`      Failed to embed chunk ${i + 1}:`, err.message)
    }
    // Rate limit safeguard: sleep 200ms
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  if (vectors.length > 0) {
    console.log(`5. Upserting ${vectors.length} vectors to Pinecone...`)
    await index.upsert({ records: vectors })
    
    // Save the new hash to avoid re-embedding next time
    fs.writeFileSync(hashPath, currentHash, 'utf8')
    console.log('✅ Ingestion complete and new hash saved!')
  } else {
    console.log('❌ No vectors were generated.')
  }
}

main().catch(console.error)
