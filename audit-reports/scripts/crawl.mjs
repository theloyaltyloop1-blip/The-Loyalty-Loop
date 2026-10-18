import { chromium } from 'playwright';
import fs from 'fs';
import {install} from './mock.mjs';
const out = process.argv[2]; fs.mkdirSync(out,{recursive:true});
const routes=['/','/dashboard','/dashboard/shop/b1','/dashboard/rewards','/dashboard/news','/dashboard/favourites','/dashboard/profile','/dashboard/activity','/dashboard/inbox','/terms','/privacy','/access','/brand','/owner','/owner/onboarding','/owner/scan','/owner/tools','/owner/settings','/owner/notifications','/owner/announcements','/owner/reviews','/owner/support','/login','/signup','/signup/owner','/forgot-password','/reset-password'];
const widths=(process.env.W||'320,390,768,1280,1920').split(',').map(Number);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const res=[];
for(const w of widths){const ctx=await b.newContext({viewport:{width:w,height:900}});if(process.env.MOCK)await install(ctx);
for(const r of routes){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
try{await p.goto('http://localhost:4174'+r,{waitUntil:'networkidle',timeout:15000});}catch(e){}
await p.waitForTimeout(400);
const issues=await p.evaluate(()=>{const o=[];const W=document.documentElement.clientWidth;
if(document.documentElement.scrollWidth>W+1)o.push({t:'h-overflow',sw:document.documentElement.scrollWidth,W});
const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
const rgba=c=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=c;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255]};
const L=([r,g,b])=>[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const mix=(t,b)=>[0,1,2].map(i=>t[i]*t[3]+b[i]*(1-t[3])).concat(1);
const bgOf=el=>{const st=[];let hasImg=false;while(el){const cs=getComputedStyle(el);if(cs.backgroundImage!=='none')hasImg=true;const c=rgba(cs.backgroundColor);if(c[3]>0){st.push(c);if(c[3]>=1)break}el=el.parentElement}let b=[255,255,255,1];for(let i=st.length-1;i>=0;i--)b=mix(st[i],b);return hasImg&&st.length===0?null:b};
const opa=el=>{let q=1;while(el){q*=+getComputedStyle(el).opacity;el=el.parentElement}return q};
for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;
const tag=el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ').slice(0,4).join('.'):'');
if(r.right>W+1&&!el.closest('[class*="overflow-x"],[class*="overflow-hidden"]'))o.push({t:'offscreen',tag,right:Math.round(r.right)});
const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
if(own){if((cs.overflow==='hidden'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1&&cs.textOverflow!=='ellipsis')o.push({t:'clipped',tag});
const bgc=bgOf(el);if(bgc){const op=opa(el);const f=rgba(cs.color);f[3]*=op;const fg=L(mix(f,bgc)),bg=L(bgc);const cr=(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);const big=parseFloat(cs.fontSize)>=18.66||(parseFloat(cs.fontSize)>=14&&+cs.fontWeight>=700);if(cr<(big?3:4.5))o.push({t:'contrast',tag,cr:+cr.toFixed(2),text:el.textContent.trim().slice(0,30)})}}}

const vh=innerHeight;const desc=el=>el.tagName.toLowerCase()+(typeof el.className==='string'&&el.className?'.'+el.className.split(' ').slice(0,4).join('.'):'')+(el.textContent?' "'+el.textContent.trim().slice(0,25)+'"':'');
for(const el of document.querySelectorAll('a,button,input,select,textarea')){const r=el.getBoundingClientRect();if(r.width<4||r.height<4||r.top<0||r.bottom>vh||r.left<0||r.right>W)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity===0)continue;
 const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);if(t&&t!==el&&!el.contains(t)&&!t.contains(el)&&!(el.labels&&[...el.labels].some(l=>l.contains(t))))o.push({t:'covered',tag:desc(el),text:'by '+desc(t)});}
for(const c of document.querySelectorAll('body *')){const d=getComputedStyle(c).display;if(!/flex|grid/.test(d))continue;const kids=[...c.children].filter(k=>{const ks=getComputedStyle(k);return ks.position!=='absolute'&&ks.position!=='fixed'&&k.getBoundingClientRect().width>0});
 for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect();const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left),iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(ix>2&&iy>2)o.push({t:'overlap',tag:desc(kids[i]),text:'with '+desc(kids[j])+' '+Math.round(ix)+'x'+Math.round(iy)})}}
for(const el of document.querySelectorAll('body *')){const cs=getComputedStyle(el);if((cs.textOverflow==='ellipsis'&&el.scrollWidth>el.clientWidth+1)||(cs.webkitLineClamp!=='none'&&cs.webkitLineClamp&&el.scrollHeight>el.clientHeight+1))o.push({t:'truncated',tag:desc(el)})}
o.push({t:'_len',n:document.body.innerText.length,url:location.pathname});return o});
const name=`${w}${r.replace(/\//g,'_')||'_root'}.png`;await p.screenshot({path:`${out}/${name}`,fullPage:true});
if(errs.length)issues.push({t:'jserror',tag:errs[0]});res.push({w,r,issues});await p.close();}await ctx.close();}
await b.close();fs.writeFileSync(out+'/results.json',JSON.stringify(res,null,1));
const sum={};for(const x of res)for(const i of x.issues){const k=i.t;sum[k]=(sum[k]||0)+1}console.log(sum);
