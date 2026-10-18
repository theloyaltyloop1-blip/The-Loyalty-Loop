import { chromium } from 'playwright';import {install} from './mock.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const out=process.argv[2];
const check=async(p,label,sel)=>{const r=await p.evaluate(sel=>{const res=[];for(const el of document.querySelectorAll(sel)){const r=el.getBoundingClientRect();if(!r.width)continue;const t=document.elementFromPoint(r.left+r.width/2,Math.min(r.top+r.height/2,innerHeight-1));if(t&&!el.contains(t)&&!t.contains(el))res.push((el.textContent||'').trim().slice(0,30)+' covered by '+t.tagName+'.'+String(t.className).slice(0,60))}return res},sel);console.log(label,r.length?r:'OK')};
for(const w of [320,390,768,1280]){
 const ctx=await b.newContext({viewport:{width:w,height:800}});await install(ctx);const p=await ctx.newPage();
 await p.goto('http://localhost:4174/',{waitUntil:'networkidle'});
 const faq=p.locator('button:has-text("?")').first();if(await faq.count()){await faq.click();await p.waitForTimeout(300)}
 await p.screenshot({path:`${out}/state_${w}_faq.png`,fullPage:true});
 const ctx2=await b.newContext({viewport:{width:w,height:800}});const p2=await ctx2.newPage();await p2.goto('http://localhost:4174/login',{waitUntil:'networkidle'});
 await check(p2,`${w} cookie-banner vs login form`,'form button, form input');await p2.screenshot({path:`${out}/state_${w}_cookie_login.png`});
 await p2.goto('http://localhost:4174/',{waitUntil:'networkidle'});await check(p2,`${w} cookie-banner vs landing hero CTAs`,'section:first-of-type a, section:first-of-type button');await ctx2.close();
 await ctx.close();}
await b.close();
