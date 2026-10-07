create or replace function public.admin_list_transactions(_business_id uuid default null, _limit int default 25, _offset int default 0)
returns table (id uuid, type transaction_type, value int, note text, created_at timestamptz,
               business_id uuid, business_name text, user_id uuid, user_email text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    select t.id, t.type, t.value, t.note, t.created_at, t.business_id, b.name, t.user_id, u.email::text, count(*) over ()
    from public.transactions t join public.businesses b on b.id = t.business_id left join auth.users u on u.id = t.user_id
    where _business_id is null or t.business_id = _business_id
    order by t.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_transactions(uuid, int, int) from public, anon;
grant execute on function public.admin_list_transactions(uuid, int, int) to authenticated;

create or replace function public.admin_list_rewards(_status text default null, _limit int default 25, _offset int default 0)
returns table (id uuid, title text, short_code text, created_at timestamptz, expires_at timestamptz, redeemed_at timestamptz,
               business_id uuid, business_name text, user_id uuid, user_email text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    select r.id, r.title, r.short_code, r.created_at, r.expires_at, r.redeemed_at, r.business_id, b.name, r.user_id, u.email::text, count(*) over ()
    from public.rewards r join public.businesses b on b.id = r.business_id left join auth.users u on u.id = r.user_id
    where _status is null or _status = ''
       or (_status = 'redeemed' and r.redeemed_at is not null)
       or (_status = 'active' and r.redeemed_at is null and (r.expires_at is null or r.expires_at > now()))
       or (_status = 'expired' and r.redeemed_at is null and r.expires_at <= now())
    order by r.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_rewards(text, int, int) from public, anon;
grant execute on function public.admin_list_rewards(text, int, int) to authenticated;
