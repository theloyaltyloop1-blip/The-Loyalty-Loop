-- Typo-tolerant, ranked search for the admin Businesses and Users lists.
-- Uses what Postgres already ships (pg_trgm + unaccent); no external search service.
-- WRITTEN ONLY - review, then apply deliberately. Same function signatures and return
-- columns as before, so the web app (apps/web/src/lib/admin.ts) needs no change.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE, which blocks use in indexes; this wrapper is the standard workaround.
create or replace function public.search_norm(_value text)
returns text language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(_value, '')))
$$;

-- Trigram index so substring and fuzzy matches stay fast as the shop count grows.
create index if not exists businesses_name_search_trgm
  on public.businesses using gin (public.search_norm(name) extensions.gin_trgm_ops);

create or replace function public.admin_list_businesses(_search text default null, _status business_approval_status default null, _limit int default 25, _offset int default 0)
returns table (id uuid, name text, slug text, category text, owner_id uuid, owner_email text, approval_status business_approval_status,
               verification_status text, is_active boolean, loyalty_type loyalty_type, members bigint, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  q text := public.search_norm(nullif(btrim(_search), ''));
begin
  perform public.admin_assert();
  return query
    with scored as (
      select b.*, u.email::text as owner_email_text,
             case when q is null then 0
                  else greatest(
                         case when public.search_norm(b.name) like q || '%' then 1.0
                              when public.search_norm(b.name) like '%' || q || '%' then 0.8 else 0 end,
                         extensions.word_similarity(q, public.search_norm(b.name)),
                         case when public.search_norm(u.email::text) like '%' || q || '%' then 0.7 else 0 end)
             end as score
      from public.businesses b left join auth.users u on u.id = b.owner_id
    )
    select s.id, s.name, s.slug, s.category, s.owner_id, s.owner_email_text, s.approval_status, s.verification_status, s.is_active, s.loyalty_type,
           (select count(*) from public.memberships m where m.business_id = s.id), s.submitted_at, count(*) over ()
    from scored s
    where (q is null or s.score >= 0.4)           -- 0.4 ~ one typo in a short name; raise to be stricter
      and (_status is null or s.approval_status = _status)
    order by s.score desc, s.submitted_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_businesses(text, business_approval_status, int, int) from public, anon;
grant execute on function public.admin_list_businesses(text, business_approval_status, int, int) to authenticated;

create or replace function public.admin_list_users(_search text default null, _role app_role default null, _limit int default 25, _offset int default 0)
returns table (id uuid, email text, first_name text, last_name text, created_at timestamptz, last_sign_in_at timestamptz,
               roles app_role[], suspended boolean, total bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  q text := public.search_norm(nullif(btrim(_search), ''));
begin
  perform public.admin_assert();
  return query
    with base as (
      select u.id, u.email::text as email, p.first_name, p.last_name, u.created_at, u.last_sign_in_at,
             coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '{}'::app_role[]) as roles,
             exists (select 1 from public.user_suspensions s where s.user_id = u.id) as suspended,
             case when q is null then 0
                  else greatest(
                         case when public.search_norm(u.email::text) like q || '%' then 1.0
                              when public.search_norm(u.email::text) like '%' || q || '%' then 0.8 else 0 end,
                         extensions.word_similarity(q, public.search_norm(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))),
                         case when public.search_norm(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) like '%' || q || '%' then 0.9 else 0 end)
             end as score
      from auth.users u left join public.profiles p on p.id = u.id
      where (_role is null or exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = _role))
    )
    select b.id, b.email, b.first_name, b.last_name, b.created_at, b.last_sign_in_at, b.roles, b.suspended, count(*) over ()
    from base b
    where q is null or b.score >= 0.4
    order by b.score desc, b.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_users(text, app_role, int, int) from public, anon;
grant execute on function public.admin_list_users(text, app_role, int, int) to authenticated;
