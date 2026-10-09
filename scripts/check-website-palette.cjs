// Public production-bundle browser smoke + isolated CSS theme contracts.
// No sign-in, mock authentication or live account operations.
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const http = require('node:http')
const runtimeRequire = createRequire(path.join(process.argv[2], 'package.json'))
const { chromium } = runtimeRequire('playwright')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'docs/design/palette-browser')
fs.mkdirSync(out, { recursive: true })
const base = 'http://127.0.0.1:4175'
const dist = path.join(root, 'apps/web/dist')
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, base).pathname)
  let target = path.resolve(dist, '.' + pathname)
  if (!target.startsWith(dist + path.sep) && target !== dist) { response.writeHead(403); response.end(); return }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(dist, 'index.html')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' }
  response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream')
  fs.createReadStream(target).pipe(response)
})
const assets = fs.readdirSync(path.join(root, 'apps/web/dist/assets'))
const styles = assets.filter(name => name.endsWith('.css'))
const errors = []
;(async () => {
  await new Promise(resolve => server.listen(4175, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:') return route.continue()
    return route.abort()
  })
  const results = []
  for (const mode of ['light', 'dark']) {
    await page.addInitScript(mode => {
      localStorage.setItem('loyalty-loop-theme', mode)
      localStorage.setItem('loyalty-loop-cookie-choice', 'essential')
    }, mode)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const route of ['/', '/login', '/signup', '/forgot-password']) {
        await page.goto(base + route)
        await page.locator('h1').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          background: getComputedStyle(document.body).backgroundColor,
          primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        }))
        assert.equal(state.overflow, false, `${route} ${mode} ${width} overflow`)
        assert.equal(state.mode, mode)
        results.push({ route, mode, width, ...state })
        if (route === '/' || route === '/login') await page.screenshot({ path: path.join(out, `${route === '/' ? 'landing' : 'login'}-${mode}-${width}.png`), fullPage: true })
      }
    }
  }
  // This isolated fixture uses the actual built CSS, including admin overrides.
  await page.setContent(`<!doctype html><html class="dark"><head>${styles.map(name => `<link rel="stylesheet" href="${base}/assets/${name}">`).join('')}</head><body><main class="admin-panel p-6"><h1>Admin palette contract</h1><button class="bg-primary text-primary-foreground p-4">Primary action</button><p class="bg-success-subtle text-success p-4">Success: saved</p><p class="bg-warning-subtle text-warning p-4">Warning: pending review</p><p class="bg-destructive-subtle text-destructive p-4">Error: failed</p><input placeholder="Readable field" class="border border-input bg-card text-foreground p-4"></main></body></html>`)
  await page.waitForLoadState('load')
  const admin = await page.evaluate(() => ({
    primary: getComputedStyle(document.querySelector('button')).backgroundColor,
    foreground: getComputedStyle(document.querySelector('button')).color,
    input: getComputedStyle(document.querySelector('input')).backgroundColor,
    surface: getComputedStyle(document.querySelector('main')).backgroundColor,
    token: getComputedStyle(document.querySelector('main')).getPropertyValue('--color-primary').trim(),
  }))
  console.log('Admin CSS contract', admin)
  assert.equal(admin.primary, 'rgb(37, 99, 235)')
  assert.equal(admin.foreground, 'rgb(255, 255, 255)')
  assert.equal(admin.input, 'rgb(255, 255, 255)')
  await page.screenshot({ path: path.join(out, 'admin-css-under-dark.png') })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ publicPages: results, adminCssFixture: admin, pageErrors: errors, limitations: 'Remote requests blocked; no authenticated shopper/owner/admin data or operations tested.' }, null, 2))
  await browser.close()
  server.close()
  console.log(`Passed ${results.length} public route/theme/viewport checks and admin CSS isolation; no page errors.`)
})().catch(error => { console.error(error); server.close(); process.exit(1) })
