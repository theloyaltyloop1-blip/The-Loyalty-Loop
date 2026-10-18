import { chromium } from 'playwright'
const mode = process.argv[2] // fail | empty
const uid='00000000-0000-0000-0000-000000000001'
const biz={id:'b1',owner_id:uid,name:'Test Cafe',slug:'test-cafe',category:'Cafe',description:null,address:null,postcode:null,website:null,phone:null,instagram:null,brand_color:'#E8703B',logo_url:null,cover_url:null,opening_hours:null,loyalty_type:'stamp_card',loyalty_config:{stamps_required:8,reward_text:'Free coffee'},verification_status:'verified',verification_document_path:null,verification_document_label:null,verification_submitted_at:null,verification_rejection_reason:null,is_active:true}
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route('https://dummy.supabase.co/**', r => {
  const u = r.request().url(); const j = (x,s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(x) })
  if (u.includes('/user_roles')) return j([{role:'business_owner'}])
  if (u.includes('/rest/v1/businesses') && u.includes('owner_id')) return j([biz])
  if (u.includes('/staff_members')) return j([])
  if (u.includes('ensure_current_user_bootstrap')) return j(null)
  return mode==='fail' ? j({message:'boom'},500) : j(u.includes('/rpc/') ? [] : [])
})
const sess = { access_token:'x', refresh_token:'y', token_type:'bearer', expires_in:3600, expires_at:4102444800, user:{ id:uid, email:'a@b.c', aud:'authenticated', app_metadata:{}, user_metadata:{} } }
await ctx.addInitScript(s => { localStorage.setItem('sb-dummy-auth-token', s); localStorage.setItem('loyalty-loop-cookie-choice','all') }, JSON.stringify(sess))
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:4173/owner/settings',{waitUntil:'networkidle'}); await p.waitForTimeout(800)
for (const t of ['Profile','Loyalty & rewards','Win-back emails','Verification','Staff','Help & support','Danger zone']) {
  errs.length=0; await p.getByRole('button',{name:t,exact:true}).first().click(); await p.waitForTimeout(900)
  const i = await p.evaluate(() => { const els=[...document.querySelectorAll('main a,main button,main input,main select,main textarea')]; const small=els.filter(e=>{const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||e.type==='file'||e.type==='hidden')return false;const r=e.getBoundingClientRect();if(!r.width)return false;if(e.tagName==='A'&&s.display==='inline'&&e.closest('p'))return false;return r.width<44||r.height<44}).map(e=>`${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.type||'').trim().replace(/\s+/g,' ').slice(0,24)}" .${String(e.className).slice(0,50)}`); return {alert:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,60)),small} })
  console.log(`## tab ${t} alerts=${JSON.stringify(i.alert)} pageErrors=${errs.length} ${errs.join(';').slice(0,100)}\n  undersized(${i.small.length}): ${i.small.join(' | ')}`)
}
await b.close()
