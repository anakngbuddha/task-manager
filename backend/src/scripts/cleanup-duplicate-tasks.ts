import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Finding duplicate tasks by (projectId, title)...')

  // We find all tasks and group them
  const allTasks = await prisma.task.findMany({
    select: { id: true, title: true, projectId: true },
  })

  // Group by projectId_title
  const grouped = new Map<string, typeof allTasks>()
  for (const task of allTasks) {
    const key = `${task.projectId}_${task.title}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(task)
  }

  let fixedCount = 0

  for (const [key, tasks] of grouped.entries()) {
    if (tasks.length > 1) {
      console.log(`Found ${tasks.length} tasks with title "${tasks[0].title}" in project ${tasks[0].projectId}`)
      
      // Keep the first one as is, rename the rest
      for (let i = 1; i < tasks.length; i++) {
        const task = tasks[i]
        const newTitle = `${task.title} (Duplicate ${i})`
        console.log(`  Renaming task ${task.id} to "${newTitle}"`)
        
        await prisma.task.update({
          where: { id: task.id },
          data: { title: newTitle },
        })
        fixedCount++
      }
    }
  }

  console.log(`\nCleanup complete! Fixed ${fixedCount} duplicate task titles.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
