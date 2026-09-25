-- Existing check_rate_limit() only ever truncates its window to the current
-- minute (the _window_seconds param is accepted but unused), so it's only
-- suited to burst protection. Add a daily-cap sibling, reusing the same
-- rpc_rate_limits table under a different window granularity, for capping
-- cost-incurring AI calls per user per day.
create or replace function public.check_daily_limit(_action text, _limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _window timestamptz := date_trunc('day', now());
  _count integer;
begin
  insert into public.rpc_rate_limits (user_id, action, window_start, count)
  values (auth.uid(), _action, _window, 1)
  on conflict (user_id, action, window_start)
  do update set count = rpc_rate_limits.count + 1
  returning count into _count;

  return _count <= _limit;
end;
$$;

grant execute on function public.check_daily_limit(text, integer) to authenticated;
revoke execute on function public.check_daily_limit(text, integer) from public, anon;
