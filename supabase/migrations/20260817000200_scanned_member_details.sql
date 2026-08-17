-- A minimal, permission-gated customer record for the scan/redeem screen.
-- It deliberately exposes details only after a valid card/code has resolved a
-- member of the caller's own business.
create or replace function public.get_scanned_member_details(_business_id uuid, _user_id uuid)
returns table (
  id uuid, first_name text, last_name text, email text,
  stamp_count integer, points_balance integer, visit_count integer,
  joined_at timestamptz, last_activity_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (
    exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
    or public.staff_has_permission(_business_id, auth.uid(), 'scan_stamps')
    or public.staff_has_permission(_business_id, auth.uid(), 'redeem_rewards')
  ) then raise exception 'not authorized to view member details'; end if;

  return query
  select p.id, p.first_name, p.last_name, p.email,
    m.stamp_count, m.points_balance, m.visit_count, m.joined_at, m.last_activity_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.business_id = _business_id and m.user_id = _user_id;
end;
$$;
revoke all on function public.get_scanned_member_details(uuid, uuid) from public, anon;
grant execute on function public.get_scanned_member_details(uuid, uuid) to authenticated;
