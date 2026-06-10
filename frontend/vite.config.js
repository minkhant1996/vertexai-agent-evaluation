import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/track2/',
  server: {
    port: 8100,
    proxy: {
      '/api': {
        target: 'http://localhost:8101',
        changeOrigin: true,
      },
      '/apps': {
        target: 'http://localhost:8101',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/run_sse': {
        target: 'http://localhost:8101',
        changeOrigin: true,
      },
      '/run': {
        target: 'http://localhost:8101',
        changeOrigin: true,
      },
    },
  },
})
