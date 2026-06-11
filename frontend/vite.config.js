import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use /track2/ for local dev, / for production (same origin)
  base: process.env.NODE_ENV === 'production' ? '/' : '/track2/',
  server: {
    port: 8100,
    proxy: {
      // All routes go to unified server on port 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/apps': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/run_sse': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/run': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
