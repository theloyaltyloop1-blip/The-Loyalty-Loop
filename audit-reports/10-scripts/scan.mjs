import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true }).catch(()=>chromium.launch())
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
for (const r of ['/', '/login', '/signup', '/signup/owner', '/forgot-password', '/terms', '/privacy']) {
  await p.goto('http://localhost:4173' + r, { waitUntil: 'networkidle' }).catch(()=>{})
  const small = await p.$$eval('a,button,input,select,textarea,[role=button]', els => els.filter(e => { const s = getComputedStyle(e); if (s.display==='none'||s.visibility==='hidden') return false; const r = e.getBoundingClientRect(); return r.width>0 && (r.width < 44 || r.height < 44) && !(e.tagName==='A' && s.display==='inline') }).map(e => `${e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.innerText||e.getAttribute('aria-label')||e.name||'').trim().slice(0,30)}"`))
  console.log(`## ${r} (${small.length} undersized)`); small.forEach(s => console.log('- ' + s))
}
await b.close()
