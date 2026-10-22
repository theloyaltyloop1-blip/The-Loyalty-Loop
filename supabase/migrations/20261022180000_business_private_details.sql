-- Shop rows are publicly readable for approved shops, so owner-only and admin-only
-- details move to a table only the owner and admins can read. Public listing
-- columns (including verification_status for the verified badge) stay put, so
-- installed apps that select * keep working.
create table public.business_private (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  verification_document_path text,
  verification_document_label text,
  verification_rejection_reason text,
  verification_reviewed_by uuid,
  approved_by uuid,
  rejection_reason text
);
alter table public.business_private enable row level security;
revoke all on public.business_private from public, anon, authenticated;
grant select on public.business_private to authenticated;
create policy business_private_select_owner_or_admin on public.business_private
for select to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  or public.has_role((select auth.uid()), 'admin')
);

insert into public.business_private (business_id, verification_document_path, verification_document_label,
  verification_rejection_reason, verification_reviewed_by, approved_by, rejection_reason)
select id, verification_document_path, verification_document_label, verification_rejection_reason,
  verification_reviewed_by, approved_by, rejection_reason
from public.businesses
where coalesce(verification_document_path, verification_document_label, verification_rejection_reason,
  rejection_reason) is not null or verification_reviewed_by is not null or approved_by is not null;

-- Triggers first, so they stop reading the columns before they are dropped.
create or replace function public.enforce_business_insert_defaults()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role(auth.uid(), 'admin') then
    new.verification_status := 'unverified';
    new.verification_submitted_at := null;
    new.verification_reviewed_at := null;
    new.trending := false;
    new.trending_position := null;
    new.approved_at := null;
  end if;
  return new;
end;
$function$;

create or replace function public.enforce_businesses_update_scope()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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
    or new.is_active != old.is_active
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.trending is distinct from old.trending
    or new.trending_position is distinct from old.trending_position
  then
    raise exception 'this field can only be changed by an admin';
  end if;

  if new.verification_status is distinct from old.verification_status
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
    if not exists (select 1 from public.business_private p
                   where p.business_id = old.id and p.verification_document_path is not null) then
      raise exception 'a verification document is required';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.submit_business_verification(_business_id uuid, _doc_path text, _doc_label text)
returns businesses language plpgsql security definer set search_path to 'public' as $function$
declare
  _result public.businesses;
begin
  if not exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid()) then
    raise exception 'not your business';
  end if;
  if _doc_path is null then
    raise exception 'a verification document is required';
  end if;
  -- The document is stored before the status changes; the update-scope trigger checks it.
  insert into public.business_private (business_id, verification_document_path, verification_document_label)
  values (_business_id, _doc_path, _doc_label)
  on conflict (business_id) do update
    set verification_document_path = excluded.verification_document_path,
        verification_document_label = excluded.verification_document_label;

  update public.businesses
  set verification_status = 'pending',
      verification_submitted_at = now()
  where id = _business_id
  returning * into _result;

  return _result;
end;
$function$;

create or replace function public.admin_review_business_verification(_business_id uuid, _approve boolean, _reason text default null::text)
returns businesses language plpgsql security definer set search_path to 'public' as $function$
declare
  _result public.businesses;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  update public.businesses
  set verification_status = case when _approve then 'verified' else 'rejected' end,
      verification_reviewed_at = now()
  where id = _business_id
  returning * into _result;

  if _result.id is null then
    raise exception 'business not found';
  end if;

  insert into public.business_private (business_id, verification_reviewed_by, verification_rejection_reason)
  values (_business_id, auth.uid(), case when _approve then null else _reason end)
  on conflict (business_id) do update
    set verification_reviewed_by = excluded.verification_reviewed_by,
        verification_rejection_reason = excluded.verification_rejection_reason;

  return _result;
end;
$function$;

create or replace function public.admin_set_business_status(_business_id uuid, _status business_approval_status, _reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin if not public.has_role(auth.uid(),'admin') then raise exception 'admin only'; end if;
 update public.businesses set approval_status=_status, approved_at=case when _status='approved' then now() else approved_at end where id=_business_id;
 if found then
  insert into public.business_private (business_id, approved_by, rejection_reason)
  values (_business_id, auth.uid(), case when _status='rejected' then _reason else null end)
  on conflict (business_id) do update set approved_by = excluded.approved_by, rejection_reason = excluded.rejection_reason;
 end if;
 insert into public.platform_audit_log(actor_id,action,target_type,target_id,detail) values(auth.uid(),'listing_status','business',_business_id::text,jsonb_build_object('status',_status,'reason',_reason));
end; $function$;

create or replace function public.admin_pending_business_verifications()
returns table(id uuid, name text, slug text, category text, owner_id uuid, owner_email text, verification_document_path text, verification_document_label text, verification_submitted_at timestamp with time zone)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  return query
    select b.id, b.name, b.slug, b.category, b.owner_id, p.email,
           bp.verification_document_path, bp.verification_document_label, b.verification_submitted_at
    from public.businesses b
    left join public.profiles p on p.id = b.owner_id
    left join public.business_private bp on bp.business_id = b.id
    where b.verification_status = 'pending'
    order by b.verification_submitted_at asc nulls last;
end;
$function$;

alter table public.businesses
  drop column pending_owner_email,
  drop column pending_owner_name,
  drop column verification_document_path,
  drop column verification_document_label,
  drop column verification_rejection_reason,
  drop column verification_reviewed_by,
  drop column approved_by,
  drop column rejection_reason;
