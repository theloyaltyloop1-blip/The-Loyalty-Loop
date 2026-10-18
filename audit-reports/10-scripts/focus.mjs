import { chromium } from 'playwright'
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:900}})
const sess={access_token:'x',refresh_token:'y',token_type:'bearer',expires_in:3600,expires_at:4102444800,user:{id:'u1',email:'a@b.c',aud:'authenticated',app_metadata:{},user_metadata:{}}}
await ctx.route('https://dummy.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}))
if(process.argv[2]==='auth') await ctx.addInitScript(s=>{localStorage.setItem('sb-dummy-auth-token',s);localStorage.setItem('loyalty-loop-cookie-choice','all')},JSON.stringify(sess))
const p=await ctx.newPage()
const routes=process.argv[2]==='auth'?['/dashboard','/dashboard/profile']:['/','/login','/signup','/forgot-password']
for(const r of routes){ await p.goto('http://localhost:4173'+r,{waitUntil:'networkidle'}); await p.waitForTimeout(500)
  const bad=new Set(); let n=0
  for(let i=0;i<40;i++){ await p.keyboard.press('Tab'); const f=await p.evaluate(()=>{const e=document.activeElement; if(!e||e===document.body)return null; const s=getComputedStyle(e); const vis=(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||(s.boxShadow&&s.boxShadow!=='none'); return {vis, id:e.tagName.toLowerCase()+' "'+(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim().slice(0,25)+'"'}}); if(!f)continue; n++; if(!f.vis)bad.add(f.id)}
  console.log(`${r}: tabbed ${n}, no visible focus: ${bad.size}${bad.size?' → '+[...bad].join(' | '):''}`)}
await b.close()
