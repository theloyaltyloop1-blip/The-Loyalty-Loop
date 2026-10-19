import assert from 'node:assert/strict';
import {test} from 'node:test';
import {listTree,removeFiles,deleteShopAndFiles} from '../../../../supabase/functions/delete-business/cleanup.ts';
// Partial storage mocks: each test only implements the calls it exercises.
type Storage=Parameters<typeof listTree>[0];
const mock=(storage:unknown)=>storage as Storage;
test('lists nested files and all pages',async()=>{
 const storage={from:()=>({list:async(prefix:string,{offset}:{offset:number})=>({data:prefix.endsWith('/nested')?[{id:'child',name:'child.png'}]:offset===0?[{id:null,name:'nested'},...Array.from({length:99},(_,i)=>({id:String(i),name:`${i}.png`}))]:[{id:'last',name:'last.png'}]})})};
 const paths=await listTree(mock(storage),'logos','shop');assert.equal(paths.length,101);assert.ok(paths.includes('shop/nested/child.png'));assert.ok(paths.includes('shop/last.png'));
});
test('listing fails closed; failed removals report paths and other buckets continue',async()=>{
 await assert.rejects(listTree(mock({from:()=>({list:async()=>({error:new Error('unavailable')})})}),'logos','shop'),/unavailable/);
 const calls:string[]=[];
 const storage={from:(bucket:string)=>({remove:async()=>{calls.push(bucket);return {error:bucket==='logos'?new Error('fail'):null}}})};
 assert.deepEqual(await removeFiles(mock(storage),{logos:['shop/a'],covers:['shop/b'],owner_verification_docs:['owner/doc']}),['logos/shop/a']);
 assert.deepEqual(calls,['logos','covers','owner_verification_docs']);
});

test('RPC failure never removes files; success removes only scoped files after RPC, including verification document',async()=>{
 const calls:string[]=[];
 const storage={from:(bucket:string)=>({list:async(prefix:string)=>{calls.push(`list:${bucket}/${prefix}`);return {data:[{id:'file',name:'old.png'}],error:null}},remove:async(paths:string[])=>{calls.push(`remove:${bucket}/${paths.join(',')}`);return {error:null}}})};
 await assert.rejects(deleteShopAndFiles(mock(storage),'shop','owner/doc',async()=>{calls.push('rpc');throw new Error('denied')}),/denied/);
 assert.ok(calls.every(call=>!call.startsWith('remove:')));
 calls.length=0;
 assert.deepEqual(await deleteShopAndFiles(mock(storage),'shop','owner/doc',async()=>{calls.push('rpc')}),[]);
 assert.deepEqual(calls,['list:logos/shop','list:covers/shop','list:gallery/shop','rpc','remove:logos/shop/old.png','remove:covers/shop/old.png','remove:gallery/shop/old.png','remove:owner_verification_docs/owner/doc']);
});
test('listing failure prevents the shop RPC',async()=>{
 let rpc=false;
 const storage={from:()=>({list:async()=>({data:null,error:new Error('list failed')}),remove:async()=>({error:null})})};
 await assert.rejects(deleteShopAndFiles(mock(storage),'shop',null,async()=>{rpc=true}),/list failed/);
 assert.equal(rpc,false);
});
