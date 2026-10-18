import { defineConfig, loadEnv, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build without Supabase config ships a blank page, so fail the build instead.
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((key) => !env[key])
    if (missing.length) throw new Error(`Missing build environment variables: ${missing.join(', ')}`)
  }
  return config
})

const config: UserConfig = {
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
}
