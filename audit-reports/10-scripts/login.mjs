import { chromium } from 'playwright'
const mode = process.argv[2] // fail | empty
const uid='00000000-0000-0000-0000-000000000001'
const biz={id:'b1',owner_id:uid,name:'Test Cafe',slug:'test-cafe',category:'Cafe',description:null,address:null,postcode:null,website:null,phone:null,instagram:null,brand_color:'#E8703B',logo_url:null,cover_url:null,opening_hours:null,loyalty_type:'stamp_card',loyalty_config:{stamps_required:8,reward_text:'Free coffee'},verification_status:'verified',verification_document_path:null,verification_document_label:null,verification_submitted_at:null,verification_rejection_reason:null,is_active:true}
const sess = { access_token:'x', refresh_token:'y', token_type:'bearer', expires_in:3600, expires_at:4102444800, user:{ id:uid, email:'a@b.c', aud:'authenticated', app_metadata:{}, user_metadata:{} } }
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route('https://dummy.supabase.co/**', r => {
  const u = r.request().url(); const j = (x,s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(x) })
  if (u.includes('/auth/v1/token')) return j({...sess, expires_at: 4102444800})
  if (u.includes('/user_roles')) return j([{role:'business_owner'}])
  if (u.includes('/rest/v1/businesses') && u.includes('owner_id')) return j([biz])
  if (u.includes('/staff_members')) return j([])
  if (u.includes('ensure_current_user_bootstrap')) return j(null)
  return mode==='fail' ? j({message:'boom'},500) : j(u.includes('/rpc/') ? [] : [])
})
await ctx.addInitScript(() => localStorage.setItem('loyalty-loop-cookie-choice','all'))
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
const navs=[]; p.on('framenavigated',f=>navs.push(new URL(f.url()).pathname))
await p.goto('http://localhost:4173/login',{waitUntil:'networkidle'})
await p.locator('input[type=email]').fill('a@b.c'); await p.locator('input[type=password]').fill('password1'); await p.locator('button[type=submit]').click()
await p.waitForTimeout(2000); console.log('login → final', new URL(p.url()).pathname, 'via', navs.join(' > '))
await p.goto('http://localhost:4173/owner/settings',{waitUntil:'networkidle'}); await p.waitForTimeout(1000); console.log('deep link after login →', new URL(p.url()).pathname)
await b.close()
