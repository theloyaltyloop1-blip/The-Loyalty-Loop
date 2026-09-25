import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function setClaims(client, role, sub) {
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role, ...(sub ? { sub } : {}) })
  ]);
  const { rows: [settings] } = await client.query(`
    select current_setting('request.jwt.claim.role', true) as legacy_role,
           current_setting('request.jwt.claim.sub', true) as legacy_sub
  `);
  assert.equal(settings.legacy_role || '', '', 'legacy role must stay unset');
  assert.equal(settings.legacy_sub || '', '', 'legacy subject must stay unset');
}

test('Focused Fidel migrations with a public-schema fixture enforce JSON-claims roles, progress, clawback and redemption', { timeout: 90000 }, async () => {
  const postgres = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), 'loyalty-fidel-' + randomUUID()),
    port: await freePort(),
    password: randomUUID(),
    user: 'postgres',
    persistent: false,
    authMethod: 'scram-sha-256',
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: () => {}
  });
  await postgres.initialise();
  await postgres.start();
  const client = postgres.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  try {
    await client.query(String.raw`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        )::uuid
      $$;
      create function auth.role() returns text language sql stable as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.role', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
        )
      $$;
      create type public.transaction_type as enum ('stamp', 'redeem', 'points_earn', 'points_spend');
      create type public.notification_kind as enum ('system', 'stamp', 'reward', 'promo');
      create function public.has_role(uuid, text) returns boolean
        language sql stable as $$ select false $$;
      create function public.is_active_staff_of(uuid, uuid) returns boolean
        language sql stable as $$ select false $$;
      create function public.staff_has_permission(uuid, uuid, text) returns boolean
        language sql stable as $$ select false $$;
      create function public.update_updated_at_column() returns trigger
        language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
      create table public.businesses (
        id uuid primary key,
        owner_id uuid not null references auth.users(id)
      );
      create table public.memberships (
        id uuid primary key,
        user_id uuid not null references auth.users(id),
        business_id uuid not null references public.businesses(id),
        stamp_count integer not null default 0,
        points_balance integer not null default 0,
        current_tier text,
        current_streak integer not null default 0,
        longest_streak integer not null default 0,
        visit_count integer not null default 0,
        last_visit_date date,
        last_activity_at timestamptz,
        promos_opted_out boolean not null default false,
        joined_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (user_id, business_id)
      );
      create table public.transactions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id),
        business_id uuid not null references public.businesses(id),
        membership_id uuid references public.memberships(id),
        type public.transaction_type not null,
        value integer not null default 1 check (value > 0 and value <= 50),
        note text,
        created_at timestamptz not null default now()
      );
      alter table public.transactions enable row level security;
      create policy "transactions_insert_owner_or_staff_or_admin"
        on public.transactions for insert
        with check (
          exists (select 1 from public.businesses b
                  where b.id = business_id and b.owner_id = auth.uid())
          or public.staff_has_permission(business_id, auth.uid(), 'scan_stamps')
          or public.has_role(auth.uid(), 'admin')
        );
      create table public.rewards (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id),
        business_id uuid not null references public.businesses(id),
        title text not null default 'Free reward',
        qr_token text not null default 'token',
        short_code text not null default 'code',
        catalog_id uuid,
        expires_at timestamptz,
        redeemed_at timestamptz,
        created_at timestamptz not null default now()
      );
      create table public.reward_catalog (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references public.businesses(id),
        title text not null,
        stamp_threshold integer not null default 10,
        sort_order integer not null default 0
      );
      create table public.notifications (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id),
        business_id uuid references public.businesses(id),
        kind public.notification_kind not null default 'system',
        title text not null,
        body text,
        created_at timestamptz not null default now()
      );
      create table public.profiles (id uuid primary key, first_name text, last_name text);
      -- Stand-in for the live function, which a Fidel migration drops and recreates.
      create function public.get_business_members(_business_id uuid) returns integer
        language sql stable as $$ select 1 $$;
    `);
    // This focused fixture exercises every Fidel migration, not the full app history.
    const migrationsDirectory = new URL('../../../../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(migrationsDirectory))
      .filter(name => /^\d+_fidel_.*\.sql$/.test(name)).sort();
    assert.ok(migrations.includes('20260922233331_fidel_service_role_detection.sql'));
    const signatures = [
      'public.process_fidel_webhook_event(text,text,text,text,text,text,text,integer,boolean,boolean)',
      'public.apply_spend_clawback(uuid,integer,text)',
      'public.enforce_membership_update_scope()'
    ];
    const functionPrivileges = async () => (await client.query(
      'select oid::regprocedure::text as signature, proacl::text as acl from pg_proc where oid = any($1::regprocedure[]) order by oid',
      [signatures]
    )).rows;
    let originalPrivileges;
    for (const name of migrations) {
      const file = new URL(name, migrationsDirectory);
      if (name === '20260922233331_fidel_service_role_detection.sql') {
        originalPrivileges = await functionPrivileges();
      }
      await client.query(await readFile(file, 'utf8'));
    }
    assert.deepEqual(await functionPrivileges(), originalPrivileges, 'corrective migration must preserve all existing function ACLs');
    await client.query(String.raw`
      create trigger enforce_membership_update_scope
        before update on public.memberships for each row
        execute function public.enforce_membership_update_scope();
      create trigger enforce_rewards_update_scope
        before update on public.rewards for each row
        execute function public.enforce_rewards_update_scope();
    `);

    for (const signature of signatures) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows: [permission] } = await client.query(
          "select has_function_privilege($1::name, $2::text, 'EXECUTE') as allowed",
          [role, signature]
        );
        // The two RPCs grant service_role explicitly. The guard is a trigger;
        // this stock fixture does not have Supabase's service-role default grants.
        const expected = role === 'service_role' && !signature.endsWith('enforce_membership_update_scope()');
        assert.equal(permission.allowed, expected, `${role}: ${signature}`);
      }
    }
    const invalidRpc = `select public.process_fidel_webhook_event(
      '', 'transaction.auth', 'synthetic-invalid', 'program-test',
      'card-customer', 'location-test', null, 0, true, false
    )`;
    for (const role of ['service_role', 'anon', 'authenticated']) {
      await setClaims(client, role);
      await client.query(`set role ${role}`);
      try {
        await assert.rejects(client.query(invalidRpc), role === 'service_role'
          ? /invalid validated Fidel transaction arguments/
          : /permission denied for function process_fidel_webhook_event/);
      } finally {
        await client.query('reset role');
      }
    }
    assert.equal((await client.query('select count(*)::int as n from public.fidel_webhook_events')).rows[0].n, 0);

    const owner = randomUUID(), customer = randomUUID(), staff = randomUUID();
    const business = randomUUID(), membership = randomUUID();
    await client.query('insert into auth.users(id) values ($1), ($2), ($3)', [owner, customer, staff]);
    await client.query("insert into public.businesses(id, owner_id, reward_model, reward_threshold_pence) values ($1, $2, 'spend_threshold', 500)", [business, owner]);
    await client.query('insert into public.memberships(id, user_id, business_id) values ($1, $2, $3)', [membership, customer, business]);
    await setClaims(client, 'service_role');
    await client.query(
      "insert into public.transactions(user_id, business_id, membership_id, type, value) values ($1,$2,$3,'spend',1250)",
      [customer, business, membership]
    );
    let state = await client.query(
      'select reward_progress_pence, visit_count from public.memberships where id=$1',
      [membership]
    );
    assert.equal(state.rows[0].reward_progress_pence, 250);
    assert.equal(state.rows[0].visit_count, 1);
    assert.equal((await client.query('select count(*)::int as n from public.rewards')).rows[0].n, 2);
    await client.query('select public.apply_spend_clawback($1, $2, $3)', [
      membership, -400, 'Refund reduced your reward progress.'
    ]);
    state = await client.query(
      'select reward_progress_pence, redemption_blocked_reason from public.memberships where id=$1',
      [membership]
    );
    assert.equal(state.rows[0].reward_progress_pence, -150);
    assert.equal(state.rows[0].redemption_blocked_reason, 'Refund reduced your reward progress.');
    await setClaims(client, 'authenticated', staff);
    await assert.rejects(
      client.query('update public.rewards set redeemed_at=now() where id=(select id from public.rewards limit 1)'),
      /reward redemption is temporarily blocked/
    );
    await assert.rejects(
      client.query('update public.memberships set reward_progress_pence=999 where id=$1', [membership]),
      /reward progress requires a trusted transaction/
    );
    await setClaims(client, 'service_role');
    await client.query(
      "insert into public.transactions(user_id, business_id, membership_id, type, value) values ($1,$2,$3,'spend',200)",
      [customer, business, membership]
    );
    state = await client.query(
      'select reward_progress_pence, redemption_blocked_reason from public.memberships where id=$1',
      [membership]
    );
    assert.equal(state.rows[0].reward_progress_pence, 50);
    assert.equal(state.rows[0].redemption_blocked_reason, null);

    // The redemption trigger must wait for an in-flight refund's membership
    // lock, then see the committed hold rather than a stale positive balance.
    const competing = postgres.getPgClient('postgres', '127.0.0.1');
    await competing.connect();
    try {
      await client.query('grant update, select on public.rewards to authenticated');
      await setClaims(competing, 'authenticated', staff);
      const rewardId = (await client.query('select id from public.rewards limit 1')).rows[0].id;
      await client.query('begin');
      await client.query('select public.apply_spend_clawback($1, $2, $3)', [
        membership, -100, 'Refund is being reconciled.'
      ]);
      await competing.query('set role authenticated');
      const competingRedemption = competing.query(
        'update public.rewards set redeemed_at=now() where id=$1', [rewardId]
      );
      await new Promise(resolve => setTimeout(resolve, 100));
      await client.query('commit');
      await assert.rejects(competingRedemption, /reward redemption is temporarily blocked/);
      await competing.query('reset role');
      assert.equal((await client.query('select redeemed_at from public.rewards where id=$1', [rewardId])).rows[0].redeemed_at, null);
    } finally {
      await client.query('rollback').catch(() => {});
      await competing.end();
    }
    await assert.rejects(
      client.query("insert into public.transactions(user_id,business_id,membership_id,type,value) values ($1,$2,$3,'stamp',51)", [customer,business,membership]),
      /shop_uses_spend_rewards/ // stamps are refused outright at a spend shop (20260925164755); the 1–50 stamp range is covered in fidel-spend-tiers
    );

    await client.query('insert into public.linked_cards(user_id,fidel_card_id) values ($1,$2),($3,$4)', [
      customer, 'card-customer', staff, 'card-other'
    ]);
    await client.query('insert into public.business_fidel_locations(business_id,fidel_program_id,fidel_location_id) values ($1,$2,$3)', [
      business, 'program-test', 'location-test'
    ]);
    await client.query('grant usage on schema auth to authenticated');
    await client.query('grant select on public.businesses to authenticated');
    await client.query('grant select on public.memberships to authenticated');
    await client.query('grant insert on public.transactions to authenticated');
    await setClaims(client, 'authenticated', customer);
    await client.query('set role authenticated');
    assert.equal((await client.query('select count(*)::int as n from public.linked_cards')).rows[0].n, 1);
    assert.equal((await client.query('select count(*)::int as n from public.business_fidel_locations')).rows[0].n, 0);
    await assert.rejects(
      client.query("insert into public.linked_cards(user_id,fidel_card_id) values ($1,'forbidden')", [customer]),
      /permission denied/
    );
    await client.query('reset role');
    await setClaims(client, 'authenticated', owner);
    await client.query('set role authenticated');
    assert.equal((await client.query('select count(*)::int as n from public.business_fidel_locations')).rows[0].n, 1);
    await assert.rejects(
      client.query("insert into public.transactions(user_id,business_id,membership_id,type,value) values ($1,$2,$3,'spend',999999)", [customer,business,membership]),
      /row-level security policy/
    );
    await client.query('reset role');

    // Synthetic provider events exercise the single atomic RPC directly. They
    // are not Fidel-signed sandbox deliveries and do not verify provider shape.
    await setClaims(client, 'service_role');
    const syntheticAuth = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-auth', 'transaction.auth', 'synthetic-auth',
        'program-test', 'card-customer', 'location-test', null, 400, true, false
      ) as outcome
    `);
    assert.equal(syntheticAuth.rows[0].outcome.status, 'processed');
    assert.equal((await client.query("select reward_progress_pence from public.memberships where id=$1", [membership])).rows[0].reward_progress_pence, 350);
    assert.equal((await client.query("select progress_credited_pence,status from public.fidel_transactions where fidel_transaction_id='synthetic-auth'")).rows[0].progress_credited_pence, 400);
    assert.equal((await client.query("select count(*)::int as n from public.transactions where note='fidel:auth:synthetic-auth'")).rows[0].n, 1);

    const syntheticDuplicate = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-auth-retry', 'transaction.auth', 'synthetic-auth',
        'program-test', 'card-customer', 'location-test', null, 400, true, false
      ) as outcome
    `);
    assert.equal(syntheticDuplicate.rows[0].outcome.status, 'duplicate');
    assert.equal((await client.query("select count(*)::int as n from public.transactions where note='fidel:auth:synthetic-auth'")).rows[0].n, 1);

    const syntheticZeroAuth = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-zero-auth', 'transaction.auth', 'synthetic-zero-auth',
        'program-test', 'card-customer', 'location-test', null, 0, true, false
      ) as outcome
    `);
    assert.equal(syntheticZeroAuth.rows[0].outcome.status, 'ignored_zero_amount');
    assert.equal((await client.query("select count(*)::int as n from public.transactions where note='fidel:auth:synthetic-zero-auth'")).rows[0].n, 0);

    const syntheticNegativeClearing = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-negative-clearing', 'transaction.clearing', 'synthetic-clearing-negative',
        'program-test', 'card-customer', 'location-test', null, -400, false, true
      ) as outcome
    `);
    assert.equal(syntheticNegativeClearing.rows[0].outcome.status, 'ignored_negative_clearing');
    assert.equal((await client.query("select status from public.fidel_transactions where fidel_transaction_id='synthetic-auth'")).rows[0].status, 'authorized');

    const syntheticRefund = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-refund', 'transaction.refund', 'synthetic-refund-1',
        'program-test', 'card-customer', 'location-test', 'synthetic-auth', -200, false, true
      ) as outcome
    `);
    assert.equal(syntheticRefund.rows[0].outcome.status, 'processed');
    const syntheticRefundState = await client.query("select total_refunded_pence,progress_credited_pence,status from public.fidel_transactions where fidel_transaction_id='synthetic-auth'");
    assert.deepEqual(syntheticRefundState.rows[0], { total_refunded_pence: 200, progress_credited_pence: 200, status: 'partially_refunded' });
    assert.equal((await client.query("select reward_progress_pence from public.memberships where id=$1", [membership])).rows[0].reward_progress_pence, 150);

    const syntheticUnresolvedRefund = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-unresolved-refund', 'transaction.refund', 'synthetic-refund-2',
        'program-test', 'card-customer', 'location-test', 'unknown-purchase', -100, false, true
      ) as outcome
    `);
    assert.equal(syntheticUnresolvedRefund.rows[0].outcome.status, 'unresolved_refund');

    const syntheticOverRefund = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-over-refund', 'transaction.refund', 'synthetic-refund-over',
        'program-test', 'card-customer', 'location-test', 'synthetic-auth', -300, false, true
      ) as outcome
    `);
    assert.equal(syntheticOverRefund.rows[0].outcome.status, 'invalid_refund');
    const syntheticOverRefundRetry = await client.query(`
      select public.process_fidel_webhook_event(
        'synthetic-message-over-refund-retry', 'transaction.refund', 'synthetic-refund-over',
        'program-test', 'card-customer', 'location-test', 'synthetic-auth', -300, false, true
      ) as outcome
    `);
    assert.equal(syntheticOverRefundRetry.rows[0].outcome.status, 'duplicate');
    assert.deepEqual((await client.query("select total_refunded_pence,progress_credited_pence,status from public.fidel_transactions where fidel_transaction_id='synthetic-auth'")).rows[0], {
      total_refunded_pence: 200, progress_credited_pence: 200, status: 'partially_refunded'
    });
  } finally {
    await client.end();
    await postgres.stop();
  }
});
