import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';
import { as, freePort } from './fidel-fixture.mjs';

// Custom programmes (20261106120000_custom_programmes.sql) against a minimal
// schema shaped like production's. The real record_manual_spend, spend_next_tier,
// member_rolling_spend and lock_programme_after_activity are taken from their
// migrations, so a purchase goes through the same path as the apps.

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
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  create schema cron;
  create table cron.job (jobname text, schedule text, command text);
  create function cron.schedule(_name text, _schedule text, _command text) returns bigint language sql as $$
    insert into cron.job values (_name, _schedule, _command); select 1::bigint $$;

  create type public.app_role as enum ('admin', 'business_owner', 'customer');
  create type public.loyalty_type as enum ('stamp_card', 'points', 'tiered');
  create type public.transaction_type as enum ('stamp', 'spend', 'redeem');
  create table public.user_roles (user_id uuid, role public.app_role);
  create function public.has_role(_user uuid, _role public.app_role) returns boolean language sql stable as $$
    select exists (select 1 from public.user_roles where user_id = _user and role = _role) $$;
  create function public.is_active_staff_of(_b uuid, _u uuid) returns boolean language sql stable as $$ select false $$;
  create table public.countries (code text primary key, amount_scale integer not null default 1);
  insert into public.countries values ('GB', 1);
  create table public.businesses (
    id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
    name text not null, slug text unique, category text, country_code text default 'GB', brand_color text,
    reward_model text not null default 'stamp_legacy', reward_threshold_pence integer,
    loyalty_type public.loyalty_type default 'stamp_card', loyalty_config jsonb default '{}'::jsonb,
    is_active boolean not null default true, manual_spend_max_pence integer not null default 100000,
    constraint businesses_reward_model_check check (reward_model in ('stamp_legacy','spend_threshold','tiers','points'))
  );
  create table public.profiles (id uuid primary key references auth.users(id), birthday date, referred_by uuid);
  create table public.memberships (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
    business_id uuid not null references public.businesses(id), stamp_count integer not null default 0,
    points_balance integer not null default 0, reward_progress_pence integer not null default 0,
    redemption_blocked_reason text, current_tier text, current_tier_id uuid, current_streak integer not null default 0,
    longest_streak integer not null default 0, visit_count integer not null default 0, last_visit_date date,
    last_activity_at timestamptz, joined_at timestamptz not null default now(), unique (user_id, business_id)
  );
  create table public.transactions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, business_id uuid not null,
    membership_id uuid, type public.transaction_type not null, value integer not null,
    points_earned integer, voided_at timestamptz, created_at timestamptz not null default now(),
    client_ref uuid unique, recorded_by uuid default auth.uid(), manual_payment_method text
  );
  create table public.reward_catalog (
    id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
    title text not null, description text, stamp_threshold integer not null default 10, sort_order integer not null default 0,
    spend_threshold_pence integer, discount_pence integer, points_cost integer
  );
  create table public.rewards (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, business_id uuid not null, title text not null,
    catalog_id uuid references public.reward_catalog(id) on delete set null, created_at timestamptz default now(), redeemed_at timestamptz
  );
  create table public.notifications (id bigserial primary key, user_id uuid, business_id uuid, kind text, title text, body text);
  create table public.membership_tiers (id uuid primary key default gen_random_uuid(), business_id uuid, name text,
    spend_threshold_pence integer, perks text[]);
  create table public.points_redemptions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
    business_id uuid not null references public.businesses(id), catalog_id uuid references public.reward_catalog(id) on delete set null,
    points integer not null check (points > 0), reward_id uuid references public.rewards(id) on delete set null,
    client_ref uuid not null unique, created_at timestamptz not null default now()
  );
  create function public.can_record_manual_spend(_business_id uuid, _user_id uuid) returns boolean
    language sql stable security definer set search_path = '' as $$
    select _user_id is not null and (exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = _user_id)
      or public.has_role(_user_id, 'admin')) $$;

  create function public.apply_tiers_spend(a uuid, b uuid, c uuid) returns void language sql as $$ select $$;
  create function public.apply_points_spend(a uuid, b uuid, c uuid, d uuid, e integer) returns void language sql as $$ select $$;
  create function public.recompute_member_tier(a uuid, b uuid) returns void language sql as $$ select $$;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`;

let pg, db;
const owner = randomUUID(), alice = randomUUID(), bob = randomUUID(), stranger = randomUUID();

const cafeRules = {
  version: 1,
  unit: { one: 'bean', many: 'beans' },
  earn: [
    { label: 'Per pound', per_pound: 1 },
    { label: 'Big shop', per_visit: 5, when: { min_spend_pence: 2000 } },
    { label: 'Triple for gold', multiplier: 3, when: { levels: ['gold'] } },
  ],
  bonuses: { signup: 3, birthday: 10, referral: 7 },
  cash_value: { points: 3, pence: 100, max_pence_per_visit: 500 },
  rewards: [
    { key: 'coffee', title: 'Free coffee', points_cost: 12, discount_pence: 300 },
    { key: 'cake', title: 'Free cake', discount_percent: 50 },
  ],
  milestones: [
    { label: 'Every 3rd visit', reward: 'cake', every_visits: 3 },
    { label: 'Big spender', reward: 'coffee', at_lifetime_spend_pence: 5000 },
  ],
  levels: [{ key: 'gold', name: 'Gold', min_visits: 2, multiplier: 2, perks: ['Oat milk free'] }],
  caps: { max_points_per_day: 100 },
  expiry: { inactive_months: 6 },
  summary: 'A bean per pound; 3 beans = £1 off.',
};

before(async () => {
  pg = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), 'custom-programmes-' + randomUUID()), port: await freePort(), password: randomUUID(),
    user: 'postgres', persistent: false, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {}, onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  db = pg.getPgClient('postgres', '127.0.0.1');
  await db.connect();
  await db.query(fixture);
  const tiersPoints = await read('20261020100000_programme_tiers_points.sql');
  const spendTiers = await read('20260925164755_fidel_spend_tiers.sql');
  for (const sql of [
    extractFunction(spendTiers, 'spend_next_tier'),
    extractFunction(tiersPoints, 'member_rolling_spend'),
    extractFunction(tiersPoints, 'lock_programme_after_activity'),
    extractFunction(tiersPoints, 'record_manual_spend'),
  ]) await db.query(sql);
  await db.query(`
    create trigger lock_programme_after_activity before update of reward_model on public.businesses
      for each row execute function public.lock_programme_after_activity();
    alter table public.points_redemptions enable row level security;`);
  await db.query(await read('20261106120000_custom_programmes.sql'));
  await db.query(`
    create trigger enforce_membership_update_scope before update on public.memberships
      for each row execute function public.enforce_membership_update_scope();
    create trigger on_spend_transaction after insert on public.transactions for each row
      when (new.type = 'spend') execute function public.handle_spend_transaction();
    create trigger on_spend_void after update of voided_at on public.transactions for each row
      when (old.voided_at is null and new.voided_at is not null and new.type = 'spend') execute function public.handle_spend_void();
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  for (const id of [owner, alice, bob, stranger]) await db.query('insert into auth.users values ($1)', [id]);
  await db.query(`insert into public.user_roles values ($1, 'business_owner')`, [owner]);
  const month = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', month: '2-digit' });
  await db.query(`insert into public.profiles (id, birthday, referred_by) values ($1, $2, null), ($3, null, $1), ($4, null, null)`,
    [alice, `1990-${month}-15`, bob, stranger]);
});

after(async () => {
  await db?.end();
  await pg?.stop();
});

const owned = (sql, params) => as(db, 'authenticated', owner, sql, params);
let shopId;

async function spend(customer, pence) {
  const r = await owned('select public.record_manual_spend($1, $2, $3, $4, $5) as r', [shopId, customer, pence, 'cash', randomUUID()]);
  return r.rows[0].r;
}
const member = async (u) => (await db.query('select * from public.memberships where user_id = $1 and business_id = $2', [u, shopId])).rows[0];

test('owner creates a custom shop; rewards mirror into the catalogue', async () => {
  const r = await owned(`select public.create_shop_with_custom_programme('Bean There', 'Café', 'GB', $1::jsonb) as id`, [JSON.stringify(cafeRules)]);
  shopId = r.rows[0].id;
  const b = (await db.query('select reward_model, loyalty_type from public.businesses where id = $1', [shopId])).rows[0];
  assert.deepEqual(b, { reward_model: 'custom', loyalty_type: 'points' });
  const cat = (await db.query('select rule_key, points_cost, discount_pence, discount_percent from public.reward_catalog where business_id = $1 order by sort_order', [shopId])).rows;
  assert.deepEqual(cat, [
    { rule_key: 'coffee', points_cost: 12, discount_pence: 300, discount_percent: null },
    { rule_key: 'cake', points_cost: null, discount_pence: null, discount_percent: 50 },
  ]);
  assert.equal((await db.query(`select count(*)::int n from cron.job where jobname = 'expire-custom-points'`)).rows[0].n, 1);
});

test('invalid rules and non-owners are refused', async () => {
  await assert.rejects(owned(`select public.create_shop_with_custom_programme('X', null, 'GB', $1::jsonb)`,
    [JSON.stringify({ ...cafeRules, earn: [{ label: 'x', multiplier: 99 }] })]), /invalid_programme_rules/);
  await assert.rejects(owned(`select public.create_shop_with_custom_programme('X', null, 'GB', $1::jsonb)`,
    [JSON.stringify({ ...cafeRules, earn: [{ label: 'x', per_visit: 'lots' }] })]), /invalid_programme_rules/);
  await assert.rejects(owned(`select public.create_shop_with_custom_programme('X', null, 'GB', '"nope"'::jsonb)`), /invalid_programme_rules/);
  await assert.rejects(as(db, 'authenticated', stranger, `select public.create_shop_with_custom_programme('X', null, 'GB', $1::jsonb)`,
    [JSON.stringify(cafeRules)]), /not_a_business_owner/);
  await assert.rejects(as(db, 'authenticated', stranger, `select public.set_custom_programme($1, $2::jsonb)`,
    [shopId, JSON.stringify(cafeRules)]), /not_allowed/);
  // Writing the column directly is checked too.
  await assert.rejects(owned(`update public.businesses set programme_rules = '{}'::jsonb where id = $1`, [shopId]), /invalid_programme_rules/);
});

test('joining gives the sign-up bonus, and the referrer their bonus', async () => {
  await db.query('insert into public.memberships (user_id, business_id) values ($1, $2)', [alice, shopId]);
  assert.equal((await member(alice)).points_balance, 3);
  // Bob was referred by Alice, who is already a member.
  await db.query('insert into public.memberships (user_id, business_id) values ($1, $2)', [bob, shopId]);
  assert.equal((await member(bob)).points_balance, 3);
  assert.equal((await member(alice)).points_balance, 10);
});

test('purchases: per £, birthday once, level multiplier, milestones, day cap', async () => {
  // Visit 1, £12.50: 12 beans + 10 birthday.
  let r = await spend(alice, 1250);
  assert.equal(r.status, 'recorded');
  assert.equal(r.programme, 'custom');
  assert.equal((await member(alice)).points_balance, 10 + 22);
  // Visit 2 (now Gold for the next visit), £25: 25 + 5 big shop, no birthday again, level before = none.
  await spend(alice, 2500);
  let m = await member(alice);
  assert.equal(m.points_balance, 32 + 30);
  assert.equal(m.current_tier, 'Gold');
  // Visit 3 as Gold, £10: (10) × max(3, 2) = 30 → day cap 100 leaves 100 - 52 = 48, so 30. 3rd visit → cake. Lifetime £47.50 → no coffee yet.
  await spend(alice, 1000);
  assert.equal((await member(alice)).points_balance, 62 + 30);
  let rewards = (await db.query('select title from public.rewards where user_id = $1 order by created_at', [alice])).rows.map((x) => x.title);
  assert.deepEqual(rewards, ['Free cake']);
  // Visit 4, £30: 30 + 5 = 35, × 3 = 105 → capped to what is left today (100 - 82 = 18). Lifetime crosses £50 → coffee.
  r = await spend(alice, 3000);
  assert.equal((await member(alice)).points_balance, 92 + 18);
  rewards = (await db.query('select title from public.rewards where user_id = $1 order by created_at', [alice])).rows.map((x) => x.title);
  assert.deepEqual(rewards, ['Free cake', 'Free coffee']);
  assert.equal(r.levelName, 'Gold');
  assert.deepEqual(r.levelPerks, ['Oat milk free']);
  assert.equal(r.cashAvailablePence, 500);
});

test('a refund takes back exactly what that purchase earned', async () => {
  const before = (await member(alice)).points_balance;
  const t = (await db.query(`select id, points_earned from public.transactions where user_id = $1 order by created_at desc limit 1`, [alice])).rows[0];
  await db.query('update public.transactions set voided_at = now() where id = $1', [t.id]);
  assert.equal((await member(alice)).points_balance, before - t.points_earned);
});

test('3 beans = £1 off at the till: whole steps, visit limit, balance, idempotent', async () => {
  const ref = randomUUID();
  const call = (pts, cref = randomUUID(), who = owner) =>
    as(db, 'authenticated', who, 'select public.redeem_points_for_cash($1, $2, $3, $4) as r', [shopId, alice, pts, cref]);
  await assert.rejects(call(4), /points_not_a_whole_step/);
  await assert.rejects(call(18), /above_visit_limit/);
  await assert.rejects(call(3, randomUUID(), stranger), /not_allowed/);
  const before = (await member(alice)).points_balance;
  const r = (await call(9, ref)).rows[0].r;
  assert.deepEqual([r.status, r.pointsUsed, r.discountPence, r.pointsBalance], ['redeemed', 9, 300, before - 9]);
  const again = (await call(9, ref)).rows[0].r;
  assert.equal(again.status, 'duplicate');
  assert.equal((await member(alice)).points_balance, before - 9);
});

test('customers swap points for a catalogue reward at custom shops', async () => {
  const coffee = (await db.query(`select id from public.reward_catalog where business_id = $1 and rule_key = 'coffee'`, [shopId])).rows[0].id;
  const before = (await member(alice)).points_balance;
  const r = (await as(db, 'authenticated', alice, 'select public.redeem_points_reward($1, $2, $3) as r', [shopId, coffee, randomUUID()])).rows[0].r;
  assert.equal(r.status, 'redeemed');
  assert.equal(r.pointsBalance, before - 12);
});

test('customers cannot edit their own balance or level', async () => {
  await assert.rejects(as(db, 'authenticated', alice, 'update public.memberships set points_balance = 99999 where user_id = $1 and business_id = $2', [alice, shopId]),
    /trusted transaction/);
  await assert.rejects(as(db, 'authenticated', alice, `update public.memberships set current_tier = 'Gold' where user_id = $1 and business_id = $2`, [bob, shopId]),
    /trusted transaction/);
});

test('changing the rules re-syncs rewards; issued rewards keep their title', async () => {
  const next = { ...cafeRules, rewards: [{ key: 'cake', title: 'Free cake', discount_percent: 50 }], milestones: [cafeRules.milestones[0]] };
  await owned('select public.set_custom_programme($1, $2::jsonb)', [shopId, JSON.stringify(next)]);
  const keys = (await db.query('select rule_key from public.reward_catalog where business_id = $1', [shopId])).rows.map((x) => x.rule_key);
  assert.deepEqual(keys, ['cake']);
  const titles = (await db.query('select title, catalog_id from public.rewards where user_id = $1 and title = $2', [alice, 'Free coffee'])).rows;
  assert.ok(titles.length >= 1 && titles.every((t) => t.catalog_id === null));
});

test('expiry clears balances after the inactive period', async () => {
  await db.query(`update public.memberships set last_activity_at = now() - interval '7 months' where user_id = $1 and business_id = $2`, [bob, shopId]);
  const n = (await db.query('select public.expire_custom_points() as n')).rows[0].n;
  assert.equal(n, 1);
  assert.equal((await member(bob)).points_balance, 0);
  assert.ok((await member(alice)).points_balance > 0);
});

test('a stamp shop with customer progress cannot switch to custom; a fresh one can', async () => {
  const stamp = (await db.query(`insert into public.businesses (owner_id, name) values ($1, 'Old') returning id`, [owner])).rows[0].id;
  await db.query('insert into public.reward_catalog (business_id, title) values ($1, $2)', [stamp, 'Old reward']);
  await owned('select public.set_custom_programme($1, $2::jsonb)', [stamp, JSON.stringify(cafeRules)]);
  const cat = (await db.query('select rule_key from public.reward_catalog where business_id = $1 order by sort_order', [stamp])).rows.map((x) => x.rule_key);
  assert.deepEqual(cat, ['coffee', 'cake']);

  const busy = (await db.query(`insert into public.businesses (owner_id, name) values ($1, 'Busy') returning id`, [owner])).rows[0].id;
  await db.query('insert into public.memberships (user_id, business_id, stamp_count) values ($1, $2, 4)', [alice, busy]);
  await assert.rejects(owned('select public.set_custom_programme($1, $2::jsonb)', [busy, JSON.stringify(cafeRules)]), /programme_locked/);
});
