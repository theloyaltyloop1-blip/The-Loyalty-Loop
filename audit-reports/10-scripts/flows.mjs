import { chromium } from 'playwright'
const b = await chromium.launch()
async function run(name, status, body, path, fill, submit) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => localStorage.setItem('loyalty-loop-cookie-choice','all'))
  await ctx.route('https://dummy.supabase.co/**', r => r.fulfill({ status, contentType: 'application/json', body }))
  const p = await ctx.newPage(); await p.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  for (const [sel, v] of fill) { const el = p.locator(sel).first(); if (v === true) await el.check(); else await el.fill(v) }
  await p.locator(submit).first().click(); await p.waitForTimeout(1200)
  const t = await p.evaluate(() => ({ url: location.pathname, alert: [...document.querySelectorAll('[role=alert],[role=status],.text-red-600,.text-red-700,[aria-invalid=true]')].map(e => e.textContent.trim()).filter(Boolean).slice(0,3), invalid: [...document.querySelectorAll('input:invalid')].length }))
  console.log(`${name}: url=${t.url} invalidNative=${t.invalid} messages=${JSON.stringify(t.alert)}`); await ctx.close()
}
const bad = '{"error":"invalid_grant","error_description":"Invalid login credentials","msg":"Invalid login credentials"}'
await run('login-empty', 400, bad, '/login', [], 'button[type=submit]')
await run('login-badcreds', 400, bad, '/login', [['input[type=email]','a@b.co'],['input[type=password]','wrongpass1']], 'button[type=submit]')
await run('forgot-err', 500, '{"msg":"boom"}', '/forgot-password', [['input[type=email]','a@b.co']], 'button[type=submit]')
await run('forgot-ok', 200, '{}', '/forgot-password', [['input[type=email]','a@b.co']], 'button[type=submit]')
await run('signup-noagree', 400, bad, '/signup', [['input[type=email]','a@b.co'],['input[type=password]','Password123!']], 'button[type=submit]')
await b.close()
