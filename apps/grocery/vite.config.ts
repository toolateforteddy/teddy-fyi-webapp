import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// The fleet-wide service worker kill switch: build with this set and the generated
// worker is replaced by one that unregisters itself and clears its caches on every
// client that picks it up. See src/pwa.ts and DEPLOYMENT.md.
const disableServiceWorker = process.env.VITE_DISABLE_SW === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Registration is hand-written in src/pwa.ts rather than injected, because the
      // two kill switches it carries have to run *before* anything registers.
      injectRegister: null,
      // A new worker installs, waits, and takes over on the next cold launch --
      // matching what the HTTP caching in nginx.conf already does, and never swapping
      // the bundle under a running session. `prompt` is the registerType that leaves
      // skipWaiting off; the prompt itself is separate, still-unbuilt work.
      registerType: 'prompt',
      selfDestroying: disableServiceWorker,
      // public/manifest.webmanifest stays the source of truth. It is hand-written,
      // commented, and served no-cache by nginx; a second generated copy would be one
      // manifest too many and the two would drift.
      manifest: false,
      workbox: {
        // The app is a single bundle with no dynamic imports, so precaching the whole
        // build is both cheap and complete -- there is no chunk that can go missing.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Every SPA route is served from index.html (see nginx.conf's try_files), and
        // offline the worker has to do the same job.
        navigateFallback: '/index.html',
        // The API lives on another origin, so it never matches a navigation here --
        // except in dev, where vite proxies /api and /auth from this one. Say so
        // rather than rely on that.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Inter and Source Code Pro come from Google's CDN (see index.html). The
            // stylesheet names the font files, so both halves need caching or an
            // offline launch silently drops to the system font.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // A worker in `pnpm dev` caches the very files hot reload is trying to
        // replace. Register against a `pnpm build && pnpm preview` instead.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // packages/shared is plain source consumed by alias rather than a linked
      // workspace package -- see the comment in pnpm-workspace.yaml.
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    // Pinned rather than left on Vite's rolling "baseline-widely-available"
    // default, which moves forward on every Vite major. 16.4 is the real floor:
    // Tailwind v4's oklch()/color-mix()/@property output needs it. Older
    // browsers get the notice in index.html instead of a broken page.
    target: ['safari16.4', 'ios16.4', 'chrome111', 'edge111', 'firefox114'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
  server: {
    // 5174, and personal is on 5173: the two dev servers have to be able to run
    // at the same time, and strictPort means a collision fails rather than
    // silently serving the wrong app on the port you expected.
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
