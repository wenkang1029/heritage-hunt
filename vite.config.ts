import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nasApiPlugin } from './server/vitePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nasApiPlugin()],
  resolve: {
    alias: {
      tourguidejs: 'tourguidejs/tourguide.esm.js',
    },
  },
})
