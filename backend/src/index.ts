import 'dotenv/config'
import app from './app.js'
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = Number(process.env.PORT) || 3000

const httpServer = createServer(app.server)

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('join:project', (projectId: string) => {
    socket.join(projectId)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    httpServer.listen(3001)
    console.log(`REST API running on http://localhost:${PORT}`)
    console.log(`Socket.io running on http://localhost:3001`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()