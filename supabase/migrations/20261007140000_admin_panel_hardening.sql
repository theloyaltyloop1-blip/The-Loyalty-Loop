-- Hardening after review of the admin panel RPCs.

-- Deleting an admin's account must not be blocked by a suspension they issued.
alter table public.user_suspensions drop constraint if exists user_suspensions_suspended_by_fkey;
alter table public.user_suspensions
  add constraint user_suspensions_suspended_by_fkey foreign key (suspended_by) references auth.users(id) on delete set null;

-- A suspended account loses admin API access immediately (not at JWT expiry).
create or replace function public.admin_assert()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'admin only'; end if;
  if exists (select 1 from public.user_suspensions where user_id = auth.uid()) then raise exception 'account suspended'; end if;
end; $$;
revoke all on function public.admin_assert() from public, anon;
grant execute on function public.admin_assert() to authenticated;

-- is_active is owner-controlled (reactivate_my_business can undo it), so an admin
-- "deactivate" was ineffective. Use admin_set_business_status (approval_status) instead.
drop function if exists public.admin_set_business_active(uuid, boolean);

-- Expose voided state so voided spend is not mistaken for live activity.
drop function if exists public.admin_list_transactions(uuid, int, int);
create function public.admin_list_transactions(_business_id uuid default null, _limit int default 25, _offset int default 0)
returns table (id uuid, type transaction_type, value int, note text, created_at timestamptz, voided_at timestamptz,
               business_id uuid, business_name text, user_id uuid, user_email text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_assert();
  return query
    select t.id, t.type, t.value, t.note, t.created_at, t.voided_at, t.business_id, b.name, t.user_id, u.email::text, count(*) over ()
    from public.transactions t join public.businesses b on b.id = t.business_id left join auth.users u on u.id = t.user_id
    where _business_id is null or t.business_id = _business_id
    order by t.created_at desc limit least(_limit, 200) offset greatest(_offset, 0);
end; $$;
revoke all on function public.admin_list_transactions(uuid, int, int) from public, anon;
grant execute on function public.admin_list_transactions(uuid, int, int) to authenticated;

-- Do not audit no-op calls.
create or replace function public.admin_respond_support_request(_id uuid, _response text, _resolve boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  update public.support_requests set admin_response = nullif(trim(_response), ''),
    status = case when _resolve then 'resolved' else status end,
    resolved_at = case when _resolve then now() else resolved_at end,
    resolved_by = case when _resolve then auth.uid() else resolved_by end
  where id = _id;
  if not found then raise exception 'support request not found'; end if;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'support_response', 'support_request', _id::text, jsonb_build_object('resolved', _resolve));
end; $$;
revoke all on function public.admin_respond_support_request(uuid, text, boolean) from public, anon;
grant execute on function public.admin_respond_support_request(uuid, text, boolean) to authenticated;
