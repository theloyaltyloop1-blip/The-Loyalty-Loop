-- Account deletion must never silently detach a live shop. An owner must first
-- either permanently remove each shop or hand it to an existing account.

create or replace function public.transfer_owned_business_ownership(
  _business_id uuid,
  _new_owner_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  _actor_id uuid := auth.uid();
  _new_owner_id uuid;
  _old_owner_id uuid;
  _email text := lower(trim(_new_owner_email));
begin
  if _actor_id is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(_email, '') = '' then
    raise exception 'new owner email is required';
  end if;

  select owner_id into _old_owner_id
  from public.businesses
  where id = _business_id and owner_id = _actor_id
  for update;

  if _old_owner_id is null then
    raise exception 'shop not found or you no longer own it';
  end if;

  select id into _new_owner_id
  from auth.users
  where lower(email) = _email;

  if _new_owner_id is null then
    raise exception 'the new owner must create a Loyalty Loop account first';
  end if;

  if _new_owner_id = _actor_id then
    raise exception 'choose a different owner';
  end if;

  update public.businesses set owner_id = _new_owner_id where id = _business_id;
  insert into public.user_roles (user_id, role)
  values (_new_owner_id, 'business_owner')
  on conflict (user_id, role) do nothing;

  -- Uploaded shop assets remain with the shop, rather than preventing the
  -- previous owner from deleting their account because Storage still names
  -- them as the object owner.
  update storage.objects
  set owner = _new_owner_id, owner_id = _new_owner_id::text
  where (bucket_id in ('logos', 'covers', 'gallery') and name like _business_id::text || '/%')
     or (bucket_id = 'owner_verification_docs' and name like _business_id::text || '/%');

  update public.staff_members
  set invited_by = _new_owner_id
  where business_id = _business_id and invited_by = _actor_id;

  insert into public.platform_audit_log (actor_id, action, target_type, target_id, detail)
  values (
    _actor_id,
    'business_ownership_transferred_by_owner',
    'business',
    _business_id::text,
    jsonb_build_object('from_owner_id', _actor_id, 'to_owner_id', _new_owner_id, 'to_owner_email', _email)
  );

  insert into public.notifications (user_id, business_id, kind, title, body, link)
  values (
    _new_owner_id,
    _business_id,
    'system',
    'You now own a shop',
    'Shop ownership was transferred to your account.',
    '/owner'
  );
end;
$$;

revoke all on function public.transfer_owned_business_ownership(uuid, text) from public, anon;
grant execute on function public.transfer_owned_business_ownership(uuid, text) to authenticated;

-- This function deliberately only reports whether deletion may proceed. The
-- actual deletion is performed by the authenticated Edge Function so Storage
-- objects can be removed via the Storage API before Auth is deleted.
create or replace function public.can_delete_current_account()
returns table (can_delete boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.businesses where owner_id = auth.uid()) then
    return query select false, 'Transfer or permanently delete every shop before deleting this account.';
    return;
  end if;

  if exists (select 1 from public.brands where created_by = auth.uid()) then
    return query select false, 'Transfer or close your brand before deleting this account.';
    return;
  end if;

  return query select true, null::text;
end;
$$;

revoke all on function public.can_delete_current_account() from public, anon;
grant execute on function public.can_delete_current_account() to authenticated;
