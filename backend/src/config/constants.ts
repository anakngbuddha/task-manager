// Default columns used when creating a new project
export const DEFAULT_BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']

// The computed frontend URL for the application
export const FRONTEND_URL = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.replace(/\/$/, '') 
  : 'http://localhost:5173'
