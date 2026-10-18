const {chromium}=require('playwright-core');
const B='http://localhost:4173';
const seeds=['/','/dashboard','/dashboard/shop/demo','/dashboard/rewards','/dashboard/news','/dashboard/favourites','/dashboard/profile','/dashboard/activity','/dashboard/inbox','/terms','/privacy','/dashboard/admin','/access','/brand','/owner','/owner/onboarding','/owner/scan','/owner/tools','/owner/settings','/owner/notifications','/owner/announcements','/owner/reviews','/owner/support','/login','/signup','/signup/owner','/forgot-password','/reset-password','/does-not-exist'];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const seen=new Set(),q=[...seeds],res=[],bad=[];
while(q.length){const u=q.shift();if(seen.has(u))continue;seen.add(u);const p=await b.newPage();
p.on('response',r=>{if(r.status()>=400&&r.url().startsWith(B))bad.push(`${r.status()} ${r.url()} (on ${u})`)});
p.on('requestfailed',r=>{if(r.url().startsWith(B))bad.push(`FAILED ${r.url()} (on ${u})`)});
const r=await p.goto(B+u,{waitUntil:'networkidle'}).catch(e=>null);await p.waitForTimeout(500);
const nf=await p.locator('text=Page not found').count();
res.push(`${r?r.status():'ERR'} ${u}${nf?' [NotFound page]':''} -> ${new URL(p.url()).pathname}`);
const links=await p.$$eval('a[href]',a=>a.map(x=>x.getAttribute('href')));
for(const h of links){if(h.startsWith('/')&&!seen.has(h.split('#')[0]))q.push(h.split('#')[0]||'/');if(h==='#')bad.push(`EMPTY-HASH link on ${u}`)}
await p.close()}
console.log(res.join('\n'));console.log('ISSUES:',bad.length);console.log([...new Set(bad)].join('\n'));await b.close()})();
