import { chromium } from 'playwright'
const mode = process.argv[2] // fail | empty
const uid='00000000-0000-0000-0000-000000000001'
const biz={id:'b1',owner_id:uid,name:'Test Cafe',slug:'test-cafe',category:'Cafe',description:null,address:null,postcode:null,website:null,phone:null,instagram:null,brand_color:'#E8703B',logo_url:null,cover_url:null,opening_hours:null,loyalty_type:'stamp_card',loyalty_config:{stamps_required:8,reward_text:'Free coffee'},verification_status:'verified',verification_document_path:null,verification_document_label:null,verification_submitted_at:null,verification_rejection_reason:null,is_active:true}
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
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
for (const r of ['/owner','/owner/scan','/owner/tools','/owner/settings','/owner/announcements','/owner/reviews','/owner/support']) { await p.goto('http://localhost:4173'+r,{waitUntil:'networkidle'}); await p.waitForTimeout(600)
  const bad=new Set(); let n=0
  for(let i=0;i<45;i++){ await p.keyboard.press('Tab'); const f=await p.evaluate(()=>{const e=document.activeElement; if(!e||e===document.body)return null; const s=getComputedStyle(e); const vis=(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||(s.boxShadow&&s.boxShadow!=='none'); return {vis, id:e.tagName.toLowerCase()+' "'+(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.type||'').trim().slice(0,25)+'"'}}); if(!f)continue; n++; if(!f.vis)bad.add(f.id)}
  console.log(`${r}: tabbed ${n}, no visible focus: ${bad.size}${bad.size?' → '+[...bad].join(' | '):''}`)}
await b.close()
