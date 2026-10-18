import { chromium } from 'playwright'
const b=await chromium.launch(); const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>m.type()==='error'&&console.log('CONSOLE',m.text()))
await p.goto('http://localhost:4173/login',{waitUntil:'networkidle'}); console.log((await p.content()).length, await p.$$eval('button,a,input',e=>e.length)); await b.close()
