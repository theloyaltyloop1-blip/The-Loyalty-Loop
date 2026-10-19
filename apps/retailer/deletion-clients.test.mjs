import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from '../../node_modules/typescript/lib/typescript.js';

// Evaluate the actual bounded functions with in-memory providers; no app/native
// imports, credentials, database access or destructive requests are involved.
const web = await readFile(new URL('../web/src/lib/businesses.ts', import.meta.url), 'utf8');
const retailer = await readFile(new URL('./src/shop-pages.tsx', import.meta.url), 'utf8');
function compile(source, start, end, globals) {
 const code = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
 const exports = {};
 runInNewContext(ts.transpileModule(code, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText, {exports, Response, Error, ...globals});
 return exports;
}
function webDelete(response) {
 return compile(web, 'export async function deleteOwnedBusiness', '/** Transfers', {supabase:{functions:{invoke:async()=>response}}}).deleteOwnedBusiness;
}
test('web shop deletion exposes JSON server errors and masks transport errors', async () => {
 await assert.rejects(webDelete({error:{context:Response.json({error:'Shop name does not match'})}})('shop','Name'),/Shop name does not match/);
 for(const error of [{message:'transport internals'},{context:new Response('not JSON')},{context:Response.json({error:'  '})},{context:Response.json({error:9})}]) {
  await assert.rejects(webDelete({error})('shop','Name'),/Could not delete the shop\. Please try again\./);
 }
});
async function accountRun(results) {
 const calls=[], alerts=[];
 let complete;
 const finished=new Promise(resolve=>{complete=resolve});
 const supabase={from:()=>({select:()=>({eq:async()=>({data:[{id:'shop',name:'Shop'}],error:null})})}),functions:{invoke:async(name,args)=>{calls.push({name,args});return results[name]}},auth:{signOut:async()=>{calls.push({name:'signOut'})}}};
 const Alert={alert:(title,body,buttons)=>{alerts.push({title,body,buttons});if(title==='Account deleted'||title==='Could not delete account') complete();}};
 const source=retailer.replace('function confirmDeleteAccount(userId: string)', 'export function confirmDeleteAccount(userId: string)');
 const {confirmDeleteAccount}=compile(source,'export function confirmDeleteAccount','type ShopView', {supabase,showAlert:Alert.alert});
 confirmDeleteAccount('owner');
 alerts[0].buttons.find(b=>b.text==='Continue').onPress();
 alerts[1].buttons.find(b=>b.text==='Delete everything').onPress();
 await finished;
 return {calls,alerts};
}
test('retailer continues through account deletion and sign-out with leftovers, reporting only count', {timeout:1000}, async()=>{
 const {calls,alerts}=await accountRun({'delete-business':{data:{deleted:true,leftovers:['private-owner/document.pdf','logos/shop/image']}},'delete-my-account':{data:{ok:true}}});
 assert.deepEqual(calls.map(c=>c.name),['delete-business','delete-my-account','signOut']);
 const last=alerts.at(-1); assert.equal(last.title,'Account deleted');assert.match(last.body,/2 shop file/);assert.doesNotMatch(last.body,/private-owner|document.pdf|logos/);
});
test('retailer shows server shop refusal and stops before account deletion', {timeout:1000},async()=>{
 const {calls,alerts}=await accountRun({'delete-business':{error:{context:Response.json({error:'Not permitted'})}}});
 assert.deepEqual(calls.map(c=>c.name),['delete-business']);assert.equal(alerts.at(-1).body,'Not permitted');
});
test('retailer malformed response uses generic error; later failure still reports cleanup count', {timeout:1000},async()=>{
 const malformed=await accountRun({'delete-business':{error:{context:new Response('oops')}}});
 assert.equal(malformed.alerts.at(-1).body,'Could not delete your shop. Please try again.');
 const later=await accountRun({'delete-business':{data:{deleted:true,leftovers:['secret/path']}},'delete-my-account':{error:new Error('Try later')}});
 assert.deepEqual(later.calls.map(c=>c.name),['delete-business','delete-my-account']);assert.match(later.alerts.at(-1).body,/1 file\(s\)/);assert.doesNotMatch(later.alerts.at(-1).body,/secret/);
});
