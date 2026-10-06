-- Owner activation capability: inaccessible to Data API/client roles.
create schema if not exists business_activation_private;
revoke all on schema business_activation_private from public, anon, authenticated;
create table if not exists business_activation_private.capabilities (
  backend integer not null,
  transaction_id bigint not null,
  business_id uuid not null,
  owner_id uuid not null,
  target_active boolean not null,
  primary key (backend, transaction_id, business_id)
);
alter table business_activation_private.capabilities enable row level security;
revoke all on business_activation_private.capabilities from public, anon, authenticated;

create or replace function public.enforce_businesses_update_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _is_admin boolean := public.has_role(auth.uid(), 'admin');
  _is_owner boolean := old.owner_id = auth.uid();
begin
  -- Only a capability minted by the owner RPC can authorize this exact change.
  -- This guard must fire before other BEFORE UPDATE triggers that modify columns
  -- (for example set_updated_at); PostgreSQL runs same-kind triggers by name.
  if _is_owner and new.is_active is distinct from old.is_active
     and (to_jsonb(new) - 'is_active') = (to_jsonb(old) - 'is_active') then
    delete from business_activation_private.capabilities
    where backend = pg_backend_pid() and transaction_id = txid_current()
      and business_id = old.id and owner_id = auth.uid() and target_active = new.is_active;
    if found then return new; end if;
  end if;

  if _is_admin then
    return new;
  end if;

  if new.owner_id != old.owner_id
    or new.approval_status != old.approval_status
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.rejection_reason is distinct from old.rejection_reason
    or new.is_active != old.is_active
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.verification_reviewed_by is distinct from old.verification_reviewed_by
    or new.verification_rejection_reason is distinct from old.verification_rejection_reason
    or new.trending is distinct from old.trending
    or new.trending_position is distinct from old.trending_position
  then
    raise exception 'this field can only be changed by an admin';
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verification_document_path is distinct from old.verification_document_path
     or new.verification_document_label is distinct from old.verification_document_label
     or new.verification_submitted_at is distinct from old.verification_submitted_at
  then
    if not _is_owner then
      raise exception 'only the shop owner can submit verification';
    end if;
    if new.verification_status != 'pending' then
      raise exception 'owners can only submit for review';
    end if;
    if old.verification_status = 'verified' then
      raise exception 'a verified shop cannot resubmit — contact support';
    end if;
    if new.verification_document_path is null then
      raise exception 'a verification document is required';
    end if;
  end if;

  return new;
end;
$function$;


revoke all on function public.enforce_businesses_update_scope() from public, anon, authenticated;

create or replace function public.deactivate_my_business(_business_id uuid)
returns public.businesses
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  shop public.businesses;
begin
  if caller is null or _business_id is null then raise exception 'Only the shop owner can change shop activation.' using errcode = '42501'; end if;
  select * into shop from public.businesses where id = _business_id and owner_id = caller for update;
  if not found then raise exception 'Only the shop owner can change shop activation.' using errcode = '42501'; end if;
  if shop.is_active = false then return shop; end if;
  insert into business_activation_private.capabilities
    values (pg_catalog.pg_backend_pid(), pg_catalog.txid_current(), shop.id, caller, false);
  update public.businesses set is_active = false
    where id = shop.id and owner_id = caller returning * into shop;
  -- Defence against a missing trigger; no capability may survive this call.
  delete from business_activation_private.capabilities
    where backend = pg_catalog.pg_backend_pid() and transaction_id = pg_catalog.txid_current() and business_id = shop.id;
  return shop;
end;
$$;
revoke all on function public.deactivate_my_business(uuid) from public, anon;
grant execute on function public.deactivate_my_business(uuid) to authenticated;

create or replace function public.reactivate_my_business(_business_id uuid)
returns public.businesses
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  shop public.businesses;
begin
  if caller is null or _business_id is null then raise exception 'Only the shop owner can change shop activation.' using errcode = '42501'; end if;
  select * into shop from public.businesses where id = _business_id and owner_id = caller for update;
  if not found then raise exception 'Only the shop owner can change shop activation.' using errcode = '42501'; end if;
  if shop.is_active = true then return shop; end if;
  insert into business_activation_private.capabilities
    values (pg_catalog.pg_backend_pid(), pg_catalog.txid_current(), shop.id, caller, true);
  update public.businesses set is_active = true
    where id = shop.id and owner_id = caller returning * into shop;
  -- Defence against a missing trigger; no capability may survive this call.
  delete from business_activation_private.capabilities
    where backend = pg_catalog.pg_backend_pid() and transaction_id = pg_catalog.txid_current() and business_id = shop.id;
  return shop;
end;
$$;
revoke all on function public.reactivate_my_business(uuid) from public, anon;
grant execute on function public.reactivate_my_business(uuid) to authenticated;
