import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext();const p=await ctx.newPage();
await p.goto('http://localhost:4173/',{waitUntil:'networkidle'});
const before=await p.locator('[role=dialog]').count();await p.keyboard.press('Escape');const after=await p.locator('[role=dialog]').count();
console.log('cookie dialog before/after Escape:',before,after);
await p.keyboard.press('Tab');const o=await p.evaluate(()=>{const s=getComputedStyle(document.activeElement);return document.activeElement.tagName+' outline='+s.outlineStyle+' '+s.outlineWidth+' '+s.outlineColor});console.log('focused:',o);
await p.goto('http://localhost:4173/login',{waitUntil:'networkidle'});await p.keyboard.press('Tab');await p.keyboard.press('Tab');
console.log('login focused:',await p.evaluate(()=>{const s=getComputedStyle(document.activeElement);return document.activeElement.tagName+' outline='+s.outlineStyle+' '+s.outlineWidth}));
await b.close();
