-- Bug found during staff testing: enforce_membership_update_scope only
-- recognized owner/admin as "privileged" — a staff member's stamp award
-- (via handle_stamp_transaction's internal UPDATE) hit the customer-only
-- branch and got rejected with "customers may only change promos_opted_out",
-- even though the staff insert into transactions had already been allowed
-- by RLS. Widen the privileged check to include active staff of the shop.
create or replace function public.enforce_membership_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_privileged boolean;
begin
  _is_privileged := public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
    or public.is_active_staff_of(new.business_id, auth.uid());

  if _is_privileged then
    return new;
  end if;

  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.stamp_count != old.stamp_count
    or new.points_balance != old.points_balance
    or new.current_tier is distinct from old.current_tier
    or new.current_streak != old.current_streak
    or new.longest_streak != old.longest_streak
    or new.visit_count != old.visit_count
    or new.last_visit_date is distinct from old.last_visit_date
    or new.last_activity_at is distinct from old.last_activity_at
    or new.joined_at != old.joined_at
  then
    raise exception 'customers may only change promos_opted_out';
  end if;

  return new;
end;
$$;
