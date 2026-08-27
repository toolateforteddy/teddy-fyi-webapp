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
