import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // packages/shared is plain source consumed by alias rather than a linked
      // workspace package -- see the comment in pnpm-workspace.yaml.
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    // Same floor as the grocery app, for the same reason: Tailwind v4 emits
    // oklch()/color-mix()/@property with no fallbacks. index.html carries the
    // notice older browsers get instead.
    target: ['safari16.4', 'ios16.4', 'chrome111', 'edge111', 'firefox114'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  server: {
    // 5173, and grocery is on 5174 -- both dev servers need to run at once.
    port: 5173,
    strictPort: true,
  },
})
