create or replace function public.admin_list_businesses(_search text default null, _status business_approval_status default null, _limit int default 25, _offset int default 0)
returns table (id uuid, name text, slug text, category text, owner_id uuid, owner_email text, approval_status business_approval_status,
               verification_status text, is_active boolean, loyalty_type loyalty_type, members bigint, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    select b.id, b.name, b.slug, b.category, b.owner_id, u.email::text, b.approval_status, b.verification_status, b.is_active, b.loyalty_type,
           (select count(*) from public.memberships m where m.business_id = b.id), b.submitted_at, count(*) over ()
    from public.businesses b left join auth.users u on u.id = b.owner_id
    where (_search is null or _search = '' or b.name ilike '%' || _search || '%' or u.email ilike '%' || _search || '%')
      and (_status is null or b.approval_status = _status)
    order by b.submitted_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_businesses(text, business_approval_status, int, int) from public, anon;
grant execute on function public.admin_list_businesses(text, business_approval_status, int, int) to authenticated;

create or replace function public.admin_set_business_active(_business_id uuid, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  update public.businesses set is_active = _active where id = _business_id;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'business_active', 'business', _business_id::text, jsonb_build_object('active', _active));
end; $$;
revoke all on function public.admin_set_business_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_business_active(uuid, boolean) to authenticated;
