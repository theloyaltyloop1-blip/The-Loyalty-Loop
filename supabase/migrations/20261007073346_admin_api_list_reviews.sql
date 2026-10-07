create or replace function public.admin_list_reviews(_max_rating int default null, _limit int default 25, _offset int default 0)
returns table (id uuid, rating int, body text, created_at timestamptz, business_id uuid, business_name text,
               user_id uuid, user_email text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    select v.id, v.rating, v.body, v.created_at, v.business_id, b.name, v.user_id, u.email::text, count(*) over ()
    from public.reviews v join public.businesses b on b.id = v.business_id left join auth.users u on u.id = v.user_id
    where _max_rating is null or v.rating <= _max_rating
    order by v.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_reviews(int, int, int) from public, anon;
grant execute on function public.admin_list_reviews(int, int, int) to authenticated;
