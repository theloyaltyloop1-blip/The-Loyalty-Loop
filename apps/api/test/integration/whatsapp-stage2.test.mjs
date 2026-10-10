import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {startFidelDatabase,as} from './fidel-fixture.mjs';
import {sameSecret,sendWhatsAppTemplate} from '../../../../supabase/functions/_shared/whatsapp-dispatch.ts';
export async function setupWhatsApp(db) {
  const old=await readFile(new URL('../../../../supabase/migrations/20260824175004_whatsapp_customer_onboarding.sql',import.meta.url),'utf8');
  await db.query(old.slice(0,old.indexOf('-- Redeems a short-lived')));
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261010154526_whatsapp_spend_dispatch.sql',import.meta.url),'utf8'));
}
test('WhatsApp stage 2 disposable PostgreSQL and fake Graph acceptance',async t=>{
 const f=await startFidelDatabase('whatsapp-'); const db=f.client;
 try {
  await setupWhatsApp(db);
  const owner=randomUUID(), user=randomUUID(),shop=randomUUID(),tier=randomUUID();
  await db.query('insert into auth.users values($1),($2)',[owner,user]);
  await db.query("insert into businesses(id,owner_id,name,reward_model,reward_threshold_pence) values($1,$2,'Cafe','spend_threshold',2000)",[shop,owner]);
  await db.query('insert into memberships(user_id,business_id) values($1,$2)',[user,shop]);
  await db.query("insert into reward_catalog(id,business_id,title,spend_threshold_pence) values($1,$2,'Coffee',2000)",[tier,shop]);
  await db.query("insert into whatsapp_contacts(phone_e164,user_id) values('+447000000001',$1)",[user]);
  const spend=async v=>as(db,'service_role',null,"insert into transactions(user_id,business_id,type,value) values($1,$2,'spend',$3)",[user,shop,v]);
  const count=async()=>Number((await db.query('select count(*) n from whatsapp_outbox')).rows[0].n);
  await t.test('positive spend queues latest progress; thirty-minute coalescing',async()=>{await spend(300);await spend(400);assert.equal(await count(),1);assert.deepEqual((await db.query('select parameters from whatsapp_outbox')).rows[0].parameters,['Cafe','£7.00','Coffee','£13.00']);});
  await t.test('threshold reward queues; signup reward never does',async()=>{await spend(1300);assert.equal(await count(),2);await db.query('insert into rewards(user_id,business_id,title) values($1,$2,$3)',[user,shop,'Signup']);assert.equal(await count(),2);});
  await t.test('refund clawback and undo queue nothing',async()=>{await as(db,'service_role',null,"select apply_spend_clawback(id,-100,'Refund') from memberships where user_id=$1 and business_id=$2",[user,shop]);await as(db,'service_role',null,"update transactions set voided_at=now(),void_reason='Correction' where value=400");assert.equal(await count(),2);});
  await t.test('opt-out/logout queue nothing and stale callers cannot mint card links',async()=>{await db.query('update whatsapp_contacts set opted_out_at=now()');await spend(100);assert.equal(await count(),2);await db.query('update whatsapp_contacts set opted_out_at=null,user_id=null,logged_out_at=now()');await spend(100);assert.equal(await count(),2);
   await assert.rejects(db.query("insert into whatsapp_handoff_links(token_hash,link_type,phone_e164,user_id,expires_at) values(repeat('a',64),'card','+447000000001',$1,now()+interval '1 hour')",[user]),/contact is not linked/);
   await db.query('update whatsapp_contacts set user_id=$1',[user]);
  });
  await t.test('two dispatchers claim one job; budget defaults to 500 and caps attempts',async()=>{
   const c2=await f.newClient();await db.query('update whatsapp_dispatch_settings set daily_cap=1');
   const jobs=await Promise.all([db.query('select claim_whatsapp_outbox() j'),c2.query('select claim_whatsapp_outbox() j')]);
   assert.equal(jobs.filter(x=>x.rows[0].j).length,1);const job=jobs.find(x=>x.rows[0].j).rows[0].j;
   let sends=0;const result=await sendWhatsAppTemplate(job,async(_url,init)=>{sends++;const body=JSON.parse(init.body);assert.equal(body.type,'template');assert.equal(body.template.language.code,'en_GB');return Response.json({messages:[{id:'fake-1'}]});},'http://fake','fake');
   await db.query('select finish_whatsapp_outbox($1,$2,$3,$4)',[job.id,job.lease_id,result.outcome,result.message]);assert.equal(sends,1);
   assert.equal((await db.query('select claim_whatsapp_outbox() j')).rows[0].j,null);
  });
  await t.test('retry cap and expired lease become terminal',async()=>{
   await db.query('update whatsapp_dispatch_settings set daily_cap=500');
   for(let i=0;i<3;i++){await db.query("update whatsapp_outbox set available_at=now() where status='pending'");const j=(await db.query('select claim_whatsapp_outbox() j')).rows[0].j;assert.ok(j);const r=await sendWhatsAppTemplate(j,async()=>new Response('',{status:429}),'http://fake','fake');await db.query('select finish_whatsapp_outbox($1,$2,$3)',[j.id,j.lease_id,r.outcome]);}
   assert.equal((await db.query("select count(*) n from whatsapp_outbox where status='failed'")).rows[0].n,'1');
  });
  await t.test('auth rejection and no client outbox access',async()=>{assert.equal(await sameSecret('secret','Bearer wrong'),false);assert.equal(await sameSecret('secret','Bearer secret'),true);await assert.rejects(as(db,'authenticated',user,'select * from whatsapp_outbox'),/permission denied/);});
  await t.test('inbound reservation is atomic and bounded; STOP bypasses cap',async()=>{const c2=await f.newClient();const p='+447000000001';const race=await Promise.all([db.query('select reserve_whatsapp_inbound($1,$2,$3) ok',['same',p,'question']),c2.query('select reserve_whatsapp_inbound($1,$2,$3) ok',['same',p,'question'])]);assert.equal(race.filter(r=>r.rows[0].ok).length,1);for(let i=0;i<19;i++)assert.equal((await db.query('select reserve_whatsapp_inbound($1,$2,$3) ok',[String(i),p,'question'])).rows[0].ok,true);assert.equal((await db.query('select reserve_whatsapp_inbound($1,$2,$3) ok',['over',p,'question'])).rows[0].ok,false);assert.equal((await db.query('select reserve_whatsapp_inbound($1,$2,$3) ok',['stop',p,'stop'])).rows[0].ok,true);});
  await t.test('progress in flight coalesces latest and enforces thirty-minute send spacing',async()=>{
   assert.ok((await db.query('select opted_out_at from whatsapp_contacts')).rows[0].opted_out_at);
   try{throw Error('handler crashed after STOP reservation')}catch{}
   assert.ok((await db.query('select opted_out_at from whatsapp_contacts')).rows[0].opted_out_at);
   await db.query('update whatsapp_contacts set opted_out_at=null');
   await db.query("update whatsapp_outbox set sent_at=now()-interval '31 minutes' where event_type='spend_progress' and status='sent'");
   await spend(100);const job=(await db.query('select claim_whatsapp_outbox() j')).rows[0].j;assert.ok(job);
   await spend(100);await spend(100);assert.equal((await db.query("select count(*) n from whatsapp_outbox where status='pending' and event_type='spend_progress'")).rows[0].n,'1');
   assert.equal((await db.query('select claim_whatsapp_outbox() j')).rows[0].j,null);
   await db.query("select finish_whatsapp_outbox($1,$2,'sent','fake-later')",[job.id,job.lease_id]);assert.equal((await db.query('select claim_whatsapp_outbox() j')).rows[0].j,null);
   await db.query("update whatsapp_outbox set available_at=now(),status='sending',lease_until=now()-interval '1 minute' where status='pending'");await db.query('select claim_whatsapp_outbox()');assert.equal((await db.query("select count(*) n from whatsapp_outbox where error_message='delivery_unknown'")).rows[0].n,'1');
  });
  await t.test('broken queue never rolls back spend',async()=>{
   const before=(await db.query('select reward_progress_pence p from memberships where user_id=$1',[user])).rows[0].p;
   await db.query('alter table whatsapp_outbox rename to temporarily_unavailable_outbox');try{await spend(50)}finally{await db.query('alter table temporarily_unavailable_outbox rename to whatsapp_outbox')}
   assert.equal((await db.query('select reward_progress_pence p from memberships where user_id=$1',[user])).rows[0].p,before+50);
  });
  await t.test('account deletion cascades contact/outbox',async()=>{await db.query('delete from transactions');await db.query('delete from rewards');await db.query('delete from memberships');await db.query('delete from notifications');await db.query('delete from auth.users where id=$1',[user]);assert.equal(await count(),0);assert.equal((await db.query('select count(*) n from whatsapp_contacts')).rows[0].n,'0');});
 } finally {await f.stop();}
});

