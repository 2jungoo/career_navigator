import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
 * External AI detector proxy is intentionally disabled.
 * We kept the integration out of the active path because Sapling produced
 * aggressive false positives on Korean resume/admission PDFs.
 *
 * If this is re-enabled later, restore a server-side proxy here and keep API
 * keys in .env.local. Never expose detector keys from browser code.
 */

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/spellcheck': {
        target: 'http://speller.cs.pusan.ac.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spellcheck/, '/results'),
      },
    },
  },
})
