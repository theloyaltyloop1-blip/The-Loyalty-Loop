create or replace function public.admin_list_users(_search text default null, _role app_role default null, _limit int default 25, _offset int default 0)
returns table (id uuid, email text, first_name text, last_name text, created_at timestamptz, last_sign_in_at timestamptz,
               roles app_role[], suspended boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    with base as (
      select u.id, u.email::text, p.first_name, p.last_name, u.created_at, u.last_sign_in_at,
             coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '{}'::app_role[]) roles,
             exists (select 1 from public.user_suspensions s where s.user_id = u.id) suspended
      from auth.users u left join public.profiles p on p.id = u.id
      where (_search is null or _search = '' or u.email ilike '%' || _search || '%'
             or coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'') ilike '%' || _search || '%')
        and (_role is null or exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = _role))
    )
    select b.id, b.email, b.first_name, b.last_name, b.created_at, b.last_sign_in_at, b.roles, b.suspended, count(*) over ()
    from base b order by b.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_users(text, app_role, int, int) from public, anon;
grant execute on function public.admin_list_users(text, app_role, int, int) to authenticated;
