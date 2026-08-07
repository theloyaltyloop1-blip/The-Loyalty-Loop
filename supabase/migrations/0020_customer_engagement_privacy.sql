-- Customer engagement, legal acceptance and privacy controls.
-- Every exposed table has RLS and explicit authenticated grants.

create table public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create policy "referral_codes_select_self" on public.referral_codes for select to authenticated using ((select auth.uid()) = user_id);
grant select, insert on public.referral_codes to authenticated;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "referrals_select_participant" on public.referrals for select to authenticated using ((select auth.uid()) in (referrer_id, referred_id));
grant select on public.referrals to authenticated;

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('terms','privacy')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  unique(user_id, document_key, document_version)
);
alter table public.legal_acceptances enable row level security;
create policy "legal_acceptances_select_self" on public.legal_acceptances for select to authenticated using ((select auth.uid()) = user_id);
create policy "legal_acceptances_insert_self" on public.legal_acceptances for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.legal_acceptances to authenticated;

-- Securely applies a code once. The code is never trusted from client metadata.
create or replace function public.apply_referral_code(_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare _referrer uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select user_id into _referrer from public.referral_codes where code = upper(trim(_code));
  if _referrer is null or _referrer = _uid then return false; end if;
  insert into public.referrals (referrer_id, referred_id, referral_code)
    values (_referrer, _uid, upper(trim(_code))) on conflict (referred_id) do nothing;
  if found then
    update public.profiles set referred_by = _referrer where id = _uid and referred_by is null;
    insert into public.notifications (user_id, kind, title, body, link)
      values (_referrer, 'reward', 'Referral joined!', 'A friend joined The Loyalty Loop using your link.', '/dashboard/profile');
  end if;
  return found;
end; $$;
revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated;

-- Seed a referral code for each existing and newly-created profile.
insert into public.referral_codes (user_id) select id from public.profiles on conflict do nothing;
create or replace function public.create_referral_code_for_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.referral_codes (user_id) values (new.id) on conflict do nothing; return new; end; $$;
create trigger on_profile_created_referral_code after insert on public.profiles for each row execute function public.create_referral_code_for_profile();

-- Extend the existing auth bootstrap so sign-up agreement/referral intent is
-- recorded only after authentication, with the code validated by the RPC.
create or replace function public.ensure_current_user_bootstrap()
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _email text; _meta jsonb; _ref text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select email, raw_user_meta_data into _email, _meta from auth.users where id = _uid;
  insert into public.profiles (id, email) values (_uid, _email) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (_uid) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (_uid, 'consumer') on conflict (user_id, role) do nothing;
  if lower(_email) in ('zahihussain92@gmail.com','flyhigher722@gmail.com','developer@the-loyalty-loop.com') then insert into public.user_roles (user_id,role) values (_uid,'admin') on conflict do nothing; end if;
  if coalesce((_meta->>'legal_accepted')::boolean,false) then
    insert into public.legal_acceptances(user_id,document_key,document_version) values (_uid,'terms','2026-08-07'),(_uid,'privacy','2026-08-07') on conflict do nothing;
  end if;
  _ref := _meta->>'ref_code'; if _ref is not null then perform public.apply_referral_code(_ref); end if;
end; $$;

-- Platform announcements use notifications, so customers receive a real inbox item.
create table public.platform_announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  is_active boolean not null default true, created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.platform_announcements enable row level security;
create policy "platform_announcements_select_active" on public.platform_announcements for select to authenticated using (is_active or public.has_role(auth.uid(), 'admin'));
create policy "platform_announcements_admin_write" on public.platform_announcements for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select, insert, update, delete on public.platform_announcements to authenticated;
create trigger set_updated_at before update on public.platform_announcements for each row execute function public.update_updated_at_column();

create or replace function public.deliver_platform_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    insert into public.notifications (user_id, kind, title, body, link)
      select p.id, 'system', new.title, new.body, '/dashboard/inbox' from public.profiles p;
  end if;
  return new;
end; $$;
create trigger on_platform_announcement_published after insert on public.platform_announcements for each row execute function public.deliver_platform_announcement();
