import { chromium } from 'playwright';import {install} from './mock.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();await install(ctx);const p=await ctx.newPage();await p.addInitScript(()=>addEventListener('unhandledrejection',e=>console.error('REJ',JSON.stringify(e.reason))));
p.on('pageerror',e=>console.log('ERR',e.message,e.stack?.slice(0,400)));p.on('console',m=>m.type()==='error'&&console.log('CONSOLE',m.text().slice(0,200)));p.on('framenavigated',f=>console.log('NAV',f.url()));
p.on('request',r=>{if(r.url().includes(':9/'))console.log('REQ',r.method(),r.url().slice(0,140))});
await p.goto('http://localhost:4174'+process.argv[2],{waitUntil:'networkidle'});await p.waitForTimeout(800);console.log('FINAL',p.url());await b.close();
