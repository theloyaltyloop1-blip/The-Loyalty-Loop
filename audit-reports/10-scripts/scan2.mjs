import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route('https://dummy.supabase.co/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }))
const sess = { access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: '00000000-0000-0000-0000-000000000001', email: 'a@b.c', aud: 'authenticated', app_metadata: {}, user_metadata: {} } }
const auth = process.argv[2] === 'auth'
if (auth) await ctx.addInitScript(s => { localStorage.setItem('sb-dummy-auth-token', s); localStorage.setItem('loyalty-loop-cookie-choice','all') }, JSON.stringify(sess))
const p = await ctx.newPage()
const routes = auth ? ['/dashboard','/dashboard/rewards','/dashboard/news','/dashboard/favourites','/dashboard/activity','/dashboard/inbox','/dashboard/profile','/owner','/owner/notifications','/owner/settings','/owner/scan'] : ['/', '/login', '/signup', '/signup/owner', '/forgot-password', '/reset-password', '/terms', '/privacy']
for (const r of routes) {
  await p.goto('http://localhost:4173' + r, { waitUntil: 'networkidle' }).catch(()=>{}); await p.waitForTimeout(800)
  const info = await p.evaluate(() => {
    const els=[...document.querySelectorAll('a,button,input,select,textarea,[role=button]')]
    const small = els.filter(e => { const s = getComputedStyle(e); if (s.display==='none'||s.visibility==='hidden') return false; const r = e.getBoundingClientRect(); if(!r.width) return false; if (e.tagName==='A' && s.display==='inline' && e.closest('p')) return false; return r.width < 44 || r.height < 44 }).map(e => `${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.innerText||e.getAttribute('aria-label')||e.getAttribute('name')||e.getAttribute('type')||'').trim().replace(/\s+/g,' ').slice(0,30)}" .${(e.className||'').toString().slice(0,60)}`)
    return { url: location.pathname, total: els.length, text: document.body.innerText.trim().slice(0,90).replace(/\s+/g,' '), alert: !!document.querySelector('[role=alert]'), skel: !!document.querySelector('[role=status]'), small }
  })
  console.log(`## ${r} → ${info.url} | interactive=${info.total} alert=${info.alert} skeleton=${info.skel} | "${info.text}"`); console.log(`undersized: ${info.small.length}`); info.small.forEach(s => console.log('- ' + s))
}
await b.close()
