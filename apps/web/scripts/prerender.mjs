// Injects build-time HTML for public pages into copies of dist/index.html.
// Vercel serves dist/help/index.html before the SPA rewrite, so /help and /
// arrive with their content already in the markup.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const ssrDir = resolve(root, 'dist-ssr')
const { pages, render } = await import(pathToFileURL(resolve(ssrDir, 'prerender.js')).href)
const template = readFileSync(resolve(dist, 'index.html'), 'utf8')
const SITE = 'https://www.the-loyalty-loop.com'
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

for (const path of Object.keys(pages)) {
  let html = template.replace('<div id="root"></div>', `<div id="root">${render(path)}</div>`)
  const meta = pages[path].meta
  if (meta) {
    const title = esc(meta.title)
    const description = esc(meta.description)
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta\s+(?:name|property)="(?:og:|twitter:)?title"\s+content=")[^"]*"/g, `$1${title}"`)
      .replace(/(<meta\s+(?:name|property)="(?:og:|twitter:)?description"\s+content=")[^"]*"/g, `$1${description}"`)
      .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${description}"`)
      .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${SITE}${path}"`)
      .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${SITE}${path}"`)
  }
  const out = path === '/' ? resolve(dist, 'index.html') : resolve(dist, path.slice(1), 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  console.log(`prerendered ${path}`)
}
rmSync(ssrDir, { recursive: true, force: true })
