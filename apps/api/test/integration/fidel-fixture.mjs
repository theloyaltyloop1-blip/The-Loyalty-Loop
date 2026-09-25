import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

// Shared focused fixture for the Fidel database tests: a minimal public
// schema plus every Fidel migration. It is not a full-history replay.

export async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function as(client, role, sub, sql, params) {
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role, ...(sub ? { sub } : {}) })
  ]);
  await client.query(`set role ${role}`);
  try {
    return await client.query(sql, params);
  } finally {
    await client.query('reset role');
  }
}

export const fixtureSql = String.raw`
  create role anon;
  create role authenticated;
  create role service_role bypassrls; -- as on Supabase
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  $$;
  create type public.transaction_type as enum ('stamp', 'redeem', 'points_earn', 'points_spend');
  create type public.notification_kind as enum ('system', 'stamp', 'reward', 'promo');
  create table public.test_admins (user_id uuid primary key);
  create table public.test_staff (business_id uuid, user_id uuid, perm text);
  create function public.has_role(uuid, text) returns boolean
    language sql stable security definer as $$
      select exists (select 1 from public.test_admins where user_id = $1) $$;
  create function public.is_active_staff_of(uuid, uuid) returns boolean
    language sql stable security definer as $$
      select exists (select 1 from public.test_staff where business_id = $1 and user_id = $2) $$;
  create function public.staff_has_permission(uuid, uuid, text) returns boolean
    language sql stable security definer as $$
      select exists (select 1 from public.test_staff
                     where business_id = $1 and user_id = $2 and perm = $3) $$;
  create function public.update_updated_at_column() returns trigger
    language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
  create table public.businesses (
    id uuid primary key,
    owner_id uuid not null references auth.users(id),
    name text not null default 'Test shop'
  );
  create table public.memberships (
    id uuid primary key default gen_random_uuid(),
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
    on public.transactions for insert with check (true);
  create policy "transactions_select_all" on public.transactions for select using (true);
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
  create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    business_id uuid references public.businesses(id),
    kind public.notification_kind not null default 'system',
    title text not null,
    body text,
    created_at timestamptz not null default now()
  );
`;


// Starts a disposable database with the fixture and every Fidel migration applied.
export async function startFidelDatabase(prefix) {
  const postgres = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), prefix + randomUUID()),
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
  const extra = [];
  const newClient = async () => {
    const c = postgres.getPgClient('postgres', '127.0.0.1');
    await c.connect();
    extra.push(c);
    return c;
  };
  await client.query(fixtureSql);
  const dir = new URL('../../../../supabase/migrations/', import.meta.url);
  const migrations = (await readdir(dir)).filter(n => /^\d+_fidel_.*\.sql$/.test(n)).sort();
  for (const name of migrations) await client.query(await readFile(new URL(name, dir), 'utf8'));
  // The live project attaches these guards in the pre-Fidel history.
  await client.query(`
    create trigger enforce_membership_update_scope
      before update on public.memberships for each row
      execute function public.enforce_membership_update_scope();
    create trigger enforce_rewards_update_scope
      before update on public.rewards for each row
      execute function public.enforce_rewards_update_scope();
  `);
  await client.query(`
    grant usage on schema public to anon, authenticated, service_role;
    grant select, insert on public.transactions to authenticated, service_role;
    grant select on public.memberships, public.businesses to authenticated;
    grant select, insert, update, delete on all tables in schema public to service_role;
  `);
  const stop = async () => {
    for (const c of extra) await c.end().catch(() => {});
    await client.end();
    await postgres.stop();
  };
  return { client, newClient, migrations, stop };
}
