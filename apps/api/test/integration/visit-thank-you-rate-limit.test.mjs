import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';

test('visit thank-you: one email per customer per shop every 6 hours', async t => {
 const f=await startFidelDatabase('thank-you-limit-'); const db=f.client;
 try {
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261006100500_visit_thank_you_rate_limit.sql',import.meta.url),'utf8'));
  const [owner,alice,bob]=Array.from({length:3},()=>randomUUID());
  const shopA=randomUUID(), shopB=randomUUID();
  await db.query('insert into auth.users select unnest($1::uuid[])',[[owner,alice,bob]]);
  await db.query("insert into businesses(id,owner_id,name) values($1,$2,'A'),($3,$2,'B')",[shopA,owner,shopB]);
  const claim=(shop,user)=>as(db,'service_role',null,'select claim_visit_thank_you($1,$2) c',[shop,user]).then(r=>r.rows[0].c);
  const release=(shop,user)=>as(db,'service_role',null,'select release_visit_thank_you($1,$2)',[shop,user]);

  await t.test('first award claims; repeats inside 6 hours are refused',async()=>{
   assert.equal(await claim(shopA,alice),true);
   assert.equal(await claim(shopA,alice),false);
   assert.equal(await claim(shopA,alice),false);
  });
  await t.test('other customers and other shops are independent',async()=>{
   assert.equal(await claim(shopA,bob),true);
   assert.equal(await claim(shopB,alice),true);
  });
  await t.test('after 6 hours the next award claims again, then the clock restarts',async()=>{
   await db.query("update visit_thank_you_log set last_sent_at=now()-interval '5 hours 59 minutes' where business_id=$1 and user_id=$2",[shopA,alice]);
   assert.equal(await claim(shopA,alice),false);
   await db.query("update visit_thank_you_log set last_sent_at=now()-interval '6 hours 1 minute' where business_id=$1 and user_id=$2",[shopA,alice]);
   assert.equal(await claim(shopA,alice),true);
   assert.equal(await claim(shopA,alice),false);
  });
  await t.test('a failed send releases the slot so the next award can retry',async()=>{
   await release(shopA,bob);
   assert.equal(await claim(shopA,bob),true);
  });
  await t.test('only the service role can claim or release; the log is not client-readable',async()=>{
   for(const role of ['anon','authenticated']) {
    await assert.rejects(as(db,role,owner,'select claim_visit_thank_you($1,$2)',[shopA,alice]),/permission denied/);
    await assert.rejects(as(db,role,owner,'select release_visit_thank_you($1,$2)',[shopA,alice]),/permission denied/);
    await assert.rejects(as(db,role,owner,'select * from visit_thank_you_log'),/permission denied/);
   }
  });
  await t.test('the function claims before sending and releases on provider failure',async()=>{
   const fn=await readFile(new URL('../../../../supabase/functions/send-visit-thank-you/index.ts',import.meta.url),'utf8');
   const claimAt=fn.indexOf('claim_visit_thank_you'), sendAt=fn.indexOf('api.resend.com/emails');
   assert.ok(claimAt>0 && claimAt<sendAt,'claim happens before the provider call');
   assert.equal((fn.match(/release_visit_thank_you/g)||[]).length,2,'released on network error and on a rejected send');
   assert.match(fn,/reason: "recently_thanked"/);
  });
 } finally {await f.stop()}
});
