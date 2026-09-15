import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Group node_modules into named vendor chunks.
 *
 * Route components are lazily imported in src/App.tsx, so a vendor only ships
 * to the browser once a route that needs it is visited. Without this grouping
 * Rollup is free to hoist shared vendor code into a chunk the entry pulls in,
 * which defeats the point: an anonymous visitor on the login screen would
 * still download the dependency-diagram, charting and map stacks.
 *
 * Order matters. More specific matches must come before the generic React
 * check, otherwise packages whose paths merely contain "react" get misfiled.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  // Dependency diagram: @xyflow/react + @dagrejs/dagre. Only /projects/:id/dependencies.
  if (id.includes('@xyflow') || id.includes('dagre')) return 'vendor-diagram'

  // Charts: recharts pulls a large tree of d3-* packages.
  if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'

  // Maps: only the calendar location picker / map modal.
  if (id.includes('leaflet')) return 'vendor-maps'

  if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion'

  if (id.includes('emoji-picker-react')) return 'vendor-emoji'

  // react-markdown drags in the whole unified/remark/micromark pipeline.
  if (
    id.includes('react-markdown') ||
    id.includes('remark') ||
    id.includes('rehype') ||
    id.includes('micromark') ||
    id.includes('mdast') ||
    id.includes('hast') ||
    id.includes('unified') ||
    id.includes('unist')
  ) {
    return 'vendor-markdown'
  }

  if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket'

  if (id.includes('@dnd-kit')) return 'vendor-dnd'

  if (id.includes('radix-ui') || id.includes('@radix-ui')) return 'vendor-radix'

  if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router'

  if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) return 'vendor-forms'

  // React core last, so the checks above win.
  if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'

  return 'vendor'
}

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
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raised from the 500 kB default so the warning flags genuine regressions
    // rather than firing on every legitimately large vendor chunk. The hard
    // ceiling is enforced by scripts/check-bundle-budget.mjs.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
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
