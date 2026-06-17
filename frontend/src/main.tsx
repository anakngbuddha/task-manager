import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// One-time cleanup for clients that received the old service worker, which
// cached /api/ responses (including auth/session) in an "api-cache". A stale
// cached session could survive a fresh login and surface as a 401. The current
// SW no longer caches /api/, so just purge the leftover cache here.
if ('caches' in window) {
  caches.delete('api-cache').catch(() => {})
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)