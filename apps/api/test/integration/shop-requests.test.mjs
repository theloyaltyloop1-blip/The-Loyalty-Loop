import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startFidelDatabase,as} from './fidel-fixture.mjs';
import {searchHandler,signPlace,operatorEmail,PLACES_MASK} from '../../../../supabase/functions/_shared/shop-requests.ts';
import {notifyHandler} from '../../../../supabase/functions/_shared/shop-request-notify.ts';
import {sendPendingPushes} from '../../../../supabase/functions/_shared/push.ts';
const secret='disposable-signing-key';
test('Shop requests phase A: all ten plan acceptance scenarios',async t=>{
 const f=await startFidelDatabase('shop-requests-');const db=f.client;
 try {
  await db.query(`create schema extensions;create extension pgcrypto with schema extensions;
   create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
   create schema net;create table net.wakes(body jsonb);
   create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000)
   returns bigint language plpgsql as $$ begin insert into net.wakes values(body);return 1;end $$;
   alter table businesses add column lat double precision,add column lng double precision,add column is_active boolean default true,add column approval_status text default 'approved';`);
  await db.query('insert into vault.decrypted_secrets values($1,$2),($3,$4)',['SHOP_REQUEST_SIGNING_SECRET',secret,'SHOP_REQUEST_NOTIFY_SECRET','disposable-notify']);
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261002211052_shop_requests_phase_a.sql',import.meta.url),'utf8'));
  const users=Array.from({length:12},()=>randomUUID());const admin=users[11];await db.query('insert into auth.users select unnest($1::uuid[])',[users]);await db.query('insert into test_admins values($1)',[admin]);
  const place=(id='cafe')=>({place_id:id,name:'Bean & Leaf',address:'Leeds, UK',postcode:'LS1 1AA',lat:53.8,lng:-1.55,website:'https://example.test',phone:'0113 000 0000',primary_type:'cafe',country:'GB'});
  const vote=async(uid,p=place(),token=null)=>as(db,'authenticated',uid,'select request_shop($1) result',[token??await signPlace(p,uid,secret)]);
  const status=async(pid='cafe')=>(await db.query('select * from requested_shops where place_id=$1',[pid])).rows[0];
  const fakePlace=p=>({id:p.place_id,displayName:{text:p.name},formattedAddress:p.address,location:{latitude:p.lat,longitude:p.lng},websiteUri:p.website,nationalPhoneNumber:p.phone,primaryType:p.primary_type,addressComponents:[{types:['country'],shortText:p.country},{types:['postal_code'],shortText:p.postcode}]});
  let calls=0;
  const search=searchHandler({user:async jwt=>users.includes(jwt)?jwt:null,
   consume:async id=>(await as(db,'service_role',null,'select consume_shop_search($1) ok',[id])).rows[0].ok,
   listed:async p=>(await as(db,'service_role',null,'select shop_request_listed($1) id',[p])).rows[0].id,
   mine:async id=>(await as(db,'authenticated',id,'select my_shop_requests() r')).rows[0].r,isAdmin:async id=>id===admin},
   async(url,init)=>{calls++;if(init.method!=='POST'){assert.ok(!init.headers['X-Goog-FieldMask'].includes('website'));return Response.json(fakePlace(place(decodeURIComponent(url.split('/places/')[1].split('?')[0]))))}assert.equal(init.headers['X-Goog-FieldMask'],PLACES_MASK);assert.equal(JSON.parse(init.body).regionCode,'GB');return Response.json({places:[fakePlace(place()),fakePlace({...place('foreign'),country:'US'}),fakePlace(place('listed'))]});},
   name=>name==='GOOGLE_PLACES_API_KEY'?'fake-key':secret);
  const searchReq=uid=>new Request('http://fake',{method:'POST',headers:{Authorization:`Bearer ${uid}`,'Content-Type':'application/json'},body:JSON.stringify({query:'Bean Leeds',lat:53.8,lng:-1.55})});
  await t.test('1 idempotent votes',async()=>{await vote(users[0]);await vote(users[0]);assert.equal((await status()).request_count,1);});
  await t.test('2 five distinct votes, concurrent threshold, exactly one wake',async()=>{
   await vote(users[1]);await vote(users[2]);const c2=await f.newClient();await Promise.all([vote(users[3]),as(c2,'authenticated',users[4],'select request_shop($1)',[await signPlace(place(),users[4],secret)])]);
   assert.equal((await status()).request_count,5);assert.equal((await status()).status,'ready');assert.equal((await db.query("select count(*) n from net.wakes where body->>'mode'='ready'")).rows[0].n,'1');
   await vote(users[5]);assert.equal((await db.query('select count(*) n from net.wakes')).rows[0].n,'1');
  });
  await t.test('3 persistent ten-vote cap, thirty-search cap and JWT rejection',async()=>{
   for(let i=0;i<10;i++)await vote(users[6],place('cap'+i));await assert.rejects(vote(users[6],place('over')),/daily request limit/);
   await as(db,'authenticated',users[6],'select withdraw_shop_request($1)',['cap0']);await assert.rejects(vote(users[6],place('over')),/daily request limit/);
   for(let i=0;i<30;i++)assert.equal((await search(searchReq(users[7]))).status,200);assert.equal((await search(searchReq(users[7]))).status,429);assert.equal(calls,30);assert.equal((await search(searchReq('wrong'))).status,401);
  });
  await t.test('4 forged details, other user/place and expired tokens rejected',async()=>{
   const token=await signPlace(place('secure'),users[8],secret);assert.equal(token.signature,createHmac('sha256',secret).update(token.payload).digest('hex'));
   await assert.rejects(vote(users[9],place(),token),/invalid place token/);
   for(const field of ['name','place_id','website']){const p=JSON.parse(token.payload);p[field]='forged';await assert.rejects(vote(users[8],place(),{...token,payload:JSON.stringify(p)}),/invalid place token/);}
   await assert.rejects(vote(users[8],place(),await signPlace(place('expired'),users[8],secret,Date.now()-900000)),/invalid place token/);
  });
  let business;
  await t.test('5 listed shops filtered and RPC rejection by exact ID and 75m/name',async()=>{
   business=randomUUID();await db.query("insert into businesses(id,owner_id,name,lat,lng,google_place_id) values($1,$2,'Different',50,0,'listed')",[business,admin]);
   const r=await (await search(searchReq(users[8]))).json();assert.equal(r.listed.length,1);assert.equal(r.listed[0].business_id,business);assert.ok(!r.places.some(p=>p.place.place_id==='foreign'||p.place.place_id==='listed'));
   await assert.rejects(vote(users[8],place('listed')),/already listed/);
   const nearby=randomUUID();await db.query("insert into businesses(id,owner_id,name,lat,lng) values($1,$2,'Bean & Leaf',53.8001,-1.55)",[nearby,admin]);await assert.rejects(vote(users[8],place('nearby')),/already listed/);await db.query('delete from businesses where id=$1',[nearby]);
  });
  await t.test('6 withdrawal/account deletion recount; ready is sticky',async()=>{
   await as(db,'authenticated',users[0],'select withdraw_shop_request($1)',['cafe']);await db.query('delete from auth.users where id=$1',[users[5]]);await as(db,'service_role',null,'select recount_shop_requests()');assert.equal((await status()).request_count,4);assert.equal((await status()).status,'ready');
  });
  await t.test('7 REST roles: only own votes, no contact fields/direct writes',async()=>{
   const rows=(await as(db,'authenticated',users[1],'select * from shop_requests')).rows;assert.ok(rows.every(r=>r.user_id===users[1]));
   await assert.rejects(as(db,'authenticated',users[1],'select * from requested_shops'),/permission denied/);await assert.rejects(as(db,'authenticated',users[1],"insert into shop_requests(place_id,user_id) values('cafe',$1)",[users[1]]),/permission denied/);
   const own=(await as(db,'authenticated',users[1],'select my_shop_requests() r')).rows[0].r;for(const field of ['name','address','lat','lng','phone','website'])assert.ok(!(field in own[0])&&!(field in await status()));
   await assert.rejects(as(db,'authenticated',users[1],'select admin_shop_requests()'),/not allowed/);
   await db.query('grant update(google_place_id) on businesses to authenticated');
   await assert.rejects(as(db,'authenticated',users[1],"update businesses set google_place_id='forged-link' where id=$1",[business]),/Only an operator/);
  });
  await t.test('8 permanent suppression accepts votes silently and never claims email',async()=>{
   await vote(users[8],place('suppressed'));await as(db,'authenticated',admin,"select admin_set_shop_request('suppressed','suppressed')");const before=(await db.query('select count(*) n from net.wakes')).rows[0].n;
   for(const u of users.slice(0,5))await vote(u,place('suppressed'));assert.equal((await status('suppressed')).status,'suppressed');assert.equal((await db.query('select count(*) n from net.wakes')).rows[0].n,before);
   assert.equal((await as(db,'service_role',null,"select claim_shop_request_notify('suppressed') r")).rows[0].r,null);await assert.rejects(as(db,'authenticated',admin,"select admin_set_shop_request('suppressed','ready')"),/permanent/);
  });
  await t.test('9 join queues one push each, no bystanders, concurrent claims once',async()=>{
   await as(db,'authenticated',admin,'select admin_set_shop_request($1,$2,$3)',['cafe','joined',business]);await as(db,'authenticated',admin,'select admin_set_shop_request($1,$2,$3)',['cafe','joined',business]);
   const rows=(await db.query("select * from notifications where business_id=$1",[business])).rows;assert.equal(rows.length,4);assert.deepEqual(new Set(rows.map(n=>n.user_id)),new Set(users.slice(1,5)));
   const c2=await f.newClient();const recipients=[];
   for(const n of rows){const r=await Promise.all([as(db,'service_role',null,'select claim_shop_request_push($1) r',[n.id]),as(c2,'service_role',null,'select claim_shop_request_push($1) r',[n.id])]);assert.equal(r.filter(v=>v.rows[0].r).length,1);
    const claimed=r.find(v=>v.rows[0].r).rows[0].r;const result=await sendPendingPushes({pending:async()=>[{id:claimed.id,kind:claimed.kind,title:claimed.title,body:claimed.body,businessId:claimed.business_id}],settings:async()=>null,tokens:async uid=>['ExponentPushToken['+uid+']'],mark:async()=>{}},async(_url,init)=>{const messages=JSON.parse(init.body);assert.equal(messages.length,1);assert.equal(messages[0].data.businessId,business);recipients.push(claimed.user_id);return Response.json({data:[{status:'ok',id:'fake-ticket'}]});},claimed.user_id,business);assert.equal(result.sent,1);
   }assert.deepEqual(new Set(recipients),new Set(users.slice(1,5)));
  });
  await t.test('10 operator email and pitch contain count, details, no requester identity',async()=>{
   const mail=await operatorEmail({...place(),request_count:4,ready_at:new Date().toISOString()},'https://example.test');assert.match(mail.text,/4 local shoppers/);assert.match(mail.text,/join\?ref=req_[0-9a-f]{20}/);for(const uid of users)assert.ok(!mail.text.includes(uid));assert.ok(!mail.text.includes('your customers'));assert.ok(!mail.text.includes('@'));
   await vote(users[8],place('email'));await as(db,'authenticated',admin,'select admin_set_shop_request_threshold(1)');
   let sends=0;const handler=notifyHandler({
    claim:async id=>(await as(db,'service_role',null,'select claim_shop_request_notify($1) r',[id])).rows[0].r,
    details:async id=>({...place(id),request_count:0,ready_at:''}),current:async id=>status(id),finish:async(id,lease,sent)=>{await as(db,'service_role',null,'select finish_shop_request_notify($1,$2,$3)',[id,lease,sent]);},joined:async()=>[]
   },async(_url,init)=>{sends++;const body=JSON.parse(init.body);assert.deepEqual(body.to,['operator@example.test']);assert.match(body.text,/1 local shoppers/);for(const uid of users)assert.ok(!JSON.stringify(body).includes(uid));assert.match(init.headers['Idempotency-Key'],/^shop-request-/);return Response.json({id:'fake-mail'});},name=>({SHOP_REQUEST_NOTIFY_SECRET:'disposable-notify',RESEND_API_KEY:'fake',SHOP_REQUEST_OPERATOR_EMAIL:'operator@example.test'})[name]);
   const req=(id,auth='disposable-notify')=>new Request('http://fake',{method:'POST',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:JSON.stringify({place_id:id})});
   assert.equal((await handler(req('email','wrong'))).status,401);await Promise.all([handler(req('email')),handler(req('email'))]);assert.equal(sends,1);await handler(req('email'));await handler(req('suppressed'));assert.equal(sends,1);
  });
  await t.test('11 details authorization, minimization and global budget',async()=>{
   const req=(uid,ids)=>new Request('http://fake',{method:'POST',headers:{Authorization:`Bearer ${uid}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'details',place_ids:ids})});
   const before=calls;assert.equal((await search(req(users[0],['cafe']))).status,403);assert.equal(calls,before);
   const r=await search(req(users[1],['cafe']));assert.equal(r.status,200);const body=await r.json();assert.deepEqual(Object.keys(body.details[0]).sort(),['address','name','place_id']);
   assert.equal((await search(req(users[1],Array(21).fill('cafe')))).status,400);
   assert.equal((await search(req(admin,['unrequested']))).status,200);
   assert.ok(!PLACES_MASK.includes('website')&&!PLACES_MASK.includes('Phone'));
   await db.query('update shop_request_settings set global_search_cap=(select searches from shop_search_global_usage where day=current_date)');
   assert.equal((await search(searchReq(users[10]))).status,429);
   await db.query('update shop_request_settings set global_search_cap=1000');
  });
  await t.test('12 joined push failure does not abandon later requesters',async()=>{
   let calls=0;const handler=notifyHandler({joined:async()=>['one','two'],claim:async()=>null,current:async()=>null,details:async()=>null,finish:async()=>{}},async()=>{calls++;if(calls===1)throw Error('fake failure');return new Response('ok')},n=>n==='SHOP_REQUEST_NOTIFY_SECRET'?'fake':'http://fake');
   const r=await handler(new Request('http://fake',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({place_id:'cafe',mode:'joined'})}));assert.equal(calls,2);assert.equal(r.status,207);assert.deepEqual(await r.json(),{processed:1,failed:1});
  });
 }finally{await f.stop();}
});
