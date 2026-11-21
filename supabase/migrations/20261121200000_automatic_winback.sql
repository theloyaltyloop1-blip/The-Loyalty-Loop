-- Automatic win-back emails, part 1 of 2: settings, run record, candidate query
-- and the scheduler's secret. NOT applied yet. Apply before deploying the new
-- send-winback-emails function. Part 2 (20261121200100_automatic_winback_schedule.sql)
-- turns the daily job on and is applied only after the function is deployed.
--
-- Rules kept from the owner-triggered send:
--   * members who opted out of promos are never emailed
--   * nobody gets a second win-back email from the same shop within 30 days
--   * coupons are one-use, 30-day expiry (winback_email_log, redeem_winback_coupon)
--   * only a send Resend accepted is logged 'sent'; a failure never blocks a retry
-- Extra rules for the automatic run (see the function for the code):
--   * one email per time a customer goes quiet: not again until they have visited
--   * only customers who went quiet in the last 30 days past the threshold, so the
--     first run cannot sweep up years of old members; older ones stay for "Send now"
--   * at most 50 emails per shop per day; the rest go out on following mornings

alter table public.businesses
  add column if not exists winback_auto_enabled boolean not null default true,
  add column if not exists winback_threshold_days integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_winback_threshold_days_range'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_winback_threshold_days_range
      check (winback_threshold_days between 7 and 365);
  end if;
end
$$;

comment on column public.businesses.winback_auto_enabled is
  'Send win-back emails automatically every morning (about 10:00 London). Owner can switch off.';
comment on column public.businesses.winback_threshold_days is
  'Days without a visit before a member counts as gone quiet (automatic run and default for Send now).';

-- One row per shop per London day the automatic run handled it. The primary key
-- is the claim: two overlapping scheduler calls can never both run a shop.
create table if not exists public.winback_auto_runs (
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_on date not null,
  threshold_days integer not null,
  eligible integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  waiting integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (business_id, run_on)
);

alter table public.winback_auto_runs enable row level security;

drop policy if exists "winback_auto_runs_select_owner_or_admin" on public.winback_auto_runs;
create policy "winback_auto_runs_select_owner_or_admin"
  on public.winback_auto_runs for select
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin')
  );
-- No client insert/update/delete: only the edge function (service role) writes.

-- Who would get a win-back email from a shop right now, newest-quiet first.
-- _automatic adds the automatic-run rules described at the top of this file.
-- recently_emailed rows are returned (not dropped) so callers can report them.
create or replace function public.winback_candidates(
  _business_id uuid,
  _threshold_days integer,
  _automatic boolean
)
returns table (
  user_id uuid,
  email text,
  first_name text,
  days_inactive integer,
  recently_emailed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with quiet as (
    select m.user_id, coalesce(m.last_activity_at, m.joined_at) as seen
    from public.memberships m
    where m.business_id = _business_id
      and m.promos_opted_out = false
      and coalesce(m.last_activity_at, m.joined_at) < now() - make_interval(days => _threshold_days)
      and (
        not _automatic
        or coalesce(m.last_activity_at, m.joined_at) >= now() - make_interval(days => _threshold_days + 30)
      )
  )
  select
    q.user_id,
    p.email,
    p.first_name,
    floor(extract(epoch from (now() - q.seen)) / 86400)::integer,
    exists (
      select 1 from public.winback_email_log l
      where l.business_id = _business_id
        and l.user_id = q.user_id
        and l.status = 'sent'
        and (
          l.sent_at >= now() - interval '30 days'
          or (_automatic and l.sent_at >= q.seen)
        )
    )
  from quiet q
  join public.profiles p on p.id = q.user_id
  where nullif(trim(p.email), '') is not null
  order by q.seen desc
$$;

revoke execute on function public.winback_candidates(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.winback_candidates(uuid, integer, boolean) to service_role;

-- Secret the daily job sends to the function. Made inside the database (Vault);
-- nobody needs to see or copy it.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'winback_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'winback_cron_secret',
      'Shared secret for the scheduled send-winback-emails call'
    );
  end if;
end
$$;

create or replace function public.winback_cron_secret_ok(_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _secret is not null
    and length(_secret) >= 32
    and exists (
      select 1 from vault.decrypted_secrets s
      where s.name = 'winback_cron_secret' and s.decrypted_secret = _secret
    )
$$;

revoke execute on function public.winback_cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.winback_cron_secret_ok(text) to service_role;
