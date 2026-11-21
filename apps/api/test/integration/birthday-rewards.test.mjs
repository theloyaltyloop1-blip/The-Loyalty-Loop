import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';
import { freePort } from './fidel-fixture.mjs';

// Birthday rewards (20261121120000_birthday_rewards.sql) for stamp and points shops,
// against a minimal schema shaped like production's. handle_spend_transaction and
// shop_local_now come from the custom-programmes migration unchanged.

const migrations = new URL('../../../../supabase/migrations/', import.meta.url);
const read = (name) => readFile(new URL(name, migrations), 'utf8');

function extractFunction(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `function ${name} not found`);
  const rest = sql.slice(start);
  const m = rest.match(/\n(\$\$|\$function\$);/);
  assert.ok(m, `end of ${name} not found`);
  return rest.slice(0, m.index + m[0].length);
}

const fixture = String.raw`
  create role anon; create role authenticated; create role service_role bypassrls;
  create type public.loyalty_type as enum ('stamp_card', 'points', 'tiered');
  create type public.transaction_type as enum ('stamp', 'spend', 'redeem');
  create table public.businesses (
    id uuid primary key default gen_random_uuid(), name text not null, country_code text default 'GB',
    reward_model text not null default 'stamp_legacy', reward_threshold_pence integer,
    loyalty_type public.loyalty_type default 'stamp_card', loyalty_config jsonb default '{}'::jsonb
  );
  create table public.profiles (id uuid primary key, birthday date);
  create table public.memberships (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, business_id uuid not null,
    stamp_count integer not null default 0, points_balance integer not null default 0,
    reward_progress_pence integer not null default 0, redemption_blocked_reason text,
    visit_count integer not null default 0, last_visit_date date, last_activity_at timestamptz,
    unique (user_id, business_id)
  );
  create table public.transactions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, business_id uuid not null,
    membership_id uuid, type public.transaction_type not null, value integer not null,
    points_earned integer, voided_at timestamptz, created_at timestamptz not null default now()
  );
  create table public.reward_catalog (
    id uuid primary key default gen_random_uuid(), business_id uuid not null, title text not null,
    stamp_threshold integer not null default 10, sort_order integer not null default 0,
    spend_threshold_pence integer, created_at timestamptz default now()
  );
  create table public.rewards (id uuid primary key default gen_random_uuid(), user_id uuid, business_id uuid, title text, catalog_id uuid);
  create table public.notifications (id bigserial primary key, user_id uuid, business_id uuid, kind text, title text, body text);
  create table public.programme_bonus_log (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, business_id uuid not null,
    kind text not null, period text not null, points integer not null default 0,
    constraint programme_bonus_log_once unique (user_id, business_id, kind, period)
  );
  create function public.recompute_member_tier(a uuid, b uuid) returns void language sql as $$ select $$;
`;

let pg, db;
const alice = randomUUID(), bob = randomUUID();
const thisMonth = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', month: '2-digit' });
const otherMonth = String((Number(thisMonth) % 12) + 1).padStart(2, '0');

before(async () => {
  pg = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), 'birthday-rewards-' + randomUUID()), port: await freePort(), password: randomUUID(),
    user: 'postgres', persistent: false, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {}, onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  db = pg.getPgClient('postgres', '127.0.0.1');
  await db.connect();
  await db.query(fixture);
  const custom = await read('20261106120000_custom_programmes.sql');
  await db.query(extractFunction(custom, 'shop_local_now'));
  await db.query(extractFunction(custom, 'handle_spend_transaction'));
  await db.query(extractFunction(await read('20260925164755_fidel_spend_tiers.sql'), 'spend_next_tier'));
  await db.query(await read('20261121120000_birthday_rewards.sql'));
  await db.query(`
    create trigger on_stamp_transaction after insert on public.transactions for each row
      when (new.type = 'stamp') execute function public.handle_stamp_transaction();
    create trigger on_spend_transaction after insert on public.transactions for each row
      when (new.type = 'spend') execute function public.handle_spend_transaction();
    create trigger on_spend_void after update of voided_at on public.transactions for each row
      when (old.voided_at is null and new.voided_at is not null and new.type = 'spend') execute function public.handle_spend_void();`);
  // Alice: birthday this month (year 2000 = no year given). Bob: next month.
  await db.query('insert into public.profiles values ($1, $2), ($3, $4)', [alice, `2000-${thisMonth}-15`, bob, `1990-${otherMonth}-02`]);
});

after(async () => {
  await db?.end();
  await pg?.stop();
});

async function shop(model, bonus, extra = {}) {
  const r = await db.query(
    `insert into public.businesses (name, reward_model, loyalty_type, birthday_bonus, loyalty_config) values ('Bean There', $1, $2, $3, $4) returning id`,
    [model, extra.loyaltyType ?? 'stamp_card', bonus, JSON.stringify(extra.config ?? {})]);
  const id = r.rows[0].id;
  for (const u of [alice, bob]) await db.query('insert into public.memberships (user_id, business_id) values ($1, $2)', [u, id]);
  return id;
}
const member = async (u, b) => (await db.query('select * from public.memberships where user_id = $1 and business_id = $2', [u, b])).rows[0];
const stamp = async (u, b, value = 1, forged = 0) =>
  (await db.query(`insert into public.transactions (user_id, business_id, type, value, birthday_bonus) values ($1, $2, 'stamp', $3, $4) returning id`, [u, b, value, forged])).rows[0].id;
const spend = async (u, b, pence) =>
  (await db.query(`insert into public.transactions (user_id, business_id, type, value) values ($1, $2, 'spend', $3) returning id`, [u, b, pence])).rows[0].id;
const bonusOf = async (id) => (await db.query('select birthday_bonus from public.transactions where id = $1', [id])).rows[0].birthday_bonus;

test('stamp shop: first visit in the birthday month gets the bonus once, second visit does not', async () => {
  const b = await shop('stamp_legacy', 2);
  const first = await stamp(alice, b);
  assert.equal(await bonusOf(first), 2);
  assert.equal((await member(alice, b)).stamp_count, 3);
  const note = (await db.query(`select body from public.notifications where user_id = $1 and business_id = $2 and title = 'Happy birthday!'`, [alice, b])).rows;
  assert.deepEqual(note.map((n) => n.body), ['Happy birthday from Bean There! You got 2 bonus stamps.']);

  const second = await stamp(alice, b);
  assert.equal(await bonusOf(second), 0);
  assert.equal((await member(alice, b)).stamp_count, 4);
  assert.equal((await member(alice, b)).visit_count, 2);
});

test('not the birthday month, switched off, or no birthday: no bonus', async () => {
  const on = await shop('stamp_legacy', 2);
  assert.equal(await bonusOf(await stamp(bob, on)), 0);
  const off = await shop('stamp_legacy', null);
  assert.equal(await bonusOf(await stamp(alice, off)), 0);
  assert.equal((await member(alice, off)).stamp_count, 1);
  const nobody = randomUUID();
  await db.query('insert into public.memberships (user_id, business_id) values ($1, $2)', [nobody, on]);
  assert.equal(await bonusOf(await stamp(nobody, on)), 0);
});

test('a value sent by the client is ignored', async () => {
  const b = await shop('stamp_legacy', null);
  assert.equal(await bonusOf(await stamp(bob, b, 1, 40)), 0);
});

test('bonus stamps count towards rewards', async () => {
  const b = await shop('stamp_legacy', 3, { config: { stamps_required: 4 } });
  await stamp(alice, b, 2);
  assert.equal((await member(alice, b)).stamp_count, 1);
  assert.equal((await db.query('select count(*)::int n from public.rewards where user_id = $1 and business_id = $2', [alice, b])).rows[0].n, 1);
});

test('points shop: bonus once, undo hands it back and frees the birthday', async () => {
  const b = await shop('points', 10, { loyaltyType: 'points', config: { points_per_pound: 1 } });
  const first = await spend(alice, b, 500);
  assert.equal(await bonusOf(first), 10);
  assert.equal((await member(alice, b)).points_balance, 15);
  const t = (await db.query('select points_earned from public.transactions where id = $1', [first])).rows[0];
  assert.equal(t.points_earned, 5);
  assert.match((await db.query(`select body from public.notifications where business_id = $1 and title = 'Points added'`, [b])).rows[0].body, /15 points \(including a birthday bonus\)/);

  assert.equal(await bonusOf(await spend(alice, b, 300)), 0);
  assert.equal((await member(alice, b)).points_balance, 18);

  await db.query(`update public.transactions set voided_at = now() where id = $1`, [first]);
  assert.equal((await member(alice, b)).points_balance, 3);
  // The next real visit this month gets the birthday again.
  assert.equal(await bonusOf(await spend(alice, b, 100)), 10);
  assert.equal((await member(alice, b)).points_balance, 14);
});

test('spend-threshold and custom-style shops are left alone', async () => {
  const b = await shop('spend_threshold', 5);
  await db.query('update public.businesses set reward_threshold_pence = 1000 where id = $1', [b]);
  assert.equal(await bonusOf(await spend(alice, b, 200)), 0);
  assert.equal((await db.query(`select count(*)::int n from public.programme_bonus_log where business_id = $1`, [b])).rows[0].n, 0);
});
