import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.VITE_BACKEND_URL || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backend,
        ws: true,
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 5173,
    host: true,
  }
})
