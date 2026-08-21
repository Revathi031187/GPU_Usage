import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GH_PAGES ? '/GPU_Usage/' : '/',
  server: {
    port: 5173,
  },
})
