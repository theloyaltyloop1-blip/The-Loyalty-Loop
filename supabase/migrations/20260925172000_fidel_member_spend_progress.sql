-- Owners' member list also returns £ progress (ARCH_PLAN.md §4.11). The
-- result columns can't be extended in place, so the function is recreated with
-- the same body plus reward_progress_pence at the end, which keeps existing
-- callers working, and the same privileges.
drop function public.get_business_members(uuid);

create function public.get_business_members(_business_id uuid)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  stamp_count integer,
  points_balance integer,
  visit_count integer,
  last_activity_at timestamptz,
  joined_at timestamptz,
  reward_progress_pence integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.user_id, p.first_name, p.last_name, m.stamp_count, m.points_balance, m.visit_count,
         m.last_activity_at, m.joined_at, m.reward_progress_pence
  from public.memberships m join public.profiles p on p.id = m.user_id
  where m.business_id = _business_id
    and exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = auth.uid())
  order by m.last_activity_at desc nulls last;
$function$;

revoke execute on function public.get_business_members(uuid) from public, anon;
grant execute on function public.get_business_members(uuid) to authenticated, service_role;
