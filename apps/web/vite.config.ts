import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Keep production source code out of public artefacts. Route-level lazy
    // loading below handles the largest app screens; these vendor chunks make
    // repeat visits faster as the browser can cache them independently.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('@tanstack')) return 'query-vendor'
          if (id.includes('@react-google-maps')) return 'maps-vendor'
          if (id.includes('@zxing')) return 'scanner-vendor'
          if (id.includes('qrcode')) return 'qr-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
          return 'vendor'
        },
      },
    },
  },
})
