import { chromium } from 'playwright';import {install} from './mock.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();await install(ctx);const p=await ctx.newPage();
p.on('pageerror',e=>console.log('ERR',e.message,JSON.stringify(e).slice(0,300)));p.on('framenavigated',f=>console.log('NAV',f.url()));
p.on('request',r=>{if(r.url().includes(':9/'))console.log('REQ',r.method(),r.url().slice(0,140))});
await p.goto('http://localhost:4174'+process.argv[2],{waitUntil:'networkidle'});await p.waitForTimeout(800);console.log('FINAL',p.url());await b.close();
