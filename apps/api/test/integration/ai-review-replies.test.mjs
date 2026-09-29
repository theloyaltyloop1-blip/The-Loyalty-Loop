import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';

// AI review replies migration on disposable local PostgreSQL. The Fidel
// fixture supplies shops, memberships, rewards and £ tiers; this adds
// stand-ins for the review tables and pg_net. No network, no model calls.
const reviewStubs = String.raw`
  alter table public.businesses add column category text, add column description text;
  create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    business_id uuid not null references public.businesses(id),
    rating integer not null check (rating between 1 and 5),
    body text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, business_id)
  );
  create trigger set_updated_at before update on public.reviews
    for each row execute function public.update_updated_at_column();
  create table public.review_replies (
    id uuid primary key default gen_random_uuid(),
    review_id uuid not null unique references public.reviews(id) on delete cascade,
    business_id uuid not null references public.businesses(id),
    owner_id uuid not null references auth.users(id),
    body text not null check (char_length(body) between 1 and 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  alter table public.review_replies enable row level security;
  create policy review_replies_select on public.review_replies for select using (true);
  create policy review_replies_write on public.review_replies for all to authenticated
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  grant select, insert, update on public.review_replies to authenticated;
  create table public.review_reports (
    id uuid primary key default gen_random_uuid(),
    review_id uuid not null references public.reviews(id) on delete cascade,
    status text not null default 'open'
  );
  create schema net;
  create table net.calls (id bigserial primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer)
    returns bigint language sql as $$ insert into net.calls (url, body) values (url, body) returning id $$;
`;

test('AI review replies: triggers, posting rules, drafts and permissions', { timeout: 120000 }, async t => {
  const { client, newClient, stop } = await startFidelDatabase('ai-review-replies-');
  try {
    await client.query(reviewStubs);
    for (const name of ['20260929180500_ai_review_replies.sql', '20260929214500_ai_review_replies_hardening.sql', '20260929223000_ai_review_replies_locks_budget.sql', '20260929230000_ai_review_reply_usage_ledger.sql']) {
      await client.query(await readFile(new URL('../../../../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    await client.query('grant select, insert, update, delete on all tables in schema public to service_role');

    const service = (sql, args) => as(client, 'service_role', null, sql, args).then(r => r.rows[0]?.r);
    const asUser = (user, sql, args) => as(client, 'authenticated', user, sql, args);
    const calls = async () => (await client.query('select count(*)::int n from net.calls')).rows[0].n;
    const draft = async id => (await client.query('select * from public.review_reply_drafts where review_id=$1', [id])).rows[0];
    const reply = async id => (await client.query('select * from public.review_replies where review_id=$1', [id])).rows[0];

    async function setup(rating = 5, body = 'Brilliant service, spotless coat.') {
      const [owner, staff, lazyStaff, customer] = Array.from({ length: 4 }, () => randomUUID());
      const shop = randomUUID();
      await client.query('insert into auth.users(id) select unnest($1::uuid[])', [[owner, staff, lazyStaff, customer]]);
      await client.query("insert into public.businesses(id,owner_id,name,category) values($1,$2,'Pure Test','Dry cleaner')", [shop, owner]);
      await client.query("insert into public.test_staff values($1,$2,'respond_reviews'),($1,$3,'scan_stamps')", [shop, staff, lazyStaff]);
      await client.query('insert into public.memberships(user_id,business_id,visit_count) values($1,$2,12)', [customer, shop]);
      const before = await calls();
      const { rows: [review] } = await client.query(
        'insert into public.reviews(user_id,business_id,rating,body) values($1,$2,$3,$4) returning *', [customer, shop, rating, body]);
      return { owner, staff, lazyStaff, customer, shop, review, triggered: (await calls()) - before };
    }
    const claim = (id, force = false) => service('select public.claim_review_reply_generation($1,$2) r', [id, force]);
    const complete = (id, attempt, body, safe = true, allow = true) =>
      service('select public.complete_review_reply_generation($1,$2,$3,null,$4,$5) r', [id, attempt, body, safe, allow]);

    await t.test('a new review asks for a reply once; unchanged updates and replied reviews do not', async () => {
      const x = await setup();
      assert.equal(x.triggered, 1);
      const before = await calls();
      await client.query('update public.reviews set rating=rating where id=$1', [x.review.id]);
      assert.equal(await calls(), before);
      await client.query("update public.reviews set body='Edited: brilliant.' where id=$1", [x.review.id]);
      assert.equal(await calls(), before + 1);
      await client.query("insert into public.review_replies(review_id,business_id,owner_id,body) values($1,$2,$3,'Thanks!')", [x.review.id, x.shop, x.owner]);
      await client.query("update public.reviews set body='Edited again.' where id=$1", [x.review.id]);
      assert.equal(await calls(), before + 1);
    });

    await t.test('the claim returns only review and shop context and blocks a second writer', async () => {
      const x = await setup();
      const c = await claim(x.review.id);
      assert.equal(c.status, 'claimed');
      assert.deepEqual(Object.keys(c).sort(), ['attempt', 'business', 'review', 'review_version', 'sign_off', 'status']);
      assert.equal(c.business.name, 'Pure Test');
      assert.ok(!JSON.stringify(c).includes(x.customer), 'no customer id in the model context');
      assert.equal((await claim(x.review.id)).reason, 'in_progress');
    });

    await t.test('the unauthenticated path only acts on a request the trigger queued', async () => {
      // An old review with no queued request (e.g. from before the feature).
      const x = await setup();
      await client.query('update public.review_reply_drafts set requested_version=null where review_id=$1', [x.review.id]);
      assert.equal((await claim(x.review.id)).reason, 'not_requested');
      // Re-saving the review unchanged bumps updated_at but queues nothing.
      const y = await setup();
      const before = await calls();
      await client.query('update public.reviews set body=body where id=$1', [y.review.id]);
      assert.equal(await calls(), before);
      assert.equal((await claim(y.review.id)).reason, 'not_requested');
      // Each queued request is consumed once.
      const z = await setup();
      const c = await claim(z.review.id);
      await complete(z.review.id, c.attempt, 'Thank you!');
      assert.equal((await claim(z.review.id)).reason, 'not_requested');
    });

    await t.test('a customer editing a review gets at most 3 automatic replies a day', async () => {
      const x = await setup(2, 'Edit 0');
      for (let i = 1; i <= 3; i++) {
        const c = await claim(x.review.id);
        assert.equal(c.status, 'claimed', 'edit ' + i);
        await complete(x.review.id, c.attempt, 'Sorry ' + i);
        await client.query('update public.reviews set body=$2 where id=$1', [x.review.id, 'Edit ' + i]);
      }
      assert.equal((await claim(x.review.id)).reason, 'daily_limit');
      assert.equal((await claim(x.review.id, true)).status, 'claimed', 'the owner can still ask');
    });

    await t.test('a safe 5-star reply is posted as the owner and labelled AI', async () => {
      const x = await setup();
      const c = await claim(x.review.id);
      assert.equal((await complete(x.review.id, c.attempt, 'Thank you so much!')).status, 'posted');
      const r = await reply(x.review.id);
      assert.equal(r.owner_id, x.owner);
      assert.equal(r.ai_generated, true);
      assert.equal((await draft(x.review.id)).status, 'posted');
      assert.equal((await claim(x.review.id)).reason, 'not_requested');
    });

    await t.test('low ratings, unsafe text, auto-post off and open reports all wait as drafts', async () => {
      const low = await setup(2, 'Waited ages.');
      let c = await claim(low.review.id);
      assert.equal((await complete(low.review.id, c.attempt, 'We are so sorry.')).status, 'ready');
      assert.equal(await reply(low.review.id), undefined);

      const unsafe = await setup();
      c = await claim(unsafe.review.id);
      assert.equal((await complete(unsafe.review.id, c.attempt, 'Call 020 7946 0958', false)).status, 'ready');

      const off = await setup();
      await asUser(off.owner, "select public.set_review_ai_settings($1,true,false,'— Sam')", [off.shop]);
      c = await claim(off.review.id);
      assert.equal(c.sign_off, '— Sam');
      assert.equal((await complete(off.review.id, c.attempt, 'Thanks!\n— Sam')).status, 'ready');

      const reported = await setup();
      await client.query('insert into public.review_reports(review_id) values($1)', [reported.review.id]);
      c = await claim(reported.review.id);
      assert.equal((await complete(reported.review.id, c.attempt, 'Thanks!')).status, 'ready');
    });

    await t.test('a stale writer and an empty reply cannot post', async () => {
      const x = await setup();
      const c = await claim(x.review.id);
      assert.equal((await complete(x.review.id, c.attempt + 1, 'Thanks!')).status, 'stale');
      assert.equal((await complete(x.review.id, c.attempt, '   ')).status, 'failed');
      assert.equal(await reply(x.review.id), undefined);
      assert.equal((await claim(x.review.id)).reason, 'not_requested');
      assert.equal((await claim(x.review.id, true)).status, 'claimed', 'owner can ask again');
    });

    await t.test('disabled shops get no trigger call and no automatic claim', async () => {
      const x = await setup();
      await asUser(x.owner, 'select public.set_review_ai_settings($1,false,true,null)', [x.shop]);
      assert.equal((await claim(x.review.id)).reason, 'disabled', 'a request queued before switching off');
      const before = await calls();
      await client.query("update public.reviews set body='Changed' where id=$1", [x.review.id]);
      assert.equal(await calls(), before);
      assert.equal((await claim(x.review.id)).reason, 'not_requested');
    });

    await t.test('posting a draft: unchanged is AI-labelled, edited is human; permissions enforced', async () => {
      const x = await setup(3, 'OK but slow.');
      const c = await claim(x.review.id);
      await complete(x.review.id, c.attempt, 'Sorry about the wait.');
      await assert.rejects(asUser(x.lazyStaff, 'select public.post_review_reply_draft($1,$2)', [x.review.id, 'Hi']), /not allowed/);
      await assert.rejects(asUser(x.customer, 'select public.post_review_reply_draft($1,$2)', [x.review.id, 'Hi']), /not allowed/);
      assert.equal((await asUser(x.customer, 'select * from public.review_reply_drafts where review_id=$1', [x.review.id])).rows.length, 0);
      assert.equal((await asUser(x.staff, 'select * from public.review_reply_drafts where review_id=$1', [x.review.id])).rows.length, 1);

      await asUser(x.staff, 'select public.post_review_reply_draft($1,$2)', [x.review.id, 'Sorry about the wait.']);
      let r = await reply(x.review.id);
      assert.equal(r.ai_generated, true);
      assert.equal(r.owner_id, x.staff);
      assert.equal((await draft(x.review.id)).status, 'posted');

      await asUser(x.owner, 'select public.post_review_reply_draft($1,$2)', [x.review.id, 'Sorry — we have added a second till.']);
      r = await reply(x.review.id);
      assert.equal(r.ai_generated, false, 'edited text is the shop\'s own');
      assert.equal(r.owner_id, x.staff, 'the original author is kept');

      // Staff can't rewrite a reply someone else wrote, including an AI reply posted as the owner.
      const y = await setup();
      const cy = await claim(y.review.id);
      await complete(y.review.id, cy.attempt, 'Thanks so much!');
      await assert.rejects(asUser(y.staff, 'select public.post_review_reply_draft($1,$2)', [y.review.id, 'Changed']), /not allowed/);
      await asUser(y.owner, 'select public.post_review_reply_draft($1,$2)', [y.review.id, 'Thanks so much, see you soon!']);
      assert.equal((await reply(y.review.id)).body, 'Thanks so much, see you soon!');
    });

    await t.test('direct writes can never claim or keep the AI label', async () => {
      const x = await setup();
      await asUser(x.owner, "insert into public.review_replies(review_id,business_id,owner_id,body,ai_generated) values($1,$2,$3,'Thanks',true)", [x.review.id, x.shop, x.owner]);
      assert.equal((await reply(x.review.id)).ai_generated, false);

      const y = await setup();
      const c = await claim(y.review.id);
      await complete(y.review.id, c.attempt, 'Thank you!');
      await asUser(y.owner, "update public.review_replies set body='Thank you, Jo!' where review_id=$1", [y.review.id]);
      assert.equal((await reply(y.review.id)).ai_generated, false);
    });

    await t.test('dismiss, settings and function permissions', async () => {
      const x = await setup(1, 'Rude.');
      const c = await claim(x.review.id);
      await complete(x.review.id, c.attempt, 'We are sorry.');
      await assert.rejects(asUser(x.lazyStaff, 'select public.dismiss_review_reply_draft($1)', [x.review.id]), /not allowed/);
      await asUser(x.owner, 'select public.dismiss_review_reply_draft($1)', [x.review.id]);
      assert.equal((await draft(x.review.id)).status, 'dismissed');
      await assert.rejects(asUser(x.staff, 'select public.set_review_ai_settings($1,false,false,null)', [x.shop]), /not allowed/);
      await assert.rejects(asUser(x.owner, "select public.set_review_ai_settings($1,true,true,$2)", [x.shop, 'x'.repeat(81)]), /invalid/);
      for (const sig of ['claim_review_reply_generation(uuid,boolean)', 'complete_review_reply_generation(uuid,integer,text,text,boolean,boolean)', 'request_ai_review_reply()']) {
        const row = (await client.query("select has_function_privilege('authenticated',$1,'execute') u, has_function_privilege('anon',$1,'execute') a", ['public.' + sig])).rows[0];
        assert.equal(row.u, false, sig);
        assert.equal(row.a, false, sig);
      }
      await assert.rejects(asUser(x.owner, 'select public.claim_review_reply_generation($1,true)', [x.review.id]), /permission denied/);
    });

    await t.test('completion and an owner post at the same moment do not deadlock', async () => {
      for (let i = 0; i < 3; i++) {
        const x = await setup(2, 'Slow service.');
        const c = await claim(x.review.id);
        const a = await newClient(), b = await newClient();
        // A holds the review row, as an owner post does first.
        await a.query('begin');
        await a.query('select 1 from public.reviews where id=$1 for update', [x.review.id]);
        // B's completion must now wait on the review before touching the draft.
        const completing = as(b, 'service_role', null,
          'select public.complete_review_reply_generation($1,$2,$3,null,false,true) r', [x.review.id, c.attempt, 'Sorry.'])
          .then(r => r.rows[0].r, e => ({ error: e.code }));
        await new Promise(resolve => setTimeout(resolve, 200));
        // A then posts (review -> draft). With the old order this was a 40P01.
        await as(a, 'authenticated', x.owner, 'select public.post_review_reply_draft($1,$2)', [x.review.id, 'We are sorry.']);
        await a.query('commit');
        const done = await completing;
        assert.notEqual(done.error, '40P01');
        assert.equal(done.status, 'stale', 'the owner posted first');
        assert.equal((await reply(x.review.id)).body, 'We are sorry.');
        await a.end(); await b.end();
      }
    });

    await t.test('a shop gets at most 100 automatic replies a day, exactly', async () => {
      const x = await setup();
      await client.query("insert into public.ai_review_reply_usage(business_id) select $1 from generate_series(1,99)", [x.shop]);
      assert.equal((await claim(x.review.id)).status, 'claimed', 'the 100th is allowed');
      const y = await setup();
      await client.query("insert into public.ai_review_reply_usage(business_id) select $1 from generate_series(1,100)", [y.shop]);
      assert.equal((await claim(y.review.id)).reason, 'daily_limit', 'the 101st is refused');
      const owner = await claim(y.review.id, true);
      assert.equal(owner.status, 'claimed', 'the owner can still ask');
      await complete(y.review.id, owner.attempt, 'Thank you!', true, false);
      await client.query("update public.ai_review_reply_usage set created_at=now()-interval '25 hours' where business_id=$1", [y.shop]);
      await client.query("update public.reviews set body='Again' where id=$1", [y.review.id]);
      assert.equal((await claim(y.review.id)).status, 'claimed', 'yesterday no longer counts');
    });

    await t.test('deleting and rewriting a review does not reset the budget', async () => {
      const x = await setup(2, 'First');
      for (let i = 1; i <= 3; i++) {
        const c = await claim(x.review.id);
        assert.equal(c.status, 'claimed', 'generation ' + i);
        await complete(x.review.id, c.attempt, 'Sorry ' + i);
        // The author deletes the review and writes it again.
        await client.query('delete from public.reviews where id=$1', [x.review.id]);
        const { rows: [again] } = await client.query('insert into public.reviews(user_id,business_id,rating,body) values($1,$2,2,$3) returning *', [x.customer, x.shop, 'Rewrite ' + i]);
        x.review = again;
      }
      assert.equal((await claim(x.review.id)).reason, 'daily_limit');
      assert.equal((await client.query('select count(*)::int n from public.ai_review_reply_usage where business_id=$1', [x.shop])).rows[0].n, 3);
      // Deleting the author's account keeps the shop's usage.
      await client.query('delete from public.reviews where user_id=$1', [x.customer]);
      await client.query('delete from public.memberships where user_id=$1', [x.customer]);
      await client.query('delete from auth.users where id=$1', [x.customer]);
      assert.equal((await client.query('select count(*)::int n from public.ai_review_reply_usage where business_id=$1 and author_id is null', [x.shop])).rows[0].n, 3);
    });

    await t.test('two reviews racing for the last shop slot: only one gets it', async () => {
      const x = await setup();
      const other = randomUUID();
      await client.query('insert into auth.users(id) values($1)', [other]);
      await client.query('insert into public.memberships(user_id,business_id) values($1,$2)', [other, x.shop]);
      const { rows: [second] } = await client.query('insert into public.reviews(user_id,business_id,rating,body) values($1,$2,5,$3) returning id', [other, x.shop, 'Also great']);
      await client.query("insert into public.ai_review_reply_usage(business_id) select $1 from generate_series(1,99)", [x.shop]);
      const a = await newClient(), b = await newClient();
      const results = await Promise.all([
        as(a, 'service_role', null, 'select public.claim_review_reply_generation($1,false) r', [x.review.id]).then(r => r.rows[0].r),
        as(b, 'service_role', null, 'select public.claim_review_reply_generation($1,false) r', [second.id]).then(r => r.rows[0].r),
      ]);
      assert.deepEqual(results.map(r => r.status).sort(), ['claimed', 'skipped']);
      assert.equal(results.find(r => r.status === 'skipped').reason, 'daily_limit');
      assert.equal((await client.query('select count(*)::int n from public.ai_review_reply_usage where business_id=$1', [x.shop])).rows[0].n, 100);
      await a.end(); await b.end();
    });

    await t.test('an edited review gets a fresh reply after an earlier draft', async () => {
      const x = await setup(2, 'Slow.');
      let c = await claim(x.review.id);
      await complete(x.review.id, c.attempt, 'Sorry!');
      await client.query("update public.reviews set rating=5, body='Came back, much better!' where id=$1", [x.review.id]);
      c = await claim(x.review.id);
      assert.equal(c.status, 'claimed');
      assert.equal((await complete(x.review.id, c.attempt, 'So glad it was better!')).status, 'posted');
    });
  } finally { await stop(); }
});
