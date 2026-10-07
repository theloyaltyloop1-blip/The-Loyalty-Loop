-- Admin panel API: cross-tenant read/moderation RPCs. All security definer,
-- all gated on has_role(auth.uid(),'admin'); every mutation writes platform_audit_log.

create table public.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  suspended_by uuid references auth.users(id),
  suspended_at timestamptz not null default now()
);
alter table public.user_suspensions enable row level security;
create policy "user_suspensions_admin_read" on public.user_suspensions for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));
grant select on public.user_suspensions to authenticated;

create or replace function public.admin_assert()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'admin only'; end if;
end; $$;
revoke all on function public.admin_assert() from public, anon;
grant execute on function public.admin_assert() to authenticated;

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

create or replace function public.admin_set_user_suspended(_user_id uuid, _suspended boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  if _user_id = auth.uid() then raise exception 'cannot suspend yourself'; end if;
  if _suspended then
    insert into public.user_suspensions(user_id, reason, suspended_by) values (_user_id, _reason, auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();
    -- Enforce: block new sign-ins/refreshes and kill existing sessions.
    update auth.users set banned_until = now() + interval '100 years' where id = _user_id;
    delete from auth.sessions where user_id = _user_id;
  else
    delete from public.user_suspensions where user_id = _user_id;
    update auth.users set banned_until = null where id = _user_id;
  end if;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), case when _suspended then 'user_suspended' else 'user_unsuspended' end, 'user', _user_id::text,
          jsonb_build_object('reason', _reason));
end; $$;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;

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

create or replace function public.admin_delete_review(_review_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  delete from public.reviews where id = _review_id;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'review_deleted', 'review', _review_id::text, jsonb_build_object('reason', _reason));
end; $$;
revoke all on function public.admin_delete_review(uuid, text) from public, anon;
grant execute on function public.admin_delete_review(uuid, text) to authenticated;

create or replace function public.admin_respond_support_request(_id uuid, _response text, _resolve boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  update public.support_requests set admin_response = nullif(trim(_response), ''),
    status = case when _resolve then 'resolved' else status end,
    resolved_at = case when _resolve then now() else resolved_at end,
    resolved_by = case when _resolve then auth.uid() else resolved_by end
  where id = _id;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'support_response', 'support_request', _id::text, jsonb_build_object('resolved', _resolve));
end; $$;
revoke all on function public.admin_respond_support_request(uuid, text, boolean) from public, anon;
grant execute on function public.admin_respond_support_request(uuid, text, boolean) to authenticated;
