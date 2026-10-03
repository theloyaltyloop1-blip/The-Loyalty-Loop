import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';

test('Admin-chosen Trending shops on disposable PostgreSQL',async t=>{
 const f=await startFidelDatabase('admin-trending-');const db=f.client;
 try {
  // The live columns and grants the migration relies on.
  await db.query(`alter table businesses add column if not exists is_active boolean not null default true,
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
  const [owner,admin,other]=[randomUUID(),randomUUID(),randomUUID()];
  await db.query('insert into auth.users select unnest($1::uuid[])',[[owner,admin,other]]);
  await db.query('insert into test_admins values($1)',[admin]);
  const shops=Array.from({length:14},()=>randomUUID());
  for(const [i,id] of shops.entries()) await db.query('insert into businesses(id,owner_id,name) values($1,$2,$3)',[id,owner,`Shop ${i}`]);
  const [a,b,c,inactive,pending]=shops;
  await db.query('update businesses set is_active=false where id=$1',[inactive]);
  await db.query("update businesses set approval_status='pending' where id=$1",[pending]);
  // Attach the live guard after fixture setup: it also blocks un-authenticated maintenance updates.
  await db.query(`create trigger enforce_businesses_update_scope before update on public.businesses
    for each row execute function public.enforce_businesses_update_scope();`);
  const picks=async()=>(await db.query('select id,trending_position from businesses where trending order by trending_position')).rows;
  const save=(uid,ids)=>as(db,'authenticated',uid,'select admin_set_trending($1::uuid[])',[ids]);

  await t.test('owners cannot promote their own shop',async()=>{
   await assert.rejects(as(db,'authenticated',owner,'update businesses set trending=true where id=$1',[a]),/only be changed by an admin/);
   await assert.rejects(as(db,'authenticated',owner,'update businesses set trending_position=1 where id=$1',[a]),/only be changed by an admin/);
   // Ordinary owner edits still work.
   await as(db,'authenticated',owner,"update businesses set name='Renamed' where id=$1",[a]);
   assert.equal((await db.query('select name from businesses where id=$1',[a])).rows[0].name,'Renamed');
  });
  await t.test('only admins can save the list',async()=>{
   await assert.rejects(save(owner,[a]),/not allowed/);
   await assert.rejects(save(other,[a]),/not allowed/);
   await assert.rejects(as(db,'anon',null,'select admin_set_trending($1::uuid[])',[[a]]),/permission denied/);
   assert.deepEqual(await picks(),[]);
  });
  await t.test('admin saves the exact order, and a new save replaces it',async()=>{
   await save(admin,[c,a,b]);
   assert.deepEqual((await picks()).map(r=>[r.id,r.trending_position]),[[c,1],[a,2],[b,3]]);
   await save(admin,[b,c]);
   assert.deepEqual((await picks()).map(r=>[r.id,r.trending_position]),[[b,1],[c,2]]);
   assert.equal((await db.query('select trending,trending_position from businesses where id=$1',[a])).rows[0].trending_position,null);
   await save(admin,[]);
   assert.deepEqual(await picks(),[]);
  });
  await t.test('rejects inactive, unapproved, duplicate, unknown and oversized lists',async()=>{
   await save(admin,[a]);
   await assert.rejects(save(admin,[a,inactive]),/approved, active/);
   await assert.rejects(save(admin,[pending]),/approved, active/);
   await assert.rejects(save(admin,[randomUUID()]),/approved, active/);
   await assert.rejects(save(admin,[a,a]),/only appear once/);
   await assert.rejects(save(admin,shops.filter(id=>id!==inactive&&id!==pending).concat(randomUUID())),/at most 12/);
   // A rejected save leaves the previous list untouched.
   assert.deepEqual((await picks()).map(r=>r.id),[a]);
  });
 } finally {await f.stop()}
});
