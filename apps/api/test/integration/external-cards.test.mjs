import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { startFidelDatabase, as } from './fidel-fixture.mjs';

test('external cards: owner RLS, cap, uniqueness and account cascade', { timeout: 120000 }, async () => {
 const f = await startFidelDatabase('wallet-'); const db = f.client;
 try {
  await db.query(`grant select,update on profiles to authenticated;
   alter table profiles enable row level security;
   create policy own_profile on profiles to authenticated using(id=auth.uid()) with check(id=auth.uid());`);
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261017234534_shopper_external_cards.sql', import.meta.url), 'utf8'));
  const a=randomUUID(), b=randomUUID();
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.query('insert into profiles(id) values($1),($2)',[a,b]);
  const insert=(actor,owner,number='123456')=>as(db,'authenticated',actor,`insert into shopper_external_cards(user_id,brand_key,label,card_number,barcode_format) values($1,'other','Card',$2,'code128') returning id`,[owner,number]);
  const id=(await insert(a,a)).rows[0].id;
  await insert(b,b);
  assert.equal((await as(db,'authenticated',b,'select * from shopper_external_cards where id=$1',[id])).rowCount,0);
  assert.equal((await as(db,'authenticated',b,"update shopper_external_cards set label='Stolen' where id=$1",[id])).rowCount,0);
  assert.equal((await as(db,'authenticated',b,'delete from shopper_external_cards where id=$1',[id])).rowCount,0);
  await assert.rejects(insert(b,a,'9999'));
  await assert.rejects(as(db,'anon',null,'select * from shopper_external_cards'),/permission denied/);
  await assert.rejects(as(db,'authenticated',a,'update shopper_external_cards set user_id=$1 where id=$2',[b,id]),/ownership/);
  await assert.rejects(insert(a,a),/unique constraint/);
  await assert.rejects(insert(a,a,'x'),/check constraint/);
  await as(db,'authenticated',a,"update shopper_external_cards set label='Renamed' where id=$1",[id]);
  assert.equal((await as(db,'authenticated',a,'select label from shopper_external_cards where id=$1',[id])).rows[0].label,'Renamed');
  for(let i=1;i<30;i++) await insert(a,a,`1000${i}`);
  await assert.rejects(insert(a,a,'99999'),/limit reached/);
  await as(db,'authenticated',a,'delete from shopper_external_cards where id=$1',[id]);
  await insert(a,a,'99999');
  // Two independent connections race for the last slot. Exactly one may win.
  await as(db,'authenticated',a,'delete from shopper_external_cards where card_number=$1',['99999']);
  const left=await f.newClient(), right=await f.newClient();
  try {
   const concurrent = await Promise.allSettled([left,right].map((client,i)=>as(client,'authenticated',a,
    "insert into shopper_external_cards(user_id,brand_key,label,card_number,barcode_format) values($1,'other','Race',$2,'code128')",[a,`race${i}`])));
   assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
   assert.equal((await db.query('select count(*)::int n from shopper_external_cards where user_id=$1',[a])).rows[0].n,30);
  } finally { await left.end(); await right.end(); }
  await db.query('delete from auth.users where id=$1',[a]);
  assert.equal((await db.query('select * from shopper_external_cards where user_id=$1',[a])).rowCount,0);
  assert.equal((await db.query('select * from shopper_external_cards where user_id=$1',[b])).rowCount,1);
 } finally { await f.stop(); }
});
