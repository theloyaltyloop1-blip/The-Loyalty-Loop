import { chromium } from 'playwright'
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}})
const sess={access_token:'x',refresh_token:'y',token_type:'bearer',expires_in:3600,expires_at:4102444800,user:{id:'u1',email:'a@b.c',aud:'authenticated',app_metadata:{},user_metadata:{}}}
await ctx.route('https://dummy.supabase.co/**',r=>{const u=r.request().url(),m=r.request().method();const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)})
 if(m==='PATCH')return j({message:'denied'},403); if(u.includes('/notifications'))return j([{id:'n1',title:'Stamp!',body:'You got one',link:null,kind:'x',read_at:null,created_at:new Date().toISOString(),business:null}]); return j([])})
await ctx.addInitScript(s=>{localStorage.setItem('sb-dummy-auth-token',s);localStorage.setItem('loyalty-loop-cookie-choice','all')},JSON.stringify(sess))
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:4173/dashboard/inbox',{waitUntil:'networkidle'}); await p.getByRole('button',{name:/Mark all read/}).click(); await p.waitForTimeout(1200)
console.log('mark-all fail:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent))), 'unreadDotStillShown:', await p.locator('.bg-\\[\\#E8703B\\].rounded-full.h-2\\.5').count(), 'pageErrors:', errs.length)
await b.close()
