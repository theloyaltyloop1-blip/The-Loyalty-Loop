-- Visit thank-you emails: at most one per customer per shop every 6 hours
-- (owner decision, 2026-10-06). The slot is claimed atomically before sending
-- and released if the email provider fails, so a failed send does not use it.

create table if not exists public.visit_thank_you_log (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null,
  primary key (business_id, user_id)
);
alter table public.visit_thank_you_log enable row level security;
revoke all on public.visit_thank_you_log from public, anon, authenticated;

create or replace function public.claim_visit_thank_you(
  _business_id uuid,
  _user_id uuid,
  _min_interval interval default interval '6 hours'
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

create or replace function public.release_visit_thank_you(_business_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'release_visit_thank_you requires service role';
  end if;
  delete from public.visit_thank_you_log where business_id = _business_id and user_id = _user_id;
end;
$$;

revoke execute on function public.claim_visit_thank_you(uuid, uuid, interval) from public, anon, authenticated;
revoke execute on function public.release_visit_thank_you(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_visit_thank_you(uuid, uuid, interval) to service_role;
grant execute on function public.release_visit_thank_you(uuid, uuid) to service_role;
