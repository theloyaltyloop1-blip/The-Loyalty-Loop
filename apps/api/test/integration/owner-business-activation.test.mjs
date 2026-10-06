import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';

test('Owner activation RPCs on disposable PostgreSQL (focused schema)', async t => {
 const f=await startFidelDatabase('owner-activation-'); const db=f.client;
 try {
  await db.query(`alter table businesses add column if not exists is_active boolean not null default true,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists approval_status text not null default 'approved',
    add column if not exists approved_at timestamptz, add column if not exists approved_by uuid,
    add column if not exists rejection_reason text,
    add column if not exists verification_status text not null default 'unverified',
    add column if not exists verification_document_path text, add column if not exists verification_document_label text,
    add column if not exists verification_submitted_at timestamptz, add column if not exists verification_reviewed_at timestamptz,
    add column if not exists verification_reviewed_by uuid, add column if not exists verification_rejection_reason text,
    add column if not exists trending boolean not null default false;
   alter table businesses enable row level security;
   create policy trending_test_read on businesses for select using (true);
   create policy trending_test_update on businesses for update to authenticated
     using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'))
     with check (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
   grant select, update on businesses to authenticated;`);
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261003004334_admin_trending_shops.sql',import.meta.url),'utf8'));

  const [owner,staff,customer,other,brand]=Array.from({length:5},()=>randomUUID());
  const shop=randomUUID(), secondShop=randomUUID(), otherShop=randomUUID();
  await db.query('insert into auth.users select unnest($1::uuid[])',[[owner,staff,customer,other,brand]]);
  await db.query("insert into businesses(id,owner_id,name) values($1,$2,'Target'),($3,$2,'Second'),($4,$5,'Other')",[shop,owner,secondShop,otherShop,other]);
  await db.query("insert into test_staff values($1,$2,'scan_stamps')",[shop,staff]);
  await db.query('create trigger enforce_businesses_update_scope before update on businesses for each row execute function enforce_businesses_update_scope()');
  await db.query('create trigger set_updated_at before update on businesses for each row execute function update_updated_at_column()');
  const active=async id=>(await db.query('select is_active from businesses where id=$1',[id])).rows[0].is_active;
  const updatedAt=async id=>(await db.query('select updated_at from businesses where id=$1',[id])).rows[0].updated_at;
  const call=(uid,businessId=shop,name='deactivate_my_business')=>as(db,'authenticated',uid,`select * from public.${name}($1::uuid)`,[businessId]);
  const notOwner=error=>error?.code === '42501' && /Only the shop owner can change shop activation/.test(error.message);

  await t.test('reproduces the original direct UPDATE failure',async()=>{
   await assert.rejects(as(db,'authenticated',owner,'update businesses set is_active=false where id=$1',[shop]),/only be changed by an admin/);
  });
  const migration=await readFile(new URL('../../../../supabase/migrations/20261005233233_owner_business_activation.sql',import.meta.url),'utf8');
  await db.query(migration);
  await db.query(migration);
  await t.test('owner deactivates, repeats safely, and reactivates with set_updated_at',async()=>{
   const before=await updatedAt(shop);
   const r=await call(owner); assert.equal(r.rows[0].id,shop);
   assert.equal(await active(shop),false); assert.equal(await active(secondShop),true); assert.notEqual(await updatedAt(shop),before);
   await call(owner); await call(owner,shop,'reactivate_my_business'); assert.equal(await active(shop),true);
  });
  await t.test('staff, customer, brand-only and unauthenticated callers rejected in both directions',async()=>{
   for(const name of ['deactivate_my_business','reactivate_my_business']) {
    for(const uid of [staff,customer,brand,null]) await assert.rejects(call(uid,shop,name),notOwner);
    await assert.rejects(as(db,'anon',null,`select * from public.${name}($1::uuid)`,[shop]),/permission denied/);
   }
  });
  await t.test('multi-shop owners change each selected shop and cannot target other or unknown shops',async()=>{
   await call(owner,shop); await call(owner,secondShop);
   assert.equal(await active(shop),false); assert.equal(await active(secondShop),false);
   await call(owner,shop,'reactivate_my_business'); await call(owner,secondShop,'reactivate_my_business');
   assert.equal(await active(shop),true); assert.equal(await active(secondShop),true);
   await assert.rejects(call(owner,otherShop),notOwner);
   await assert.rejects(call(owner,randomUUID()),notOwner);
   await assert.rejects(call(other,shop),notOwner);
   await call(other,otherShop); assert.equal(await active(otherShop),false);
  });
  await t.test('direct UPDATE and forged capability remain blocked; ordinary edits work',async()=>{
   await assert.rejects(as(db,'authenticated',owner,'update businesses set is_active=false where id=$1',[shop]),/only be changed by an admin/);
   await assert.rejects(as(db,'authenticated',owner,'insert into business_activation_private.capabilities values(pg_backend_pid(),txid_current(),$1,$2,false)',[shop,owner]),/permission denied/);
   await assert.rejects(as(db,'authenticated',owner,'update businesses set trending=true where id=$1',[shop]),/only be changed by an admin/);
   await as(db,'authenticated',owner,"update businesses set name='Edited' where id=$1",[shop]);
   await call(owner,shop);
   await assert.rejects(as(db,'authenticated',owner,'update businesses set is_active=true where id=$1',[shop]),/only be changed by an admin/);
   assert.equal((await db.query('select count(*)::int as n from business_activation_private.capabilities')).rows[0].n,0);
  });
   await t.test('inactive shops reject stamps, reward redemption and manual spend until reactivated',async()=>{
    const gatedCustomer=randomUUID(), rewardId=randomUUID();
    await db.query('insert into auth.users(id) values($1)',[gatedCustomer]);
    await db.query('insert into memberships(user_id,business_id) values($1,$2),($1,$3)',[gatedCustomer,shop,secondShop]);
    await db.query("update businesses set reward_model='spend_threshold', reward_threshold_pence=100 where id=$1",[secondShop]);
    await db.query('insert into rewards(id,user_id,business_id,title,qr_token,short_code) values($1,$2,$3,$4,$5,$6)',[rewardId,gatedCustomer,shop,'Reward','inactive-reward-token','inactive-reward']);
    await db.query('grant select, update on public.rewards to authenticated');
    const stamp=()=>as(db,'authenticated',owner,"insert into transactions(user_id,business_id,type,value) values($1,$2,'stamp',1)",[gatedCustomer,shop]);
    const redeem=()=>as(db,'authenticated',owner,'update rewards set redeemed_at=now() where id=$1',[rewardId]);
    const spend=()=>as(db,'authenticated',owner,'select public.record_manual_spend($1,$2,10,$3,$4)',[secondShop,gatedCustomer,'cash',randomUUID()]);

    await call(owner,shop); await call(owner,secondShop);
    for(const write of [stamp,redeem,spend]) await assert.rejects(write(),/business is inactive/);

    await call(owner,shop,'reactivate_my_business'); await call(owner,secondShop,'reactivate_my_business');
    await stamp(); await redeem(); await spend();
    assert.equal((await db.query('select redeemed_at is not null as redeemed from rewards where id=$1',[rewardId])).rows[0].redeemed,true);
   });
  await t.test('updated guard keeps admin activation and Trending privileges',async()=>{
   await db.query('insert into test_admins values($1)',[customer]);
   await as(db,'authenticated',customer,'update businesses set is_active=true, trending=true, trending_position=1 where id=$1',[otherShop]);
   assert.equal(await active(otherShop),true);
   assert.equal((await db.query('select trending from businesses where id=$1',[otherShop])).rows[0].trending,true);
  });
 } finally {await f.stop()}
});
