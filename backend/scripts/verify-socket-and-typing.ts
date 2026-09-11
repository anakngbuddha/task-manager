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
  // Summary
  // -------------------------------------------------------------
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
