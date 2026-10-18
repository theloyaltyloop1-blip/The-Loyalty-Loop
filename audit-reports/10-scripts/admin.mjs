import { chromium } from 'playwright'
const mode = process.argv[2] // fail | empty
const uid='00000000-0000-0000-0000-000000000001'
const biz={id:'b1',owner_id:uid,name:'Test Cafe',slug:'test-cafe',category:'Cafe',description:null,address:null,postcode:null,website:null,phone:null,instagram:null,brand_color:'#E8703B',logo_url:null,cover_url:null,opening_hours:null,loyalty_type:'stamp_card',loyalty_config:{stamps_required:8,reward_text:'Free coffee'},verification_status:'verified',verification_document_path:null,verification_document_label:null,verification_submitted_at:null,verification_rejection_reason:null,is_active:true}
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route('https://dummy.supabase.co/**', r => {
  const u = r.request().url(); const j = (x,s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(x) })
  if (u.includes('/user_roles')) return j([{role:process.env.ROLE}])
  if (u.includes('/rest/v1/businesses') && u.includes('owner_id')) return j([biz])
  if (u.includes('/staff_members')) return j([])
  if (u.includes('ensure_current_user_bootstrap')) return j(null)
  if (r.request().method()==='POST' && mode==='postfail') return j({message:'permission denied for function'},400)
  return mode==='fail' ? j({message:'boom'},500) : j(u.includes('/rpc/') ? [] : [])
})
const sess = { access_token:'x', refresh_token:'y', token_type:'bearer', expires_in:3600, expires_at:4102444800, user:{ id:uid, email:'a@b.c', aud:'authenticated', app_metadata:{}, user_metadata:{} } }
await ctx.addInitScript(s => { localStorage.setItem('sb-dummy-auth-token', s); localStorage.setItem('loyalty-loop-cookie-choice','all') }, JSON.stringify(sess))
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:4173/access',{waitUntil:'networkidle'}); await p.waitForTimeout(800)
const t=p.getByRole('button',{name:/control/i}); if(await t.count()) await t.first().click()
await p.getByPlaceholder('Account email').fill('x@y.z'); await p.getByRole('button',{name:'Grant',exact:true}).click(); await p.waitForTimeout(800)
console.log(process.argv[2], JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[role=alert],[role=status]')].map(e=>e.textContent.trim()))))
await b.close()
