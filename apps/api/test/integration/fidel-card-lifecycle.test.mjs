import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';
import { claimCards, cardSession, unlinkCard, deleteLeasedCard, sweepPendingDeletes,
  sweepOrphanCards, deleteAllFidelCardsForUser, listCardsByMetadata, fidelConfig } from '../../../../supabase/functions/_shared/fidel-cards.ts';

// Synthetic data, disposable loopback PostgreSQL and injected HTTP only.
// Every RPC has its own connection, including during the deliberate races.
const env = key => ({ FIDEL_API_KEY:'sk_test_synthetic', FIDEL_SDK_KEY:'pk_test_synthetic',
  FIDEL_PROGRAM_ID:'test-program', FIDEL_CARD_LINKING_ENABLED:'true' })[key];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };

test('R1–R4 desired behaviour (§5): 15 scenarios', {timeout:120000}, async t => {
  const backfillUser=randomUUID();
  const {client,newClient,stop} = await startFidelDatabase('lifecycle-repair-', {
    beforeMigration: async(c,name)=>{
      if(!name.endsWith('_fidel_card_lifecycle_repair.sql')) return;
      await c.query('insert into auth.users(id) values($1)',[backfillUser]);
      await c.query(`insert into public.linked_cards(user_id,fidel_card_id,unlinked_at,unlink_reason,fidel_deleted_at,fidel_delete_error)
        values($1,'backfill-active',null,null,null,null),($1,'backfill-pending',now(),'user',null,null),
        ($1,'backfill-failed',now(),'user',null,'503'),($1,'backfill-deleted',now(),'user',now(),null)`,[backfillUser]);
    },
  });
  const rpc = async (fn,args={}) => {
    assert.match(fn,/^[a-z_0-9]+$/);
    const c = await newClient();
    const keys=Object.keys(args);
    try {
      if(fn==='fidel_cards_pending_delete') return (await as(c,'service_role',null,
        'select * from public.fidel_cards_pending_delete($1)',[args._max_rows])).rows;
      return (await as(c,'service_role',null,
      `select public.${fn}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as r`,Object.values(args))).rows[0]?.r; } finally { await c.end(); }
  };
  const db = {
    rpc: async(fn,args) => { try { return {data:await rpc(fn,args),error:null}; } catch(e) {return {data:null,error:{message:e.message,code:e.code}};} },
    activeCards:async user => (await client.query('select id as "linkedCardId" from public.linked_cards where user_id=$1 and unlinked_at is null',[user])).rows,
    isAdmin:async()=>false,
  };
  const claim=(user,card,explicit=true)=>rpc('claim_linked_card_v2',{_user_id:user,_fidel_card_id:card,
    _fidel_account_id:'synthetic',_card_scheme:'visa',_last_numbers:'4242',_explicit:explicit});
  const unlink=(user,id)=>rpc('unlink_linked_card',{_user_id:user,_linked_card_id:id,_reason:'user'});
  const state=async id=>(await client.query('select * from public.linked_cards where id=$1',[id])).rows[0];
  const progress=async user=>(await client.query('select reward_progress_pence from public.memberships where user_id=$1',[user])).rows[0].reward_progress_pence;
  async function setup() {
    const [owner,a,b,shop]=Array.from({length:4},()=>randomUUID());const card=randomUUID(),loc=randomUUID();
    await client.query('insert into auth.users(id) select unnest($1::uuid[])',[[owner,a,b]]);
    await client.query("insert into public.businesses(id,owner_id,reward_model,reward_threshold_pence) values($1,$2,'spend_threshold',1000)",[shop,owner]);
    await client.query('insert into public.memberships(user_id,business_id) values($1,$3),($2,$3)',[a,b,shop]);
    await client.query("insert into public.business_fidel_locations(business_id,fidel_program_id,fidel_location_id,fidel_status) values($1,'test-program',$2,'active')",[shop,loc]);
    const meta=await rpc('fidel_link_identity',{_user_id:a});await rpc('fidel_link_identity',{_user_id:b});
    const first=await claim(a,card);
    const event=async(type,id,amount=600,original=null,overrides={})=>{
      const args={_fidel_message_id:randomUUID(),_event_type:`transaction.${type}`,_fidel_transaction_id:id,
        _program_id:'test-program',_fidel_card_id:card,_fidel_location_id:loc,_original_transaction_id:original,
        _amount_pence:amount,_auth:type!=='refund',_cleared:type!=='auth',...overrides};
      const result=await rpc('process_fidel_webhook_event',args);
      const ledger=(await client.query('select outcome from public.fidel_webhook_events where fidel_message_id=$1',[args._fidel_message_id])).rows[0];
      if(result.status!=='duplicate') assert.equal(ledger?.outcome,result.status,`stored outcome: ${result.status}`);
      return result;
    };
    const provider=(id=card,metadata=meta,overrides={})=>({id,programId:'test-program',accountId:'synthetic',
      live:false,scheme:'visa',lastNumbers:'4242',metadata:{id:metadata},...overrides});
    return {a,b,shop,card,loc,meta,first,event,provider};
  }
  const fake=(cards=[],status=204)=>{
    const deletes=[];
    return {deletes,fetch:async(url,init={})=>{
      assert.equal(new URL(url).host,'api.fidel.uk'); // URL inspected only; never fetched.
      if(init.method==='DELETE') { assert.ok(init.signal instanceof AbortSignal);deletes.push(decodeURIComponent(url.split('/').pop()));return new Response(status===204?null:'{}',{status}); }
      return new Response(JSON.stringify({items:cards}));
    }};
  };
  try {
    await t.test('1 unlink then refund adjusts original purchase to 500p',async()=>{
      const backfilled=(await client.query('select fidel_card_id,fidel_delete_state from public.linked_cards where user_id=$1 order by fidel_card_id',[backfillUser])).rows;
      assert.deepEqual(backfilled.map(r=>r.fidel_delete_state),[null,'deleted','failed','pending']);
      const x=await setup();const purchase=randomUUID();await x.event('auth',purchase);
      await unlink(x.a,x.first.linked_card_id);
      assert.equal((await x.event('refund',randomUUID(),-100,purchase)).status,'processed');
      assert.equal(await progress(x.a),500);
    });
    await t.test('2 explicit relink preserves original clearing/refund association',async()=>{
      const x=await setup();const purchase=randomUUID();await x.event('auth',purchase);await unlink(x.a,x.first.linked_card_id);
      const next=await claim(x.a,x.card);assert.notEqual(next.linked_card_id,x.first.linked_card_id);
      assert.equal((await x.event('clearing',purchase)).status,'processed');
      assert.equal((await x.event('refund',randomUUID(),-100,purchase)).status,'processed');
      assert.equal((await client.query('select linked_card_id from public.fidel_transactions where fidel_transaction_id=$1',[purchase])).rows[0].linked_card_id,x.first.linked_card_id);
      assert.equal(await progress(x.a),500);
    });
    await t.test('3 same Fidel id reused by B never transfers A purchase',async()=>{
      const x=await setup();const purchase=randomUUID();await x.event('auth',purchase);await unlink(x.a,x.first.linked_card_id);
      assert.equal((await deleteLeasedCard({env,db,fetch:fake().fetch},x.first.linked_card_id)).ok,true);
      assert.equal((await claim(x.b,x.card)).status,'claimed');await x.event('auth',randomUUID(),200);
      await x.event('refund',randomUUID(),-100,purchase);
      assert.equal(await progress(x.a),500);assert.equal(await progress(x.b),200);
    });
    await t.test('4 failed DELETE cannot be recovered; sweep eventually deletes',async()=>{
      const x=await setup();await unlinkCard({env,db,fetch:fake([],503).fetch},x.a,{linkedCardId:x.first.linked_card_id});
      assert.equal((await claimCards({env,db,fetch:fake([x.provider()]).fetch},x.a,{})).status,'removal_pending');
      assert.equal((await db.activeCards(x.a)).length,0);
      await sweepPendingDeletes({env,db,fetch:fake().fetch});assert.equal((await state(x.first.linked_card_id)).fidel_delete_state,'deleted');
    });
    await t.test('5 explicit relink supersedes failed removal and sweep sends no DELETE',async()=>{
      const x=await setup();await unlinkCard({env,db,fetch:fake([],503).fetch},x.a,{linkedCardId:x.first.linked_card_id});
      assert.equal((await claimCards({env,db,fetch:fake([x.provider()]).fetch},x.a,{cardId:x.card})).status,'claimed');
      assert.equal((await state(x.first.linked_card_id)).fidel_delete_state,'superseded');
      const f=fake();await sweepPendingDeletes({env,db,fetch:f.fetch});assert.ok(!f.deletes.includes(x.card));
    });
    await t.test('6 both kinds of claim refuse in-flight successful/failed DELETE',async()=>{
      for(const code of [204,503]) {
        const x=await setup();const entered=deferred(),release=deferred();
        const removing=unlinkCard({env,db,fetch:async()=>{entered.resolve();await release.promise;return new Response(code===204?null:'{}',{status:code});}},x.a,{linkedCardId:x.first.linked_card_id});
        await entered.promise;
        try {
          for(const body of [{},{cardId:x.card}]) assert.equal((await claimCards({env,db,fetch:fake([x.provider()]).fetch},x.a,body)).status,'removal_in_progress');
          assert.equal((await claim(x.b,x.card)).status,'removal_in_progress','cross-user lease also blocks');
          const sweep=fake();await sweepPendingDeletes({env,db,fetch:sweep.fetch});
          assert.ok(!sweep.deletes.includes(x.card),'concurrent sweep skips held lease');
        } finally {release.resolve();await removing;}
        assert.equal((await db.activeCards(x.a)).length,0);
        assert.equal((await state(x.first.linked_card_id)).fidel_delete_state,code===204?'deleted':'failed');
        if(code===503) assert.equal((await claim(x.a,x.card)).status,'claimed');
      }
    });
    await t.test('7 relink commits before begin: no provider DELETE',async()=>{
      const x=await setup();await unlink(x.a,x.first.linked_card_id);await claim(x.a,x.card);
      const f=fake();assert.equal((await deleteLeasedCard({env,db,fetch:f.fetch},x.first.linked_card_id)).skipped,true);assert.equal(f.deletes.length,0);
    });
    await t.test('8 expired lease reacquired; stale completion cannot finish it',async()=>{
      const x=await setup();await unlink(x.a,x.first.linked_card_id);
      const old=await rpc('begin_fidel_card_delete',{_linked_card_id:x.first.linked_card_id});
      await client.query("update public.linked_cards set fidel_delete_lease_until=now()-interval '1 second' where id=$1",[x.first.linked_card_id]);
      const newer=await rpc('begin_fidel_card_delete',{_linked_card_id:x.first.linked_card_id});assert.equal(newer.attempt,old.attempt+1);
      await rpc('finish_fidel_card_delete',{_linked_card_id:x.first.linked_card_id,_error:null,_attempt:old.attempt});
      assert.equal((await state(x.first.linked_card_id)).fidel_delete_state,'in_progress');
      await client.query("update public.linked_cards set fidel_delete_lease_until=now()-interval '1 second' where id=$1",[x.first.linked_card_id]);
      await sweepPendingDeletes({env,db,fetch:fake().fetch});assert.equal((await state(x.first.linked_card_id)).fidel_delete_state,'deleted');
    });
    await t.test('9 refused sixth card persists and account deletion finds failed cleanup',async()=>{
      const x=await setup();for(let i=0;i<4;i++) await claim(x.a,randomUUID());const sixth=randomUUID();const f=fake([x.provider(sixth)],503);
      assert.equal((await claimCards({env,db,fetch:f.fetch},x.a,{cardId:sixth})).status,'limit_reached');
      const row=(await client.query('select * from public.linked_cards where fidel_card_id=$1',[sixth])).rows[0];
      assert.equal(row.unlink_reason,'cap_exceeded');assert.equal(row.fidel_delete_state,'failed');assert.equal(row.fidel_delete_attempts,1);
      const begun=await rpc('begin_fidel_account_deletion',{_user_id:x.a});assert.ok(begun.rows.some(r=>r.linked_card_id===row.id));
      await rpc('abort_fidel_account_deletion',{_user_id:x.a});
    });
    await t.test('10 account tombstone, provider-only cards, truncation and retirement',async()=>{
      const x=await setup();const only=randomUUID();const entered=deferred(),release=deferred();const f=fake([x.provider(only)]);
      let held=false;
      const deleting=deleteAllFidelCardsForUser({env,db,fetch:async(...args)=>{if(!held){held=true;entered.resolve();await release.promise;}return f.fetch(...args);}},x.a);
      await entered.promise;
      try {
        assert.equal((await claim(x.a,randomUUID())).status,'account_deleting');
        await assert.rejects(cardSession({env,db},x.a),/account_deleting/);
        assert.equal(await deleteAllFidelCardsForUser({env,db,fetch:f.fetch},x.a),false,'second deletion must not clear first tombstone');
      } finally {release.resolve();}
      assert.equal(await deleting,true);assert.ok(f.deletes.includes(only));
      assert.equal((await client.query('select count(*)::int n from public.fidel_retired_metadata_ids where metadata_id=$1',[x.meta])).rows[0].n,1);
      // The remaining caller cleanup can now remove card history and Auth.
      await client.query('delete from public.linked_cards where user_id=$1',[x.a]);await client.query('delete from public.memberships where user_id=$1',[x.a]);await client.query('delete from auth.users where id=$1',[x.a]);
      assert.equal((await client.query('select count(*)::int n from public.fidel_retired_metadata_ids where metadata_id=$1',[x.meta])).rows[0].n,1);
      const y=await setup();let gets=0;const truncated=async(_url,init={})=>init.method==='DELETE'?new Response(null,{status:204}):new Response(JSON.stringify({items:[y.provider(randomUUID())],last:{page:++gets}}));
      assert.equal(await deleteAllFidelCardsForUser({env,db,fetch:truncated},y.a),false);assert.equal(gets,10);
      assert.equal((await client.query('select deleting_at from public.fidel_link_identities where user_id=$1',[y.a])).rows[0].deleting_at,null);
      assert.equal((await db.activeCards(y.a)).length,0);
      await assert.rejects(listCardsByMetadata(truncated,fidelConfig(env),y.meta),/fidel_list_truncated/);
      const neverLinked=randomUUID();await client.query('insert into auth.users(id) values($1)',[neverLinked]);
      assert.equal(await deleteAllFidelCardsForUser({env:()=>undefined,db,fetch:()=>assert.fail('never linked account needs no HTTP')},neverLinked),true);
      // An abandoned tombstone expires and permits linking again.
      await rpc('begin_fidel_account_deletion',{_user_id:y.a});
      await client.query("update public.fidel_link_identities set deleting_at=now()-interval '61 minutes' where user_id=$1",[y.a]);
      assert.equal((await claim(y.a,randomUUID())).status,'claimed');
    });
    await t.test('11 retired-metadata orphan deleted, current/unknown/wrong environment kept',async()=>{
      const x=await setup();const retired=randomUUID(),orphan=randomUUID();await client.query('insert into public.fidel_retired_metadata_ids(metadata_id) values($1)',[retired]);
      const f=fake([x.provider(orphan,retired),x.provider(),x.provider(randomUUID(),'unknown'),x.provider(randomUUID(),retired,{live:true})]);
      await sweepOrphanCards({env,db,fetch:f.fetch});assert.deepEqual(f.deletes,[orphan]);
      // Another user claims the same provider-only id while orphan DELETE is held.
      const entered=deferred(),release=deferred();
      const running=sweepOrphanCards({env,db,fetch:async(url,init={})=>{
        if(init.method==='DELETE'){entered.resolve();await release.promise;return new Response(null,{status:204});}
        return new Response(JSON.stringify({items:[x.provider(orphan,retired)]}));
      }});
      await entered.promise;
      try {
        assert.equal((await claim(x.b,orphan)).status,'removal_in_progress');
        const second=fake([x.provider(orphan,retired)]);await sweepOrphanCards({env,db,fetch:second.fetch});assert.equal(second.deletes.length,0);
      } finally {release.resolve();await running;}
      // Full pagination is collected before acting: truncation deletes nothing.
      let calls=0;
      await assert.rejects(sweepOrphanCards({env,db,fetch:async(_url,init={})=>{
        if(init.method==='DELETE') assert.fail('must not delete from partial listing');
        return new Response(JSON.stringify({items:[x.provider(orphan,retired)],last:{page:++calls}}));
      }}),/fidel_list_truncated/);
      assert.equal(calls,10);
      const live=k=>({FIDEL_API_KEY:'sk_live_fake',FIDEL_SDK_KEY:'pk_live_fake',FIDEL_PROGRAM_ID:'test-program'})[k];
      assert.equal((await sweepOrphanCards({env:live,db,fetch:()=>assert.fail('live call')})).disabled,true);
    });
    await t.test('12 only Active earns; historical adjustments survive inactive location',async()=>{
      const x=await setup();
      for(const status of ['syncing','idle','not_found',null]) {
        await client.query('update public.business_fidel_locations set fidel_status=$1 where business_id=$2',[status,x.shop]);
        assert.equal((await x.event('auth',randomUUID())).status,'ineligible_location');assert.equal(await progress(x.a),0);
      }
      await client.query("update public.business_fidel_locations set fidel_status='active' where business_id=$1",[x.shop]);
      const purchase=randomUUID();assert.equal((await x.event('auth',purchase)).status,'processed');
      await client.query("update public.business_fidel_locations set fidel_status='idle' where business_id=$1",[x.shop]);
      assert.equal((await x.event('clearing',purchase)).status,'processed');assert.equal((await x.event('refund',randomUUID(),-100,purchase)).status,'processed');
    });
    await t.test('13 all webhook return statuses persist outcome; duplicate preserves original',async()=>{
      const x=await setup();
      const check=async(expected,...args)=>assert.equal((await x.event(...args)).status,expected);
      await check('ignored_zero_amount','auth',randomUUID(),0);
      await check('unknown_merchant','auth',randomUUID(),100,null,{_fidel_location_id:'missing'});
      await check('unknown_card','auth',randomUUID(),100,null,{_fidel_card_id:'missing'});
      await client.query('delete from public.memberships where user_id=$1',[x.b]);const other=randomUUID();await claim(x.b,other);
      await check('unknown_membership','auth',randomUUID(),100,null,{_fidel_card_id:other});
      await check('ignored_negative_clearing','clearing',randomUUID(),-10);
      await check('unresolved_clearing','clearing',randomUUID());
      await check('unresolved_refund','refund',randomUUID(),-10);
      await check('unresolved_refund','refund',randomUUID(),-10,'missing');
      const purchase=randomUUID(),message=randomUUID();await check('processed','auth',purchase,600,null,{_fidel_message_id:message});
      await check('duplicate','auth',purchase,600,null,{_fidel_message_id:message});
      assert.equal((await client.query('select outcome from public.fidel_webhook_events where fidel_message_id=$1',[message])).rows[0].outcome,'processed');
      await check('invalid_refund','refund',randomUUID(),-601,purchase);
      await client.query('delete from public.transactions where user_id=$1',[x.a]);await client.query('delete from public.memberships where user_id=$1',[x.a]);
      await check('refund_membership_missing','refund',randomUUID(),-10,purchase);
      // New service functions cannot be called by clients; all use an empty search path.
      for(const sig of ['claim_linked_card_v2(uuid,text,text,text,text,boolean)','begin_fidel_card_delete(uuid)',
        'finish_fidel_card_delete(uuid,text,integer)','begin_fidel_account_deletion(uuid)','complete_fidel_account_deletion(uuid)',
        'abort_fidel_account_deletion(uuid)','prepare_fidel_account_card_delete(uuid,text)','fidel_orphan_card_action(text,text)',
        'finish_fidel_orphan_delete(text,integer)',
        'fidel_location_accepts_new_awards(public.business_fidel_locations)']) {
        const row=(await client.query("select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') b,has_function_privilege('service_role',$1,'execute') s,proconfig from pg_proc where oid=$1::regprocedure",['public.'+sig])).rows[0];
        assert.equal(row.a,false);assert.equal(row.b,false);assert.equal(row.s,true);assert.ok(row.proconfig.includes('search_path=""'));
      }
      for(const table of ['fidel_retired_metadata_ids','fidel_orphan_delete_leases']) {
        for(const role of ['anon','authenticated']) {
          const c=await newClient();
          await assert.rejects(as(c,role,x.a,`select * from public.${table}`),/permission denied/);await c.end();
        }
        assert.equal((await client.query('select relrowsecurity from pg_class where oid=$1::regclass',['public.'+table])).rows[0].relrowsecurity,true);
      }
    });
    await t.test('14 wrong business/card cannot adjust another purchase',async()=>{
      const x=await setup(),y=await setup();
      for(const overrides of [{_fidel_location_id:y.loc},{_fidel_card_id:y.card}]) {
        const purchase=randomUUID();await x.event('auth',purchase,300);
        assert.equal((await x.event('clearing',purchase,600,null,overrides)).status,'unresolved_clearing');
        assert.equal((await x.event('refund',randomUUID(),-100,purchase,overrides)).status,'unresolved_refund');
      }
      assert.equal(await progress(x.a),600);assert.equal(await progress(y.a),0);
    });
    await t.test('15 repeated concurrent unlink/claim/sweep/account begin has no deadlock',async()=>{
      for(let i=0;i<5;i++) {
        const x=await setup(),f=fake();
        await Promise.all([unlink(x.a,x.first.linked_card_id),claim(x.a,x.card),
          sweepPendingDeletes({env,db,fetch:f.fetch}),rpc('begin_fidel_account_deletion',{_user_id:x.a})]);
        assert.equal((await db.activeCards(x.a)).length,0);
        await sweepPendingDeletes({env,db,fetch:f.fetch});
        const rows=(await client.query('select fidel_delete_state from public.linked_cards where user_id=$1',[x.a])).rows;
        assert.ok(rows.every(r=>['deleted','superseded'].includes(r.fidel_delete_state)));
      }
    });
  } finally { await stop(); }
});
