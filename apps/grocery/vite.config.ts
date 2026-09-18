import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFile, writeFile } from 'node:fs/promises'
import { applySocialCard, DEFAULT_CARD, ROUTE_CARDS } from './social-cards'

// The fleet-wide service worker kill switch: build with this set and the generated
// worker is replaced by one that unregisters itself and clears its caches on every
// client that picks it up. See src/pwa.ts and DEPLOYMENT.md.
const disableServiceWorker = process.env.VITE_DISABLE_SW === 'true'

/**
 * Stamps the link-preview tags into index.html, and stamps out one more copy of the
 * built document per route in ROUTE_CARDS. social-cards.ts has the reasoning; the
 * short version is that an unfurler runs no script, so a route only gets its own
 * preview if it is served its own HTML.
 *
 * `writeBundle` rather than `generateBundle`: it runs once index.html has actually
 * been written, so the variants are a copy of the finished document -- hashed
 * bundle reference, theme script and all -- rather than something this plugin has
 * to keep in step with Vite's own HTML output.
 */
function socialCards() {
  return {
    name: 'grocery-social-cards',
    transformIndexHtml(html: string) {
      return applySocialCard(html, DEFAULT_CARD)
    },
    async writeBundle(options: { dir?: string }) {
      const dir = options.dir
      if (!dir) return
      const html = await readFile(path.join(dir, 'index.html'), 'utf8')
      for (const card of ROUTE_CARDS) {
        await writeFile(path.join(dir, card.file), applySocialCard(html, card))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    socialCards(),
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
        // The screenshots are read by the browser's install dialog and never by the
        // app; og-image.png is only ever fetched by somebody else's link scraper.
        // The large launcher icons are the same bargain: the browser reads them
        // once, when the app is installed, and the OS owns the result from then on
        // -- so the only icons worth carrying offline are the ones index.html asks
        // for. join.html and invite.html are excluded for a different reason: they
        // exist for crawlers, and navigateFallback below already answers every
        // offline navigation with index.html, so a precached copy could never be
        // served to anyone.
        globIgnores: [
          '**/screenshot-*.png',
          '**/og-image.png',
          '**/icon-512.png',
          '**/icon-maskable-*.png',
          '**/icon-monochrome-*.png',
          '**/join.html',
          '**/invite.html',
        ],
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
