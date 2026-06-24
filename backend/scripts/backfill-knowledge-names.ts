import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting backfill for ChatKnowledgeEntry names...')
  
  const entries = await prisma.chatKnowledgeEntry.findMany({
    where: { name: null },
  })

  console.log(`Found ${entries.length} entries without a name.`)

  let updated = 0
  for (const entry of entries) {
    // Generate a slug from the fact (first 5 words)
    const words = entry.fact.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)
    let slug = words.slice(0, 5).join('-').toLowerCase()
    
    // Ensure slug meets regex ^[a-z0-9][a-z0-9\-_]{0,63}$
    if (!slug) {
      slug = `entry-${entry.id.slice(-5)}`
    }
    if (!/^[a-z0-9]/.test(slug)) {
      slug = `k-${slug}`
    }
    slug = slug.substring(0, 64)

    // Handle uniqueness per user
    let uniqueSlug = slug
    let counter = 1
    let isUnique = false

    while (!isUnique) {
      const existing = await prisma.chatKnowledgeEntry.findUnique({
        where: {
          name_userId: {
            name: uniqueSlug,
            userId: entry.userId,
          },
        },
      })
      if (existing) {
        uniqueSlug = `${slug.substring(0, 59)}-${counter}`
        counter++
      } else {
        isUnique = true
      }
    }

    await prisma.chatKnowledgeEntry.update({
      where: { id: entry.id },
      data: { name: uniqueSlug },
    })
    updated++
  }

  console.log(`Successfully backfilled ${updated} entries.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
