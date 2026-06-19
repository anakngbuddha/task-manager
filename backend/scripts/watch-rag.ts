import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const docPath = path.join(process.cwd(), '../docs/knowledge-base.md')
const scriptPath = path.join(process.cwd(), 'scripts/ingest-rag.ts')

console.log(`👁️  Watching for changes in: ${docPath}`)

let isRunning = false
let pendingRun = false

function runIngest() {
  if (isRunning) {
    pendingRun = true
    return
  }

  isRunning = true
  console.log('\n🔄 Detected change in knowledge-base.md. Running RAG ingestion...')
  
  // Use ts-node (or whatever executes typescript) to run the script
  // In our case we can run it exactly as they normally do: npx ts-node
  const child = spawn('npx', ['ts-node', scriptPath], {
    stdio: 'inherit',
    shell: true,
  })

  child.on('close', (code) => {
    isRunning = false
    if (code !== 0) {
      console.error(`❌ Ingestion script failed with exit code ${code}`)
    } else {
      console.log('✅ Ingestion check completed.')
    }

    if (pendingRun) {
      pendingRun = false
      runIngest()
    }
  })
}

// Ensure the file exists before watching
if (fs.existsSync(docPath)) {
  // Use debounce to prevent multiple triggers from a single save
  let timeout: NodeJS.Timeout
  fs.watch(docPath, (eventType) => {
    if (eventType === 'change') {
      clearTimeout(timeout)
      timeout = setTimeout(runIngest, 500) // 500ms debounce
    }
  })
  
  // Also run once at startup just to ensure it's in sync!
  runIngest()
} else {
  console.error(`❌ Cannot watch ${docPath}: File does not exist.`)
}
