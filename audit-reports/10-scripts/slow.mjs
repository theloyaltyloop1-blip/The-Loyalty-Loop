import { chromium } from 'playwright'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:390,height:844} })
const sess={access_token:'x',refresh_token:'y',token_type:'bearer',expires_in:3600,expires_at:4102444800,user:{id:'u1',email:'a@b.c',aud:'authenticated',app_metadata:{},user_metadata:{}}}
await ctx.route('https://dummy.supabase.co/**', async r => { const u=r.request().url(); if(u.includes('user_roles')||u.includes('bootstrap')) return r.fulfill({status:200,contentType:'application/json',body:'[]'}); await new Promise(x=>setTimeout(x,2500)); r.fulfill({status:200,contentType:'application/json',body:'[]'}) })
await ctx.addInitScript(s=>{localStorage.setItem('sb-dummy-auth-token',s);localStorage.setItem('loyalty-loop-cookie-choice','all')},JSON.stringify(sess))
const p = await ctx.newPage()
for (const r of ['/dashboard','/dashboard/rewards','/dashboard/news','/dashboard/favourites','/dashboard/activity','/dashboard/inbox','/dashboard/profile','/dashboard/shop/x']) {
  await p.goto('http://localhost:4173'+r); await p.waitForTimeout(900)
  const st = await p.evaluate(()=>({skel:!!document.querySelector('[role=status][aria-label=Loading]'), blank: document.body.innerText.trim().length<5, txt: document.body.innerText.replace(/\s+/g,' ').trim().slice(0,60)}))
  console.log(`${r} @0.9s: skeleton=${st.skel} blank=${st.blank} "${st.txt}"`)
}
await b.close()
