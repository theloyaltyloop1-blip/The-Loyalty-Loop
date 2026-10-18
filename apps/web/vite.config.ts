import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Public, indexable routes. Auth-gated app routes are excluded and disallowed in robots.txt.
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/signup/owner', '/terms', '/privacy']
const DISALLOWED = ['/dashboard', '/owner', '/access', '/brand', '/reset-password']

function seoFiles(siteUrl: string): Plugin {
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${siteUrl}${r}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${DISALLOWED.map((d) => `Disallow: ${d}`).join('\n')}\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || 'https://theloyaltyloop.app').replace(/\/$/, '')
  process.env.VITE_SITE_URL = siteUrl
  return {
    plugins: [react(), tailwindcss(), seoFiles(siteUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
