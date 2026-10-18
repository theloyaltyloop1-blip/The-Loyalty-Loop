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
          // Match exact package folders: a loose `includes('react')` also
          // swallowed lucide-react, radix and google-maps into one 550 KB
          // chunk loaded on every page. Everything else is left to Rolldown so
          // it lands next to the routes that actually use it.
          const parts = id.slice(id.lastIndexOf('node_modules/') + 'node_modules/'.length).split('/')
          const pkg = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
          if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom'].includes(pkg)) return 'react-vendor'
          if (pkg.startsWith('@supabase/')) return 'supabase-vendor'
          return undefined
        },
      },
    },
  },
})
