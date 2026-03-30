import { Server } from 'socket.io'

let io: Server | null = null

export function setIO(instance: Server) {
  io = instance
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

export function directRoom(projectId: string, a: string, b: string) {
  const [x, y] = [a, b].sort()
  return `dm:${projectId}:${x}:${y}`
}
