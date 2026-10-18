import { chromium } from 'playwright-core';
import { AxeBuilder } from '@axe-core/playwright';
const routes = ['/','/dashboard','/dashboard/shop/1','/dashboard/rewards','/dashboard/news','/dashboard/favourites','/dashboard/profile','/dashboard/activity','/dashboard/inbox','/terms','/privacy','/access','/brand','/owner','/owner/onboarding','/owner/scan','/owner/tools','/owner/settings','/owner/notifications','/owner/announcements','/owner/reviews','/owner/support','/login','/signup','/signup/owner','/forgot-password','/reset-password'];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const out = {}; let total=0;
for (const r of routes) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto('http://localhost:4173'+r,{waitUntil:'networkidle'}).catch(()=>{});
  await p.waitForTimeout(800);
  const res = await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  out[r] = {url:p.url(), v: res.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,targets:v.nodes.slice(0,6).map(n=>n.target.join(' ')+' | '+(n.failureSummary||'').split('\n').slice(1,2).join(''))}))};
  total += res.violations.reduce((a,v)=>a+v.nodes.length,0);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({total,out},null,1));
