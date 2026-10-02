import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';
import {signPlace} from '../../../../supabase/functions/_shared/shop-requests.ts';
import {notifyHandler} from '../../../../supabase/functions/_shared/shop-request-notify.ts';
test('Scheduled recovery commands on disposable PostgreSQL with fake cron/HTTP providers',async t=>{
 const f=await startFidelDatabase('recovery-'),db=f.client;
 try{
  const migration=async name=>readFile(new URL('../../../../supabase/migrations/'+name,import.meta.url),'utf8');
  await db.query(`create schema extensions;create extension pgcrypto with schema extensions;create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
   insert into vault.decrypted_secrets values('SHOP_REQUEST_SIGNING_SECRET','fake'),('SHOP_REQUEST_NOTIFY_SECRET','fake'),('WHATSAPP_DISPATCH_SECRET','fake'),('FIDEL_CARD_DELETE_SWEEP_SECRET','fake');
   create schema net;create table net.wakes(url text,body jsonb);
   create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language plpgsql as $$begin insert into net.wakes values(url,body);return 1;end$$;
   alter table businesses add column lat double precision,add column lng double precision,add column is_active boolean default true,add column approval_status text default 'approved';
   create schema cron;create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
   create table cron.job_run_details(jobid bigint,status text,start_time timestamptz);
   create function cron.schedule(n text,s text,c text) returns bigint language plpgsql as $$declare id bigint;begin insert into cron.job(jobname,schedule,command) values(n,s,c) on conflict(jobname) do update set schedule=s,command=c returning jobid into id;return id;end$$;
   create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;`);
  await db.query(await migration('20261002211052_shop_requests_phase_a.sql'));
  // Windows embedded distribution has no pg_cron binary. Execute its real
  // SQL commands/health queries against recorded jobs; no wall-clock scheduler.
  const cron=await migration('20261002211306_scheduled_delivery_recovery.sql');assert.match(cron,/create extension if not exists pg_cron;/);
  await db.query(cron.replace('create extension if not exists pg_cron;',''));
  const user=randomUUID();await db.query('insert into auth.users values($1)',[user]);
  const wake=async name=>{const {command}= (await db.query('select command from cron.job where jobname=$1',[name])).rows[0];await db.query(command);};
  await t.test('lost ready wake recovered; repeated sweeps send one operator email',async()=>{
   await db.query('update shop_request_settings set threshold=1');const place={place_id:'lost',name:'Transient cafe',address:'Leeds',lat:53.8,lng:-1.5,country:'GB',postcode:null,website:null,phone:null,primary_type:null};
   await as(db,'authenticated',user,'select request_shop($1)',[await signPlace(place,user,'fake')]);await db.query('delete from net.wakes');
   let sends=0;const handler=notifyHandler({details:async()=>place,current:async id=>(await db.query('select * from requested_shops where place_id=$1',[id])).rows[0],claim:async id=>(await db.query('select claim_shop_request_notify($1) r',[id])).rows[0].r,finish:async(id,lease,sent)=>{await db.query('select finish_shop_request_notify($1,$2,$3)',[id,lease,sent])},joined:async()=>[]},async()=>{sends++;return Response.json({id:'fake-mail'})},n=>n==='SHOP_REQUEST_NOTIFY_SECRET'?'fake':n==='RESEND_API_KEY'?'fake':undefined);
   await wake('shop-request-delivery-recovery');assert.equal((await db.query('select body from net.wakes')).rows[0].body.place_id,'lost');
   const req=()=>new Request('http://fake',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({place_id:'lost'})});await Promise.all([handler(req()),handler(req())]);await wake('shop-request-delivery-recovery');await handler(req());assert.equal(sends,1);
   const wakes=(await db.query('select count(*) n from net.wakes')).rows[0].n;assert.equal(wakes,'1');
  });
  await t.test('shop-only job, recent health and private execution',async()=>{
   const jobs=(await db.query('select * from cron.job')).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].jobname,'shop-request-delivery-recovery');assert.equal(jobs[0].schedule,'* * * * *');
   assert.equal((await db.query('select scheduled_jobs_health() r')).rows[0].r.ok,false);await db.query("insert into cron.job_run_details select jobid,'succeeded',now() from cron.job");assert.equal((await db.query('select scheduled_jobs_health() r')).rows[0].r.ok,true);
   await assert.rejects(as(db,'authenticated',user,'select sweep_shop_request_notifications()'),/permission denied/);
  });
 }finally{await f.stop()}
});
