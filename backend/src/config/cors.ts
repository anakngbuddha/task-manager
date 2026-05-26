export const ALLOWED_ORIGINS = [
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://task-manager-mauve-eta.vercel.app',
]

import { FRONTEND_URL } from './constants.js'

if (FRONTEND_URL && !ALLOWED_ORIGINS.includes(FRONTEND_URL)) {
  ALLOWED_ORIGINS.push(FRONTEND_URL)
}
