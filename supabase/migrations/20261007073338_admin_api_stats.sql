create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _out jsonb;
begin
  perform public.admin_assert();
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'roles', coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from public.user_roles group by role) r), '{}'::jsonb),
    'businesses', (select count(*) from public.businesses),
    'businesses_pending', (select count(*) from public.businesses where approval_status = 'pending'),
    'verifications_pending', (select count(*) from public.businesses where verification_status = 'pending'),
    'memberships', (select count(*) from public.memberships),
    'transactions', (select count(*) from public.transactions),
    'rewards_issued', (select count(*) from public.rewards),
    'rewards_redeemed', (select count(*) from public.rewards where redeemed_at is not null),
    'reviews', (select count(*) from public.reviews),
    'support_open', (select count(*) from public.support_requests where status = 'open'),
    'suspended_users', (select count(*) from public.user_suspensions),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'transactions', (
        select count(*) from public.transactions t where t.created_at::date = d::date)) order by d)
      from generate_series(current_date - 13, current_date, interval '1 day') d), '[]'::jsonb)
  ) into _out;
  return _out;
end; $$;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
