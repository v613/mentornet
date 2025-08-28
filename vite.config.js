import { fileURLToPath, URL } from 'node:url'
import { config } from 'dotenv'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Load environment variables
config()

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.NETLIFY_DATABASE_URL': JSON.stringify(process.env.NETLIFY_DATABASE_URL)
    }
  }
})
