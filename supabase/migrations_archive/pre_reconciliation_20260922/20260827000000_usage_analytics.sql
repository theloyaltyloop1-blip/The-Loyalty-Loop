-- Consent-based product analytics for the web, shopper app and business app.
-- Events deliberately contain no email addresses, QR codes, free text or device identifiers.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null check (surface in ('web', 'shopper_app', 'business_app')),
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{1,62}$'),
  context text check (context is null or char_length(context) <= 80),
  occurred_at timestamptz not null default now()
);

create index if not exists usage_events_occurred_at_idx on public.usage_events (occurred_at desc);
create index if not exists usage_events_surface_event_idx on public.usage_events (surface, event_name, occurred_at desc);
create index if not exists usage_events_user_idx on public.usage_events (user_id, occurred_at desc);

alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;
grant insert on public.usage_events to authenticated;
grant usage on sequence public.usage_events_id_seq to authenticated;

create policy "usage_events_insert_own"
  on public.usage_events for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create or replace function public.admin_usage_analytics(_days integer default 30)
returns table (
  event_name text,
  surface text,
  events bigint,
  people bigint,
  last_seen timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.event_name,
    e.surface,
    count(*)::bigint as events,
    count(distinct e.user_id)::bigint as people,
    max(e.occurred_at) as last_seen
  from public.usage_events e
  where e.occurred_at >= now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 365)))
    and public.has_role((select auth.uid()), 'admin')
  group by e.event_name, e.surface
  order by events desc, last_seen desc;
$$;

revoke all on function public.admin_usage_analytics(integer) from public, anon;
grant execute on function public.admin_usage_analytics(integer) to authenticated;
