import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// One-time cleanup for clients that received an older service worker.
// 1. "api-cache": the old SW cached /api/ responses (including auth/session),
//    so a stale cached session could survive a fresh login and surface as a 401.
// 2. Legacy precache served a stale index.html (cache-first) that referenced
//    JS chunks removed by the latest deploy, breaking the app — including login
//    — until the user manually cleared site storage. The current SW serves the
//    app shell network-first; purge the outdated precache so stuck clients
//    recover automatically.
if ('caches' in window) {
  caches.keys()
    .then((names) =>
      Promise.all(
        names
          .filter((name) => name === 'api-cache' || name.includes('precache'))
          .map((name) => caches.delete(name)),
      ),
    )
    .catch(() => {})
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