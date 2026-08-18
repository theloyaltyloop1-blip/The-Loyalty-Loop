-- Admin-only ownership handoff. This is intentionally an RPC rather than a
-- client-side update so no owner can transfer (or take) a shop by editing an
-- owner_id in the browser.
create or replace function public.admin_transfer_business_ownership(
  _business_id uuid,
  _new_owner_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _actor_id uuid := auth.uid();
  _new_owner_id uuid;
  _old_owner_id uuid;
  _normalized_email text := lower(trim(_new_owner_email));
begin
  if _actor_id is null or not public.has_role(_actor_id, 'admin') then
    raise exception 'admin only';
  end if;

  if _normalized_email is null or _normalized_email = '' then
    raise exception 'new owner email is required';
  end if;

  select owner_id into _old_owner_id
  from public.businesses
  where id = _business_id
  for update;

  if _old_owner_id is null then
    raise exception 'business not found';
  end if;

  select id into _new_owner_id
  from auth.users
  where lower(email) = _normalized_email;

  if _new_owner_id is null then
    raise exception 'no account exists for this email';
  end if;

  update public.businesses
  set owner_id = _new_owner_id
  where id = _business_id;

  insert into public.user_roles (user_id, role)
  values (_new_owner_id, 'business_owner')
  on conflict (user_id, role) do nothing;

  insert into public.platform_audit_log (actor_id, action, target_type, target_id, detail)
  values (
    _actor_id,
    'business_ownership_transferred',
    'business',
    _business_id::text,
    jsonb_build_object(
      'from_owner_id', _old_owner_id,
      'to_owner_id', _new_owner_id,
      'to_owner_email', _normalized_email
    )
  );
end;
$$;

revoke all on function public.admin_transfer_business_ownership(uuid, text) from public, anon;
grant execute on function public.admin_transfer_business_ownership(uuid, text) to authenticated;
