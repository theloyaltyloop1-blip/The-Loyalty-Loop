-- Customers could self-insert a membership with arbitrary stamp_count/points_balance/etc.
-- (memberships_insert_self only checks user_id; enforce_membership_update_scope only covers UPDATE).
-- Direct API inserts (current_user = authenticated/anon) always start from zero; SECURITY DEFINER
-- RPCs and service_role paths run as a different current_user and are unaffected.
create or replace function public.enforce_membership_insert_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.stamp_count := 0;
    new.points_balance := 0;
    new.current_tier := null;
    new.current_streak := 0;
    new.longest_streak := 0;
    new.visit_count := 0;
    new.last_visit_date := null;
    new.last_activity_at := null;
    new.reward_progress_pence := 0;
    new.redemption_blocked_reason := null;
    new.joined_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_membership_insert_defaults() from public, anon, authenticated;

drop trigger if exists enforce_membership_insert_defaults on public.memberships;
create trigger enforce_membership_insert_defaults
  before insert on public.memberships
  for each row execute function public.enforce_membership_insert_defaults();
