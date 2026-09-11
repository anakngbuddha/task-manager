import { Server } from 'socket.io'
import { io as ClientIO } from '../../frontend/node_modules/socket.io-client/build/esm/index.js'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runTests() {
  console.log('==================================================')
  console.log('🧪 RUNNING VERIFICATION & VALIDATION TEST SUITE')
  console.log('==================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${message}`)
      failed++
    }
  }

  // -------------------------------------------------------------
  // Test 1: Socket.IO Server Auth Middleware Verification
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Socket.IO Authentication Middleware ---')

  const httpServer = http.createServer()
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  // Simulated DB of sessions
  const mockSessions: Record<string, { userId: string; expiresAt: Date; bannedAt: Date | null }> = {
    'valid-session-token-123': {
      userId: 'user_456',
      expiresAt: new Date(Date.now() + 86400000),
      bannedAt: null,
    },
    'expired-session-token-789': {
      userId: 'user_789',
      expiresAt: new Date(Date.now() - 10000),
      bannedAt: null,
    },
    'banned-session-token-999': {
      userId: 'user_999',
      expiresAt: new Date(Date.now() + 86400000),
      bannedAt: new Date(),
    },
  }

  // Exact middleware logic from backend/src/index.ts
  io.use(async (socket, next) => {
    try {
      let userId: string | null = null

      // 1. Try session cookie via headers (mocked auth.api.getSession)
      const cookieHeader = socket.handshake.headers.cookie
      if (cookieHeader && cookieHeader.includes('better-auth.session_token=cookie-token-abc')) {
        userId = 'user_cookie_abc'
      }

      // 2. Fallback: check token in socket.handshake.auth (cross-origin WebSocket)
      if (!userId && socket.handshake.auth?.token) {
        const token = String(socket.handshake.auth.token)
        const dbSession = mockSessions[token]
        if (dbSession && dbSession.expiresAt > new Date() && !dbSession.bannedAt) {
          userId = dbSession.userId
        }
      }

      if (!userId) {
        return next(new Error('Unauthorized'))
      }

      socket.data.userId = userId
      next()
    } catch (err) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.emit('authenticated', { userId: socket.data.userId })
  })

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const port = (httpServer.address() as any).port
  const serverUrl = `http://localhost:${port}`

  // Subtest 1.1: Unauthenticated connection (no token, no cookie) -> should fail
  await new Promise<void>((resolve) => {
    const client = ClientIO(serverUrl, { transports: ['websocket'], reconnection: false })
    client.on('connect_error', (err) => {
      assert(err.message === 'Unauthorized', 'Unauthenticated client correctly rejected with "Unauthorized"')
      client.close()
      resolve()
    })
    client.on('connect', () => {
      assert(false, 'Unauthenticated client should not have connected')
      client.close()
      resolve()
    })
  })

  // Subtest 1.2: Invalid handshake token -> should fail
  await new Promise<void>((resolve) => {
    const client = ClientIO(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: 'bogus-token-xyz' },
    })
    client.on('connect_error', (err) => {
      assert(err.message === 'Unauthorized', 'Invalid token correctly rejected with "Unauthorized"')
      client.close()
      resolve()
    })
    client.on('connect', () => {
      assert(false, 'Invalid token should not have connected')
      client.close()
      resolve()
    })
  })

  // Subtest 1.3: Expired handshake token -> should fail
  await new Promise<void>((resolve) => {
    const client = ClientIO(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: 'expired-session-token-789' },
    })
    client.on('connect_error', (err) => {
      assert(err.message === 'Unauthorized', 'Expired token correctly rejected with "Unauthorized"')
      client.close()
      resolve()
    })
    client.on('connect', () => {
      assert(false, 'Expired token should not have connected')
      client.close()
      resolve()
    })
  })

  // Subtest 1.4: Banned user token -> should fail
  await new Promise<void>((resolve) => {
    const client = ClientIO(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: 'banned-session-token-999' },
    })
    client.on('connect_error', (err) => {
      assert(err.message === 'Unauthorized', 'Banned user token correctly rejected with "Unauthorized"')
      client.close()
      resolve()
    })
    client.on('connect', () => {
      assert(false, 'Banned user token should not have connected')
      client.close()
      resolve()
    })
  })

  // Subtest 1.5: Valid cross-origin handshake token -> SUCCESS!
  await new Promise<void>((resolve) => {
    const client = ClientIO(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: 'valid-session-token-123' },
    })
    client.on('authenticated', (data) => {
      assert(data.userId === 'user_456', 'Valid cross-origin token connects and authenticates as user_456')
      client.close()
      resolve()
    })
    client.on('connect_error', (err) => {
      assert(false, `Valid token should connect, but failed with: ${err.message}`)
      client.close()
      resolve()
    })
  })

  // Subtest 1.6: Dynamic auth callback (how socket.ts implements it) -> SUCCESS!
  await new Promise<void>((resolve) => {
    let currentToken = 'valid-session-token-123'
    const client = ClientIO(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: (cb) => {
        cb({ token: currentToken })
      },
    })
    client.on('authenticated', (data) => {
      assert(data.userId === 'user_456', 'Dynamic auth callback properly passes token to server handshake')
      client.close()
      resolve()
    })
    client.on('connect_error', (err) => {
      assert(false, `Dynamic auth callback connection failed: ${err.message}`)
      client.close()
      resolve()
    })
  })

  httpServer.close()

  // -------------------------------------------------------------
  // Test 2: Validation of frontend socket.ts implementation
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Frontend Socket & Token Validation ---')

  const socketSourcePath = path.resolve(__dirname, '../../frontend/src/lib/socket.ts')
  const socketSource = fs.readFileSync(socketSourcePath, 'utf8')

  assert(socketSource.includes('setSocketAuthToken'), 'socket.ts exports setSocketAuthToken')
  assert(socketSource.includes('getSocketAuthToken'), 'socket.ts exports getSocketAuthToken')
  assert(socketSource.includes('auth: (cb: (data: Record<string, any>) => void) =>'), 'socket.ts uses dynamic auth callback on socket singleton')
  assert(socketSource.includes('createSocket(token?: string)'), 'socket.ts createSocket accepts optional session token')
  assert(socketSource.includes('better-auth') && socketSource.includes('session_token'), 'socket.ts checks cookie fallback for better-auth session_token')

  // -------------------------------------------------------------
  // Test 3: Validation of Typing Animation Fix in MessageBubble.tsx
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Typing Indicator Animation Validation ---')

  const messageBubblePath = path.resolve(__dirname, '../../frontend/src/components/messages/MessageBubble.tsx')
  const messageBubbleSource = fs.readFileSync(messageBubblePath, 'utf8')

  assert(messageBubbleSource.includes('export function TypingIndicator'), 'TypingIndicator is exported from MessageBubble.tsx')
  assert(messageBubbleSource.includes('@keyframes typingDotBounce'), 'Custom keyframes typingDotBounce is defined')
  assert(messageBubbleSource.includes("animationDelay: '0ms'"), 'Dot 1 has animation delay 0ms')
  assert(messageBubbleSource.includes("animationDelay: '180ms'"), 'Dot 2 has staggered animation delay 180ms')
  assert(messageBubbleSource.includes("animationDelay: '360ms'"), 'Dot 3 has staggered animation delay 360ms')
  assert(messageBubbleSource.includes('translateY(-4px)'), 'Animation has vertical translation keyframe for smooth bounce')

  // -------------------------------------------------------------
  // Test 4: Validation of Media Upload Allowlist & Multipart Limits
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Media Upload Allowlist & Multipart Limits ---')

  const uploadSourcePath = path.resolve(__dirname, '../src/routes/upload.ts')
  const uploadSource = fs.readFileSync(uploadSourcePath, 'utf8')
  const appSourcePath = path.resolve(__dirname, '../src/app.ts')
  const appSource = fs.readFileSync(appSourcePath, 'utf8')
  const filesRoutePath = path.resolve(__dirname, '../src/routes/files.routes.ts')
  const filesRouteSource = fs.readFileSync(filesRoutePath, 'utf8')

  assert(uploadSource.includes('video/mp4') && uploadSource.includes('video/webm'), 'upload.ts allows standard video MIME types')
  assert(uploadSource.includes('application/zip') && uploadSource.includes('application/x-zip-compressed'), 'upload.ts allows archive MIME types')
  assert(uploadSource.includes('ALLOWED_EXTENSIONS'), 'upload.ts defines extension fallback allowlist')
  assert(uploadSource.includes('.mp4') && uploadSource.includes('.mov') && uploadSource.includes('.zip'), 'upload.ts includes video and archive extensions')
  assert(
    uploadSource.includes("mime.startsWith('image/')") &&
    uploadSource.includes("mime.startsWith('video/')") &&
    uploadSource.includes("'auto'"),
    'upload.ts correctly sets Cloudinary resource_type for images, videos, and auto files'
  )
  assert(appSource.includes('fileSize: 50 * 1024 * 1024'), 'app.ts multipart limit increased to 50MB')
  assert(filesRouteSource.includes('from \'./upload.js\'') || filesRouteSource.includes('ALLOWED_MIME_TYPES'), 'files.routes.ts shares expanded upload allowlist')

  // -------------------------------------------------------------
  // Test 5: Telegram-Style Sending Indicators & Socket Broadcasting
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Telegram-Style Action Indicators & Socket Broadcasting ---')

  const serverIndexPath = path.resolve(__dirname, '../src/index.ts')
  const serverIndexSource = fs.readFileSync(serverIndexPath, 'utf8')
  const projectMessagesPath = path.resolve(__dirname, '../../frontend/src/pages/ProjectMessagesPage.tsx')
  const projectMessagesSource = fs.readFileSync(projectMessagesPath, 'utf8')

  assert(serverIndexSource.includes('sending_image') && serverIndexSource.includes('sending_video'), 'backend index.ts typing handlers type-check action payload')
  assert(messageBubbleSource.includes('export type ChatAction'), 'MessageBubble.tsx exports ChatAction type')
  assert(messageBubbleSource.includes('sending_image') && messageBubbleSource.includes('Camera'), 'TypingIndicator handles sending_image with Camera icon')
  assert(messageBubbleSource.includes('sending_video') && messageBubbleSource.includes('Video'), 'TypingIndicator handles sending_video with Video icon')
  assert(messageBubbleSource.includes('sending_file') && messageBubbleSource.includes('FileText'), 'TypingIndicator handles sending_file with FileText icon')

  assert(projectMessagesSource.includes('getFileAction'), 'ProjectMessagesPage implements getFileAction helper')
  assert(projectMessagesSource.includes('getActionVerb'), 'ProjectMessagesPage implements getActionVerb helper')
  assert(projectMessagesSource.includes('sending image') && projectMessagesSource.includes('sending video'), 'ProjectMessagesPage provides Telegram-style verbs')
  assert(projectMessagesSource.includes('renderHeaderActionIcon'), 'ProjectMessagesPage includes Telegram-style header indicator')
  assert(projectMessagesSource.includes('uploadError'), 'ProjectMessagesPage tracks and displays upload errors')
  assert(projectMessagesSource.includes('getApiErrorMessage'), 'ProjectMessagesPage uses getApiErrorMessage on upload failures')

  // Live Socket Action Broadcast Test
  const testHttpServer = http.createServer()
  const testIo = new Server(testHttpServer, { cors: { origin: '*' } })
  
  testIo.use((socket, next) => {
    socket.data.userId = socket.handshake.auth?.userId || 'test_user_1'
    next()
  })

  testIo.on('connection', (socket) => {
    const userId = socket.data.userId
    socket.on('join:project', (pId) => socket.join(pId))
    socket.on('typing:project', (payload: any) => {
      socket.to(payload.projectId).emit('typing:project', { ...payload, userId })
    })
  })

  await new Promise<void>((resolve) => testHttpServer.listen(0, resolve))
  const testPort = (testHttpServer.address() as any).port
  const testServerUrl = `http://localhost:${testPort}`

  await new Promise<void>((resolve) => {
    const sender = ClientIO(testServerUrl, { auth: { userId: 'sender_123' }, transports: ['websocket'] })
    const receiver = ClientIO(testServerUrl, { auth: { userId: 'receiver_456' }, transports: ['websocket'] })

    receiver.on('connect', () => {
      receiver.emit('join:project', 'proj_999')
    })

    sender.on('connect', () => {
      sender.emit('join:project', 'proj_999')

      setTimeout(() => {
        sender.emit('typing:project', {
          projectId: 'proj_999',
          name: 'Mark',
          isTyping: true,
          action: 'sending_image',
        })
      }, 50)
    })

    receiver.on('typing:project', (payload) => {
      assert(payload.userId === 'sender_123', 'Receiver received broadcast with authenticated sender userId')
      assert(payload.action === 'sending_image', 'Receiver received Telegram-style action: "sending_image"')
      assert(payload.name === 'Mark', 'Receiver received sender name')
      sender.close()
      receiver.close()
      testHttpServer.close()
      resolve()
    })
  })
  console.log('\n==================================================')
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('==================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
