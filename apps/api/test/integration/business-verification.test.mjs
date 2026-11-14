import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';

// Compulsory business verification (20261109120000_business_verification_ai.sql)
// on a disposable PostgreSQL with a focused businesses schema.

const migration = () => readFile(new URL('../../../../supabase/migrations/20261109120000_business_verification_ai.sql',import.meta.url),'utf8');

test('Business verification: shadow/live switch, apply, spot-checks', async t => {
 const f=await startFidelDatabase('business-verification-'); const db=f.client;
 try {
  await db.query(`
   create type public.business_approval_status as enum ('pending','approved','rejected');
   alter table businesses
     add column if not exists updated_at timestamptz not null default now(),
     add column if not exists postcode text,
     add column if not exists google_place_id text,
     add column if not exists approval_status business_approval_status not null default 'approved',
     add column if not exists approved_at timestamptz,
     add column if not exists verification_status text not null default 'unverified',
     add column if not exists verification_submitted_at timestamptz,
     add column if not exists verification_reviewed_at timestamptz,
     add column if not exists trending boolean not null default false,
     add column if not exists trending_position smallint;
   create table public.business_private (
     business_id uuid primary key references businesses(id) on delete cascade,
     verification_document_path text, verification_document_label text,
     verification_rejection_reason text, verification_reviewed_by uuid,
     approved_by uuid, rejection_reason text);
   alter table profiles add column if not exists email text;
   create table public.platform_audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid,
     action text not null, target_type text not null, target_id text, detail jsonb not null default '{}', created_at timestamptz not null default now());
   create schema business_activation_private;
   create table business_activation_private.capabilities (backend int, transaction_id bigint, business_id uuid, owner_id uuid, target_active boolean);
   create table public.joined_requests (place_id text, business_id uuid);
   create function public.join_requested_shop(p_place_id text, p_business_id uuid) returns void
     language sql security definer as $$ insert into public.joined_requests values (p_place_id, p_business_id) $$;
   create function public.enforce_business_insert_defaults() returns trigger language plpgsql as $$ begin return new; end $$;
   create function public.enforce_businesses_update_scope() returns trigger language plpgsql as $$ begin return new; end $$;
   create trigger enforce_business_insert_defaults before insert on businesses for each row execute function enforce_business_insert_defaults();
   create trigger enforce_businesses_update_scope before update on businesses for each row execute function enforce_businesses_update_scope();
   alter table businesses enable row level security;
   create policy b_read on businesses for select using (true);
   create policy b_insert on businesses for insert to authenticated with check (owner_id = auth.uid());
   create policy b_update on businesses for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
   grant select, insert, update on businesses to authenticated;
   grant select on business_private to authenticated;
   grant all on all tables in schema public to service_role;
   grant usage on schema public to service_role, authenticated;`);

  const sql = await migration();
  await db.query(sql);
  await db.query(sql); // re-runnable
  await db.query('grant all on public.business_verification_checks, public.business_verification_settings to service_role');

  const [owner,other,adminUser]=[randomUUID(),randomUUID(),randomUUID()];
  await db.query('insert into auth.users select unnest($1::uuid[])',[[owner,other,adminUser]]);
  await db.query('insert into test_admins values ($1)',[adminUser]);
  const svc=(q,p)=>as(db,'service_role',null,q,p);
  const shopRow=async id=>(await db.query('select * from businesses where id=$1',[id])).rows[0];
  const newShop=async(uid,name='Bean There')=>{
   const id=randomUUID();
   await as(db,'authenticated',uid,"insert into businesses(id,owner_id,name,postcode) values($1,$2,$3,'M4 1HN')",[id,uid,name]);
   return id;
  };
  const submit=async(id,path)=>{
   await db.query('insert into business_private(business_id,verification_document_path) values($1,$2) on conflict (business_id) do update set verification_document_path=excluded.verification_document_path',[id,path]);
   await db.query("update businesses set verification_status='pending', verification_submitted_at=now() where id=$1",[id]);
  };
  const check=async(id,uid,path,over={})=>{
   const c={decision:'approved',decided_by:'rules',mode:'live',company_number:null,spot_check:false,owner_message:null,...over};
   return (await svc(`insert into business_verification_checks(business_id,owner_id,document_path,route,mode,decision,decided_by,company_number,spot_check,owner_message)
     values($1,$2,$3,'company',$4,$5,$6,$7,$8,$9) returning id`,[id,uid,path,c.mode,c.decision,c.decided_by,c.company_number,c.spot_check,c.owner_message])).rows[0].id;
  };
  const apply=async id=>(await svc('select public.apply_business_verification($1) as r',[id])).rows[0].r;

  await t.test('shadow mode (default): new shops go live as before', async()=>{
   const id=await newShop(owner);
   assert.equal((await shopRow(id)).approval_status,'approved');
  });

  await t.test('only admins switch the mode', async()=>{
   await assert.rejects(as(db,'authenticated',owner,"select public.admin_set_business_verification_mode('live')"),/admin only/);
   await assert.rejects(as(db,'authenticated',owner,"update business_verification_settings set mode='live'"),/permission denied/);
   await as(db,'authenticated',adminUser,"select public.admin_set_business_verification_mode('live')");
   assert.equal((await db.query('select mode from business_verification_settings')).rows[0].mode,'live');
  });

  await t.test('live mode: owner-created shops start hidden, admin-created ones do not', async()=>{
   const id=await newShop(owner);
   assert.equal((await shopRow(id)).approval_status,'pending');
   const adminShop=randomUUID();
   await as(db,'authenticated',adminUser,"insert into businesses(id,owner_id,name) values($1,$2,'Admin shop')",[adminShop,adminUser]);
   assert.equal((await shopRow(adminShop)).approval_status,'approved');
  });

  await t.test('owners cannot write checks or apply them', async()=>{
   const id=await newShop(owner); await submit(id,`${owner}/a.png`);
   await assert.rejects(as(db,'authenticated',owner,"insert into business_verification_checks(business_id,owner_id,document_path,route,mode,decision,decided_by) values($1,$2,'x','company','live','approved','rules')",[id,owner]),/permission denied/);
   const c=await check(id,owner,`${owner}/a.png`);
   await assert.rejects(as(db,'authenticated',owner,'select public.apply_business_verification($1)',[c]),/permission denied/);
   assert.equal((await as(db,'authenticated',owner,'select count(*)::int n from business_verification_checks')).rows[0].n,0,'owners cannot read checks directly');
  });

  await t.test('an approval verifies and puts a hidden shop live, once', async()=>{
   const id=await newShop(owner); await submit(id,`${owner}/b.png`);
   await db.query("update businesses set google_place_id='place-1' where id=$1",[id]);
   const c=await check(id,owner,`${owner}/b.png`,{company_number:'12345678'});
   assert.equal(await apply(c),'approved');
   const s=await shopRow(id);
   assert.equal(s.verification_status,'verified'); assert.equal(s.approval_status,'approved'); assert.ok(s.approved_at);
   assert.equal((await db.query('select verified_company_number from business_private where business_id=$1',[id])).rows[0].verified_company_number,'12345678');
   assert.equal((await db.query('select count(*)::int n from joined_requests where business_id=$1',[id])).rows[0].n,1,'waiting shoppers are linked');
   assert.equal(await apply(c),'already_applied');
  });

  await t.test('a number already verified elsewhere turns an approval into a rejection', async()=>{
   const id=await newShop(other,'Copycat'); await submit(id,`${other}/c.png`);
   const c=await check(id,other,`${other}/c.png`,{company_number:'12345678'});
   assert.equal(await apply(c),'rejected');
   const s=await shopRow(id);
   assert.equal(s.verification_status,'rejected'); assert.equal(s.approval_status,'pending');
   assert.match((await db.query('select verification_rejection_reason r from business_private where business_id=$1',[id])).rows[0].r,/already verified/);
  });

  await t.test('rejections reach the owner; stale and shadow checks change nothing', async()=>{
   const id=await newShop(owner); await submit(id,`${owner}/d.png`);
   const stale=await check(id,owner,`${owner}/old.png`);
   assert.equal(await apply(stale),'stale');
   const shadow=await check(id,owner,`${owner}/d.png`,{mode:'shadow'});
   assert.equal(await apply(shadow),'recorded');
   assert.equal((await shopRow(id)).verification_status,'pending');
   const r=await check(id,owner,`${owner}/d.png`,{decision:'rejected',decided_by:'ai',owner_message:'Upload a rates bill.'});
   assert.equal(await apply(r),'rejected');
   const mine=(await as(db,'authenticated',owner,'select * from public.my_business_verification($1)',[id])).rows[0];
   assert.equal(mine.decision,'rejected'); assert.equal(mine.owner_message,'Upload a rates bill.'); assert.equal(mine.mode,'live');
   await assert.rejects(as(db,'authenticated',other,'select * from public.my_business_verification($1)',[id]),/not your business/);
  });

  await t.test('spot-check: admins can undo an AI approval, which hides the shop again', async()=>{
   const id=await newShop(owner,'Sole Trader Cafe'); await submit(id,`${owner}/e.png`);
   const c=await check(id,owner,`${owner}/e.png`,{decided_by:'ai',spot_check:true});
   assert.equal(await apply(c),'approved');
   const list=(await as(db,'authenticated',adminUser,'select * from public.admin_business_verification_checks(true)')).rows;
   assert.ok(list.some(x=>x.id===c));
   await assert.rejects(as(db,'authenticated',owner,'select public.admin_spot_check_business_verification($1,false)',[c]),/admin only/);
   await as(db,'authenticated',adminUser,"select public.admin_spot_check_business_verification($1,false,'Not a real shop')",[c]);
   const s=await shopRow(id);
   assert.equal(s.verification_status,'rejected'); assert.equal(s.approval_status,'pending');
   const after=(await as(db,'authenticated',adminUser,'select * from public.admin_business_verification_checks(true)')).rows;
   assert.ok(!after.some(x=>x.id===c),'checked items leave the list');
  });

  await t.test('admin approval of a hidden shop puts it live', async()=>{
   const id=await newShop(owner,'Manual'); await submit(id,`${owner}/f.png`);
   await as(db,'authenticated',adminUser,'select public.admin_review_business_verification($1,true)',[id]);
   const s=await shopRow(id);
   assert.equal(s.verification_status,'verified'); assert.equal(s.approval_status,'approved');
  });

  await t.test('owners still cannot approve themselves', async()=>{
   const id=await newShop(owner,'Cheeky');
   await assert.rejects(as(db,'authenticated',owner,"update businesses set approval_status='approved' where id=$1",[id]),/only be changed by an admin/);
   await submit(id,`${owner}/g.png`);
   await assert.rejects(as(db,'authenticated',owner,"update businesses set verification_status='verified' where id=$1",[id]),/owners can only submit/);
  });
 } finally { await f.stop(); }
});
