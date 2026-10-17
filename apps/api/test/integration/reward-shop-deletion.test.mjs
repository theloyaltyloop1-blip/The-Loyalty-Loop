import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';
test('reward and shop deletion regressions', {timeout:120000}, async t=>{
 const f=await startFidelDatabase('reward-delete-');const db=f.client;
 try {
 await db.query(`create type app_role as enum ('admin','business_owner','consumer');
 create function has_role(uuid,app_role) returns boolean language sql stable security definer as $$ select exists(select 1 from test_admins where user_id=$1) $$;
 create type loyalty_type as enum ('stamp_card','points','tiered');
 alter table businesses add column loyalty_type loyalty_type default 'stamp_card',add column loyalty_config jsonb default '{}';
 alter table reward_catalog drop constraint reward_catalog_business_id_fkey;
 alter table reward_catalog add foreign key(business_id) references businesses(id) on delete cascade;
 grant select, delete on reward_catalog to authenticated;`);
 await db.query(await readFile(new URL('../../../../supabase/migrations/20261017225143_fix_reward_and_shop_deletion.sql',import.meta.url),'utf8'));
 await db.query(`create trigger award_stamps after insert on transactions for each row when(new.type='stamp') execute function handle_stamp_transaction()`);
 const [owner,customer,admin,stranger,shop,a,b]=Array.from({length:7},()=>randomUUID());
 await db.query('insert into auth.users select unnest($1::uuid[])',[[owner,customer,admin,stranger]]);
 await db.query('insert into test_admins values($1)',[admin]);
 await db.query("insert into businesses(id,owner_id,name) values($1,$2,'Target')",[shop,owner]);
 await db.query('insert into memberships(user_id,business_id,stamp_count) values($1,$2,9)',[customer,shop]);
 await db.query("insert into reward_catalog(id,business_id,title,stamp_threshold) values($1,$3,'Coffee',10),($2,$3,'Cake',10)",[a,b,shop]);
 await t.test('both tied rewards are issued on crossing',async()=>{
 await as(db,'authenticated',owner,"insert into transactions(user_id,business_id,type,value) values($1,$2,'stamp',1)",[customer,shop]);
 assert.deepEqual((await db.query('select catalog_id from rewards where business_id=$1',[shop])).rows.map(r=>r.catalog_id).sort(),[a,b].sort());
 assert.equal((await db.query('select stamp_count from memberships where business_id=$1',[shop])).rows[0].stamp_count,0);
 });
 await t.test('earned reward survives catalogue deletion with null catalog_id',async()=>{
 const before=(await db.query('select * from rewards where catalog_id=$1',[a])).rows[0];
 await as(db,'authenticated',owner,'delete from reward_catalog where id=$1',[a]);
 assert.deepEqual((await db.query('select * from rewards where id=$1',[before.id])).rows[0],{...before,catalog_id:null});
 });
 const del=(uid,name='Target')=>as(db,'authenticated',uid,'select delete_owned_business($1,$2)',[shop,name]);
 await t.test('non-owner and wrong-name admin denied',async()=>{
 await assert.rejects(del(stranger),/shop not found or confirmation/);
 await assert.rejects(del(admin,'Wrong'),/shop not found or confirmation/);
 assert.equal((await db.query('select count(*)::int n from businesses where id=$1',[shop])).rows[0].n,1);
 });
 await t.test('admin deletes another owners shop and loyalty data',async()=>{
 await del(admin);
 for(const table of ['businesses','memberships','rewards','transactions','notifications','reward_catalog']) assert.equal((await db.query(`select count(*)::int n from ${table} where ${table==='businesses'?'id':'business_id'}=$1`,[shop])).rows[0].n,0,table);
 });
 }finally{await f.stop()}
});
