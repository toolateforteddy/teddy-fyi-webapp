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
