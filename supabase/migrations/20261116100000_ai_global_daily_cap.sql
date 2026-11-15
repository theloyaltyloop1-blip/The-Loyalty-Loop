-- Overall (all users) daily cap for AI assistant calls, so a bug or abuse
-- cannot run up a bill. One row per day and action. Called only by edge
-- functions with the service role; signed-in users cannot call or read it.
-- NOT APPLIED: the owner decides when (see docs/ASK_WHIRL_2026-11-15.md).

create table if not exists public.ai_global_usage (
  day date not null,
  action text not null,
  count integer not null default 0,
  primary key (day, action)
);

alter table public.ai_global_usage enable row level security;
-- No policies: clients (anon and authenticated) cannot read or write it.
revoke all on public.ai_global_usage from anon, authenticated;

-- true while today's count (UK day) is within _limit. Counts the attempt.
create or replace function public.check_global_daily_limit(_action text, _limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _day date := (now() at time zone 'Europe/London')::date;
  _count integer;
begin
  if _limit is null or _limit < 0 then
    return false;
  end if;
  insert into public.ai_global_usage (day, action, count)
  values (_day, _action, 1)
  on conflict (day, action)
  do update set count = ai_global_usage.count + 1
  returning count into _count;

  return _count <= _limit;
end;
$$;

revoke execute on function public.check_global_daily_limit(text, integer) from public, anon, authenticated;
grant execute on function public.check_global_daily_limit(text, integer) to service_role;

-- Tidy: keep 35 days of counters.
create or replace function public.prune_ai_global_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_global_usage where day < (now() at time zone 'Europe/London')::date - 35;
$$;
revoke execute on function public.prune_ai_global_usage() from public, anon, authenticated;
grant execute on function public.prune_ai_global_usage() to service_role;
