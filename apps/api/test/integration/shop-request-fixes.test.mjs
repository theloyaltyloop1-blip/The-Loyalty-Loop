import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';
import {searchHandler,signPlace} from '../../../../supabase/functions/_shared/shop-requests.ts';
import {notifyHandler} from '../../../../supabase/functions/_shared/shop-request-notify.ts';
// Review fixes F1-F3 on disposable PostgreSQL with fake Places/Resend providers.
test('Shop request review fixes: bounded notify, details budget, narrow delete locks',async t=>{
 const f=await startFidelDatabase('shop-fixes-'),db=f.client;
 try{
  const migration=async name=>readFile(new URL('../../../../supabase/migrations/'+name,import.meta.url),'utf8');
  await db.query(`create schema extensions;create extension pgcrypto with schema extensions;create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
   insert into vault.decrypted_secrets values('SHOP_REQUEST_SIGNING_SECRET','fake'),('SHOP_REQUEST_NOTIFY_SECRET','fake');
   create schema net;create table net.wakes(url text,body jsonb);
   create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language plpgsql as $$begin insert into net.wakes values(url,body);return 1;end$$;
   alter table businesses add column lat double precision,add column lng double precision,add column is_active boolean default true,add column approval_status text default 'approved';
   create schema cron;create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
   create table cron.job_run_details(jobid bigint,status text,start_time timestamptz);
   create function cron.schedule(n text,s text,c text) returns bigint language plpgsql as $$declare id bigint;begin insert into cron.job(jobname,schedule,command) values(n,s,c) on conflict(jobname) do update set schedule=s,command=c returning jobid into id;return id;end$$;`);
  await db.query(await migration('20261002211052_shop_requests_phase_a.sql'));
  await db.query((await migration('20261002211306_scheduled_delivery_recovery.sql')).replace('create extension if not exists pg_cron;',''));
  await db.query(await migration('20261002230326_shop_request_review_fixes.sql'));
  const users=Array.from({length:8},()=>randomUUID()),admin=users[7];
  await db.query('insert into auth.users select unnest($1::uuid[])',[users]);await db.query('insert into test_admins values($1)',[admin]);
  const place=id=>({place_id:id,name:'Shop '+id,address:'Leeds, UK',postcode:'LS1 1AA',lat:53.8,lng:-1.55,website:null,phone:null,primary_type:'cafe',country:'GB'});
  const vote=async(uid,id,client=db)=>as(client,'authenticated',uid,'select request_shop($1) r',[await signPlace(place(id),uid,'fake')]);
  const shop=async id=>(await db.query('select * from requested_shops where place_id=$1',[id])).rows[0];
  const sweep=async()=>{const {command}=(await db.query("select command from cron.job where jobname='shop-request-delivery-recovery'")).rows[0];await db.query('delete from net.wakes');await db.query(command);return (await db.query('select body from net.wakes')).rows.map(r=>r.body.place_id);};

  await t.test('F1 persistent Places failure: bounded details calls, backoff and exactly one fallback email',async()=>{
   await db.query('update shop_request_settings set threshold=1');await vote(users[0],'broken');assert.equal((await shop('broken')).status,'ready');
   let detailCalls=0,mails=[];
   const handler=notifyHandler({
    begin:async id=>(await db.query('select begin_shop_request_notify($1) r',[id])).rows[0].r,
    details:async()=>{detailCalls++;throw Error('fake NOT_FOUND');},
    claim:async id=>(await db.query('select claim_shop_request_notify($1) r',[id])).rows[0].r,
    current:shop,finish:async(id,lease,sent)=>{await db.query('select finish_shop_request_notify($1,$2,$3)',[id,lease,sent]);},joined:async()=>[]
   },async(_url,init)=>{mails.push(JSON.parse(init.body));return Response.json({id:'fake-mail'});},
   n=>({SHOP_REQUEST_NOTIFY_SECRET:'fake',RESEND_API_KEY:'fake',SHOP_REQUEST_OPERATOR_EMAIL:'operator@example.test'})[n]);
   const req=()=>new Request('http://fake',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({place_id:'broken'})});
   assert.equal((await handler(req())).status,502);assert.equal((await shop('broken')).notify_attempts,1);
   // Not yet due: neither the sweep nor a duplicate wake reaches the provider.
   assert.deepEqual(await sweep(),[]);assert.deepEqual(await (await handler(req())).json(),{skipped:true});assert.equal(detailCalls,1);
   for(let i=0;i<20;i++){
    await db.query("update requested_shops set next_attempt_at=now()-interval '1 second' where place_id='broken' and next_attempt_at is not null");
    for(const id of await sweep())await handler(new Request('http://fake',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({place_id:id})}));
   }
   assert.equal(detailCalls,3,'details stop after the third failure');assert.equal(mails.length,1,'exactly one operator email');
   assert.match(mails[0].text,/Google Places ID: broken/);assert.match(mails[0].text,/https:\/\/www\.google\.com\/maps\/place\/\?q=place_id:broken/);
   assert.match(mails[0].subject,/^1 local shopper has asked for shop broken$/);
   const done=await shop('broken');assert.ok(done.email_attempted_at&&done.email_sent_at);assert.equal(done.notify_attempts,3);
   assert.deepEqual(await sweep(),[],'a sent shop is never swept again');
  });

  await t.test('F1 backoff schedule and five-attempt ceiling are enforced in the database',async()=>{
   await vote(users[1],'slow');await db.query("update requested_shops set next_attempt_at=now() where place_id='slow'");
   const minutes=[];
   for(let i=1;i<=6;i++){
    const r=(await db.query("select begin_shop_request_notify('slow') r")).rows[0].r;
    if(i<=5)assert.equal(r.attempt,i);else assert.equal(r,null);
    const s=await shop('slow');if(s.next_attempt_at)minutes.push(Math.round((new Date(s.next_attempt_at)-Date.now())/60000));
    await db.query("update requested_shops set next_attempt_at=case when next_attempt_at is null then null else now() end where place_id='slow'");
   }
   assert.deepEqual(minutes,[1,10,60,360]);const s=await shop('slow');assert.equal(s.notify_attempts,5);assert.equal(s.next_attempt_at,null);assert.equal(s.notify_error,'notify_attempts_exhausted');
   assert.ok(!(await sweep()).includes('slow'),'exhausted shops are not swept');
   await assert.rejects(as(db,'authenticated',users[1],"select begin_shop_request_notify('slow')"),/permission denied/);
   await db.query('update shop_request_settings set threshold=5');
  });

  let calls=0;
  const fakePlace=p=>({id:p.place_id,displayName:{text:p.name},formattedAddress:p.address,location:{latitude:p.lat,longitude:p.lng},primaryType:p.primary_type,addressComponents:[{types:['country'],shortText:'GB'}]});
  const search=searchHandler({user:async jwt=>users.includes(jwt)?jwt:null,
   consume:async id=>(await as(db,'service_role',null,'select consume_shop_search($1) ok',[id])).rows[0].ok,
   consumeDetails:async(id,n,isAdmin)=>(await as(db,'service_role',null,'select consume_shop_details($1,$2,$3) ok',[id,n,isAdmin])).rows[0].ok,
   listed:async()=>null,mine:async id=>(await as(db,'authenticated',id,'select my_shop_requests() r')).rows[0].r,isAdmin:async id=>id===admin},
   async(url,init)=>{calls++;if(init.method==='POST')return Response.json({places:[fakePlace(place('found'))]});return Response.json(fakePlace(place(decodeURIComponent(url.split('/places/')[1].split('?')[0]))));},
   n=>n==='GOOGLE_PLACES_API_KEY'?'fake-key':'fake');
  const post=(uid,body)=>search(new Request('http://fake',{method:'POST',headers:{Authorization:`Bearer ${uid}`,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const usage=async uid=>(await db.query('select coalesce(sum(searches),0)::int searches,coalesce(sum(details),0)::int details from shop_request_usage where user_id=$1',[uid])).rows[0];

  await t.test('F2 opening the requested list repeatedly never reduces the search allowance',async()=>{
   for(const id of ['d1','d2','d3'])await vote(users[2],id);
   for(let i=0;i<20;i++){const r=await post(users[2],{mode:'details',place_ids:['d1','d2','d3']});assert.equal(r.status,200);assert.equal((await r.json()).details.length,3);}
   assert.deepEqual(await usage(users[2]),{searches:0,details:60});
   const capped=await post(users[2],{mode:'details',place_ids:['d1']});assert.equal(capped.status,429);assert.match((await capped.json()).error,/names/);
   for(let i=0;i<30;i++)assert.equal((await post(users[2],{query:'Shop Leeds'})).status,200,'all 30 searches remain');
   assert.equal((await post(users[2],{query:'Shop Leeds'})).status,429);assert.equal((await usage(users[2])).searches,30);
  });

  await t.test('F2 global search cap does not block names; global details cap does; admins skip only the personal cap',async()=>{
   await vote(users[3],'g1');
   await db.query("update shop_request_settings set global_search_cap=(select searches from shop_search_global_usage where day=(now() at time zone 'UTC')::date)");
   assert.equal((await post(users[3],{query:'Shop Leeds'})).status,429);
   assert.equal((await post(users[3],{mode:'details',place_ids:['g1']})).status,200,'names still load when search is exhausted');
   await db.query('update shop_request_settings set global_search_cap=1000');
   const many=Array.from({length:50},(_,i)=>'admin'+i);
   for(let i=0;i<2;i++){const r=await post(admin,{mode:'details',place_ids:many});assert.equal(r.status,200);assert.equal((await r.json()).details.length,50);}
   assert.equal((await post(admin,{mode:'details',place_ids:[...many,'one-more']})).status,400,'admin page size is 50');
   assert.equal((await usage(admin)).searches,0);
   const before=calls;
   await db.query("update shop_request_settings set global_details_cap=(select details+1 from shop_search_global_usage where day=(now() at time zone 'UTC')::date)");
   assert.equal((await post(admin,{mode:'details',place_ids:['a','b']})).status,429,'a batch that would pass the cap is refused whole');
   assert.equal(calls,before,'no provider call when the details budget refuses');
   assert.equal((await post(admin,{mode:'details',place_ids:['a']})).status,200);
   await db.query('update shop_request_settings set global_details_cap=2000');
   await assert.rejects(as(db,'authenticated',users[3],'select consume_shop_details($1,1,true)',[users[3]]),/permission denied/);
  });

  await t.test('F3 withdrawals and account deletion lock only affected shops and finish without deadlock',async()=>{
   const [a,b,c,d]=users.slice(4,7).concat([users[2]]);
   for(const id of ['lockA','lockB','lockC']){await vote(a,id);await vote(b,id);}await vote(c,'lockA');await vote(c,'lockB');
   const c1=await f.newClient(),c2=await f.newClient();
   // A withdrawal touches only its own shop: it completes while another transaction holds a different shop.
   await c1.query('begin');await c1.query("select 1 from requested_shops where place_id='lockA' for update");
   await c2.query("set lock_timeout='3s'");
   assert.equal((await as(c2,'authenticated',a,"select withdraw_shop_request('lockB') r")).rows[0].r.count,2);
   // Deleting an account with no vote on lockA also completes while lockA is held.
   await c2.query('begin');await c2.query('delete from auth.users where id=$1',[d]);await c2.query('rollback');
   await c1.query('rollback');
   // Two concurrent withdrawals of different shops plus a concurrent account deletion all succeed.
   const c3=await f.newClient();
   await Promise.all([
    as(c1,'authenticated',a,"select withdraw_shop_request('lockA')"),
    as(c2,'authenticated',b,"select withdraw_shop_request('lockC')"),
    c3.query('delete from auth.users where id=$1',[c])]);
   assert.deepEqual((await db.query("select place_id,request_count from requested_shops where place_id like 'lock%' order by place_id")).rows,
    [{place_id:'lockA',request_count:1},{place_id:'lockB',request_count:1},{place_id:'lockC',request_count:1}]);
   // An account deletion overlapping an uncommitted withdrawal waits for it, then both commit with correct counts.
   await vote(a,'lockB');
   await c1.query('begin');await as(c1,'authenticated',b,"select withdraw_shop_request('lockB')");
   const deletion=c3.query('delete from auth.users where id=$1',[a]);
   await new Promise(r=>setTimeout(r,300));await c1.query('commit');await deletion;
   assert.deepEqual((await db.query("select place_id,request_count from requested_shops where place_id like 'lock%' order by place_id")).rows,
    [{place_id:'lockA',request_count:1},{place_id:'lockB',request_count:0},{place_id:'lockC',request_count:0}]);
   // Unrelated shops are no longer touched by a delete.
   const untouched=(await shop('d1')).updated_at;await as(db,'authenticated',b,"select withdraw_shop_request('lockA')");assert.deepEqual((await shop('d1')).updated_at,untouched);
  });
 }finally{await f.stop()}
});
