-- The Loyalty Loop — §0 Foundations + §1 Auth
-- Enums, profiles, user_roles, user_settings, bootstrap functions & triggers.
-- See docs/LOYALTY-LOOP-DATA-MODEL.md §0-2.

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- 1. Enums (created up front — shared vocabulary referenced by later sections)
create type app_role as enum ('consumer', 'business_owner', 'admin', 'staff');
create type business_approval_status as enum ('pending', 'approved', 'rejected');
create type loyalty_type as enum ('stamp_card', 'points', 'tiered');
create type notification_kind as enum ('system', 'stamp', 'reward', 'promo');
create type promo_type as enum ('broadcast', 'targeted');
create type transaction_type as enum ('stamp', 'redeem', 'points_earn', 'points_spend');

-- 2. Short-code generator + retry-on-collision trigger for profiles.stamp_code
create or replace function public.gen_short_code()
returns text
language sql
volatile
as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 8));
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  postcode text,
  birthday date,
  avatar_url text,
  stamp_code text not null default public.gen_short_code(),
  address text,
  address_postcode text,
  address_lat double precision,
  address_lng double precision,
  referred_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_stamp_code_key unique (stamp_code)
);

create or replace function public.ensure_profile_stamp_code()
returns trigger
language plpgsql
as $$
begin
  while exists (select 1 from public.profiles where stamp_code = new.stamp_code) loop
    new.stamp_code := public.gen_short_code();
  end loop;
  return new;
end;
$$;

create trigger ensure_profile_stamp_code
  before insert on public.profiles
  for each row execute function public.ensure_profile_stamp_code();

-- 3. user_roles — single source of truth for permissions
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  constraint user_roles_user_id_role_key unique (user_id, role)
);

-- 4. user_settings
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light',
  language text not null default 'en',
  notify_offers boolean not null default true,
  notify_rewards boolean not null default true,
  notify_stamps boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Generic updated_at trigger, attached to every table with that column
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at
  before update on public.user_settings
  for each row execute function public.update_updated_at_column();

-- 6. has_role — the one permission-check primitive everything else is built on.
-- SECURITY DEFINER + STABLE so RLS policies can call it without recursive-RLS issues.
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- 7. handle_new_user — AFTER INSERT ON auth.users (Supabase-managed trigger point).
-- Creates profile/settings/base-role rows, grants the hardcoded admin bootstrap.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'consumer')
  on conflict (user_id, role) do nothing;

  if lower(new.email) = 'zahihussain92@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. ensure_current_user_bootstrap — callable on every login.
-- Minimal foundations-phase version: guarantees profile/settings/base-role
-- rows exist even for auth paths that bypass handle_new_user (e.g. some OAuth
-- edge cases), and (re-)grants the hardcoded admin bootstrap.
-- Will be extended with CREATE OR REPLACE as later sections add the tables
-- needed to consume pending owner requests / staff invites / franchise
-- handoffs / referral codes (see docs/LOYALTY-LOOP-DATA-MODEL.md §7).
create or replace function public.ensure_current_user_bootstrap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select email into _email from auth.users where id = _uid;

  insert into public.profiles (id, email)
  values (_uid, _email)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (_uid)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (_uid, 'consumer')
  on conflict (user_id, role) do nothing;

  if lower(_email) = 'zahihussain92@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (_uid, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
end;
$$;

-- 9. RLS

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "user_roles_select_self_or_admin"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "user_settings_select_self"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_self"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_self"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
