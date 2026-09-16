import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons.svg'],
      manifest: {
        name: 'We Work IT',
        short_name: 'We Work IT',
        description: 'Task manager',
        theme_color: '#0f172a',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        cleanupOutdatedCaches: true,
        // Take control of the page as soon as the new SW activates so a freshly
        // deployed version is used immediately instead of after a manual
        // storage clear.
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        runtimeCaching: [
          {
            // Never cache API/auth/session responses. The cache is keyed by URL
            // only (it cannot see HttpOnly session cookies), so caching here
            // both served STALE auth state — causing spurious 401s after login
            // when the backend cold-starts and NetworkFirst hit its timeout —
            // and risked leaking one user's data to another on a shared device.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // App shell / navigations: always try the network first so a new
            // deploy (with new hashed JS chunks) is picked up right away. The
            // old cache-first behavior served a stale index.html that pointed at
            // JS chunks deleted by the latest deploy, breaking the app (incl.
            // login) until the user manually cleared site storage. Falls back to
            // the cached shell only when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Route components are already lazy-loaded in App.tsx. Let Rollup place
    // shared dependencies automatically so React is not split into circular
    // vendor chunks that can execute before the React namespace is initialized.
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
