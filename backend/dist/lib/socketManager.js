let io = null;
export function setIO(instance) {
    io = instance;
}
export function getIO() {
    if (!io)
        throw new Error('Socket.io not initialized');
    return io;
}
export function directRoom(projectId, a, b) {
    const [x, y] = [a, b].sort();
    return `dm:${projectId}:${x}:${y}`;
}
