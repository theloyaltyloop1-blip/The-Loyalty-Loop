-- Owner decision 2026-10-10: at most one thank-you email per customer per shop every 3 hours (was 6).
create or replace function public.claim_visit_thank_you(
  _business_id uuid,
  _user_id uuid,
  _min_interval interval default interval '3 hours'
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _claimed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'claim_visit_thank_you requires service role';
  end if;
  insert into public.visit_thank_you_log (business_id, user_id, last_sent_at)
  values (_business_id, _user_id, now())
  on conflict (business_id, user_id) do update set last_sent_at = now()
    where public.visit_thank_you_log.last_sent_at <= now() - _min_interval;
  get diagnostics _claimed = row_count;
  return _claimed = 1;
end;
$$;
revoke all on function public.claim_visit_thank_you(uuid, uuid, interval) from public, anon, authenticated;
grant execute on function public.claim_visit_thank_you(uuid, uuid, interval) to service_role;
