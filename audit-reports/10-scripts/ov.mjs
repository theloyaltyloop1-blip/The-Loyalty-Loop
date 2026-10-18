import { chromium } from 'playwright'
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}})
await p.goto('http://localhost:4173/',{waitUntil:'networkidle'})
console.log(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>391).slice(0,6).map(e=>e.tagName+' r='+Math.round(e.getBoundingClientRect().right)+' .'+String(e.className).slice(0,90)).join('\n')))
const d=await b.newPage({viewport:{width:1280,height:800}}); 
const sess={access_token:'x',refresh_token:'y',token_type:'bearer',expires_in:3600,expires_at:4102444800,user:{id:'u',email:'a@b.c',aud:'authenticated',app_metadata:{},user_metadata:{}}}
await d.route('https://dummy.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}))
await d.addInitScript(s=>localStorage.setItem('sb-dummy-auth-token',s),JSON.stringify(sess))
await d.goto('http://localhost:4173/dashboard/rewards',{waitUntil:'networkidle'}); await d.waitForTimeout(800)
console.log('desktop aside x/w:', JSON.stringify(await d.locator('aside').boundingBox()), 'menu btn visible:', await d.getByLabel('Open menu').isVisible())
await d.screenshot({path:'desk.png'}); await b.close()
