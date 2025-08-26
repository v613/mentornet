import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
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
    // Explicitly define env vars to avoid secrets in build
    __VITE_FIREBASE_API_KEY__: JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
    __VITE_FIREBASE_AUTH_DOMAIN__: JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    __VITE_FIREBASE_PROJECT_ID__: JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
    __VITE_FIREBASE_STORAGE_BUCKET__: JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
    __VITE_FIREBASE_MESSAGING_SENDER_ID__: JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    __VITE_FIREBASE_APP_ID__: JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
    __VITE_PERMIT_API_KEY__: JSON.stringify(process.env.VITE_PERMIT_API_KEY || ''),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
