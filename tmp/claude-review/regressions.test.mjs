import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { as, startFidelDatabase } from '../../apps/api/test/integration/fidel-fixture.mjs';
import { claimCards, unlinkCard, deleteAllFidelCardsForUser } from '../../supabase/functions/_shared/fidel-cards.ts';

// REVIEW REPRODUCERS: assertions describe observed defects, not desired behavior.
// Disposable local PostgreSQL and fake HTTP only. Never calls Supabase or Fidel.
test('reproduce missing card-lifecycle and manual-spend cases', { timeout: 120000 }, async () => {
  const { client, newClient, stop } = await startFidelDatabase('codex-review-');
  try {
    const [owner, staff, alice, bob, carol] = Array.from({length:5}, () => randomUUID());
    const shop = randomUUID();
    await client.query('insert into auth.users(id) select unnest($1::uuid[])', [[owner,staff,alice,bob,carol]]);
    await client.query("insert into public.businesses(id,owner_id,name,reward_model,reward_threshold_pence) values($1,$2,'Review shop','spend_threshold',1000)",[shop,owner]);
    await client.query("insert into public.test_staff values($1,$2,'scan_stamps')",[shop,staff]);
    await client.query('insert into public.memberships(user_id,business_id) select unnest($1::uuid[]),$2',[[alice,bob,carol],shop]);
    await client.query("insert into public.business_fidel_locations(business_id,fidel_program_id,fidel_location_id,fidel_status) values($1,'program-review','loc-review','active')",[shop]);
    const service = (sql,args,c=client) => as(c,'service_role',null,sql,args).then(r=>r.rows[0]?.r);
    const identity = user => service('select public.fidel_link_identity($1) as r',[user]);
    const claim = (user,id) => service("select public.claim_linked_card($1,$2,'account-review','visa','4242') as r",[user,id]);
    const unlink = (user,id) => service("select public.unlink_linked_card($1,$2,'user') as r",[user,id]);
    const event = (type,id,original,amount,auth,cleared) => service('select public.process_fidel_webhook_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r',[randomUUID(),type,id,'program-review','card-alice','loc-review',original,amount,auth,cleared]);
    const aliceMeta = await identity(alice);
    const oldCard = await claim(alice,'card-alice');
    assert.equal((await event('transaction.auth','purchase-review',null,600,true,false)).status,'processed');
    await unlink(alice,oldCard.linked_card_id);
    const refundUnlinked = await event('transaction.refund','refund-unlinked','purchase-review',-100,false,true);
    assert.equal(refundUnlinked.status,'unknown_card');
    const newCard = await claim(alice,'card-alice');
    assert.notEqual(newCard.linked_card_id, oldCard.linked_card_id);
    const clearingRelinked = await event('transaction.clearing','purchase-review',null,600,true,true);
    const refundRelinked = await event('transaction.refund','refund-relinked','purchase-review',-100,false,true);
    assert.equal(clearingRelinked.status,'unresolved_clearing');
    assert.equal(refundRelinked.status,'unresolved_refund');
    assert.equal((await client.query('select reward_progress_pence from public.memberships where user_id=$1',[alice])).rows[0].reward_progress_pence,600);
    console.log('REPRO: unlink refund=unknown_card; re-link clearing=unresolved_clearing/refund=unresolved_refund; original 600p remains.');

    const env = name => ({FIDEL_API_KEY:'sk_test_review',FIDEL_SDK_KEY:'pk_test_review',FIDEL_PROGRAM_ID:'program-review'})[name];
    const signatures = {
      fidel_link_identity:['uuid'], claim_linked_card:['uuid','text','text','text','text'],
      unlink_linked_card:['uuid','uuid','text'], mark_fidel_card_deleted:['uuid','text']
    };
    const db = {
      rpc: async(fn,args) => {
        const values=Object.values(args);
        const params=signatures[fn].map((t,i)=>`$${i+1}::${t}`).join(',');
        return { data:await service(`select public.${fn}(${params}) as r`,values),error:null };
      },
      activeCards:async user => (await client.query('select id as "linkedCardId",card_scheme as scheme,last_numbers as "lastNumbers",linked_at as "linkedAt" from public.linked_cards where user_id=$1 and unlinked_at is null',[user])).rows,
      isAdmin:async()=>false
    };
    const providerCard = {id:'card-alice',accountId:'account-review',programId:'program-review',scheme:'visa',lastNumbers:'4242',live:false,metadata:{id:aliceMeta}};
    const fakeProvider = async(_url,init={}) => init.method==='DELETE'
      ? new Response('{}',{status:503})
      : new Response(JSON.stringify({items:[providerCard]}));
    const removed = await unlinkCard({env,db,fetch:fakeProvider},alice,{linkedCardId:newCard.linked_card_id});
    assert.equal(removed.cards.length,0);
    const recovered = await claimCards({env,db,fetch:fakeProvider},alice,{});
    assert.equal(recovered.status,'claimed');
    assert.equal(recovered.cards.length,1);
    console.log('REPRO: failed provider deletion + opening recovery silently restores a deliberately removed card.');

    let deletionStarted, completeDelete;
    const started = new Promise(resolve => { deletionStarted=resolve; });
    const pendingDelete = new Promise(resolve => { completeDelete=resolve; });
    let providerExists=true;
    const removal = unlinkCard({env,db,fetch:async()=>{
      deletionStarted(); await pendingDelete; providerExists=false;
      return new Response(null,{status:204});
    }},alice,{linkedCardId:recovered.cards[0].linkedCardId});
    await started;
    const duringDelete=await claimCards({env,db,fetch:async()=>new Response(JSON.stringify({items:[providerCard]}))},alice,{});
    assert.equal(duringDelete.status,'claimed');
    completeDelete(); await removal;
    assert.equal(providerExists,false);
    assert.equal((await db.activeCards(alice)).length,1);
    console.log('REPRO: concurrent recovery during successful deletion leaves local card active although provider card is deleted.');

    // Account deletion sees only locally stored cards; rejected over-limit card is absent.
    for(let i=0;i<4;i++) await claim(alice,`card-extra-${i}`);
    const overLimit = {...providerCard,id:'card-over-limit'};
    const cap = await claimCards({env,db,fetch:async(_url,init={}) => init.method==='DELETE'
      ? new Response('{}',{status:503}) : new Response(JSON.stringify({items:[overLimit]}))},alice,{cardId:overLimit.id});
    assert.equal(cap.status,'limit_reached');
    assert.equal((await client.query('select count(*)::int n from public.linked_cards where fidel_card_id=$1',[overLimit.id])).rows[0].n,0);
    const deletedIds=[];
    const rows=(await client.query('select fidel_card_id,fidel_deleted_at from public.linked_cards where user_id=$1',[alice])).rows;
    await deleteAllFidelCardsForUser({env,fetch:async(url)=>{deletedIds.push(url.split('/').pop());return new Response(null,{status:204});}},rows);
    assert.ok(!deletedIds.includes(overLimit.id));
    console.log('REPRO: failed over-limit delete has no durable cleanup record and is missed by account deletion.');

    const record=(customer,amount,ref,c=client)=>as(c,'authenticated',staff,'select public.record_manual_spend($1,$2,$3,$4,$5) as r',[shop,customer,amount,'cash',ref]).then(r=>r.rows[0].r);
    const ref=randomUUID();
    const first=await record(bob,600,ref);
    const changed=await record(carol,500,ref);
    assert.equal(changed.status,'duplicate');
    assert.equal(changed.transactionId,first.transactionId);
    assert.equal(changed.amountPence,600);
    assert.equal((await client.query('select reward_progress_pence from public.memberships where user_id=$1',[carol])).rows[0].reward_progress_pence,0);
    console.log('REPRO: same idempotency key with changed customer/amount returns success for original purchase.');

    await identity(carol); await claim(carol,'card-carol');
    const c1=await newClient(),c2=await newClient();
    const raceRef=randomUUID();
    await c1.query('begin');
    const race1=await record(carol,200,raceRef,c1);
    const race2=record(carol,200,raceRef,c2).then(x=>({ok:x}),e=>({error:e.message}));
    await new Promise(resolve=>setTimeout(resolve,250));
    await c1.query('commit');
    assert.equal(race1.status,'recorded');
    assert.equal((await race2).error,'manual_too_soon');
    console.log('REPRO: identical concurrent retry at active linked-card shop returns manual_too_soon, not duplicate success.');

    await client.query("update public.business_fidel_locations set fidel_status='syncing' where business_id=$1",[shop]);
    assert.equal((await event('transaction.auth','purchase-syncing',null,100,true,false)).status,'processed');
    console.log('REPRO: webhook credits an auth even when Location is syncing and excluded from automatic-earning/P5 lists.');

    const sharedRef=randomUUID();
    await c1.query('begin');
    const staffEntry=await record(bob,250,sharedRef,c1);
    const ownerRetry=as(c2,'authenticated',owner,'select public.record_manual_spend($1,$2,$3,$4,$5) as r',[shop,carol,350,'cash',sharedRef]);
    await new Promise(resolve=>setTimeout(resolve,250));
    await c1.query('commit');
    assert.equal((await ownerRetry).rows[0].r.transactionId,staffEntry.transactionId);
    console.log('REPRO: concurrent duplicate branch returns another caller/customer entry without rechecking the request.');

    await client.query('delete from auth.users where id=$1',[staff]);
    assert.equal((await client.query('select recorded_by from public.transactions where id=$1',[first.transactionId])).rows[0].recorded_by,null);
    await assert.rejects(as(client,'authenticated',owner,'select public.undo_manual_spend($1,$2) as r',[first.transactionId,'Review correction']),/not_allowed/);
    console.log('REPRO: deleting former staff removes the only manual-origin marker, blocking owner undo within its allowed window.');
  } finally { await stop(); }
});
