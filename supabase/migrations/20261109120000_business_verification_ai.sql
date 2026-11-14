-- Compulsory business verification with AI document checks.
-- Design: docs/BUSINESS_VERIFICATION_AI_2026-11-09.md
--
-- One switch, business_verification_settings.mode:
--   'shadow' (default): checks run and are recorded, verification stays optional,
--                       new shops go live as before, and admins still decide.
--   'live':             new shops start hidden (approval_status = 'pending') until
--                       verified, and check decisions are applied automatically.
-- Shops created before the switch are never forced to verify.

-- ---------------------------------------------------------------------
-- Settings (single row)
create table if not exists public.business_verification_settings (
  id boolean primary key default true check (id),
  mode text not null default 'shadow' check (mode in ('shadow', 'live')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.business_verification_settings (id) values (true) on conflict (id) do nothing;
alter table public.business_verification_settings enable row level security;
revoke all on public.business_verification_settings from anon, authenticated;
grant select on public.business_verification_settings to authenticated;
drop policy if exists business_verification_settings_read on public.business_verification_settings;
create policy business_verification_settings_read on public.business_verification_settings
  for select to authenticated using (true);

create or replace function public.business_verification_mode()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select mode from public.business_verification_settings where id), 'shadow')
$$;
revoke all on function public.business_verification_mode() from public, anon;
grant execute on function public.business_verification_mode() to authenticated, service_role;

create or replace function public.admin_set_business_verification_mode(_mode text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if _mode not in ('shadow', 'live') then
    raise exception 'mode must be shadow or live';
  end if;
  update public.business_verification_settings
    set mode = _mode, updated_at = now(), updated_by = auth.uid()
    where id;
  insert into public.platform_audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'verification_mode', 'platform', null, jsonb_build_object('mode', _mode));
  return _mode;
end;
$$;
revoke all on function public.admin_set_business_verification_mode(text) from public, anon;
grant execute on function public.admin_set_business_verification_mode(text) to authenticated;

-- ---------------------------------------------------------------------
-- One row per automatic check. Only the service role writes; admins read.
create table if not exists public.business_verification_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null,
  document_path text not null,
  route text not null check (route in ('company', 'vat', 'sole_trader')),
  mode text not null check (mode in ('shadow', 'live')),
  company_number text,
  vat_number text,
  extraction jsonb,
  extraction_alt jsonb,
  register_result jsonb,
  ai_decision jsonb,
  decision text not null check (decision in ('approved', 'rejected', 'needs_review')),
  decided_by text not null check (decided_by in ('rules', 'ai', 'error')),
  reasons text[] not null default '{}',
  owner_message text,
  register_checked boolean not null default false,
  spot_check boolean not null default false,
  listing_approved boolean not null default false,
  applied_at timestamptz,
  spot_checked_at timestamptz,
  spot_checked_by uuid,
  spot_check_ok boolean,
  document_purged_at timestamptz,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists business_verification_checks_business_idx
  on public.business_verification_checks (business_id, created_at desc);
create index if not exists business_verification_checks_spot_idx
  on public.business_verification_checks (created_at)
  where spot_check and spot_checked_at is null;

alter table public.business_verification_checks enable row level security;
revoke all on public.business_verification_checks from anon, authenticated;
grant select on public.business_verification_checks to authenticated;
drop policy if exists business_verification_checks_admin_read on public.business_verification_checks;
create policy business_verification_checks_admin_read on public.business_verification_checks
  for select to authenticated using (public.has_role((select auth.uid()), 'admin'));

-- Numbers that are already verified cannot verify a second owner's shop.
alter table public.business_private add column if not exists verified_company_number text;
alter table public.business_private add column if not exists verified_vat_number text;
create unique index if not exists business_private_verified_company_number_key
  on public.business_private (verified_company_number) where verified_company_number is not null;
create unique index if not exists business_private_verified_vat_number_key
  on public.business_private (verified_vat_number) where verified_vat_number is not null;

-- ---------------------------------------------------------------------
-- The service role (the verify-business function) may change review fields.
-- It is fully trusted already (it bypasses RLS); it was only blocked here by accident.
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

  if _is_admin or coalesce(auth.role(), '') = 'service_role' then
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

-- New shops made by owners start hidden while verification is live.
create or replace function public.enforce_business_insert_defaults()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role(auth.uid(), 'admin') then
    new.verification_status := 'unverified';
    new.verification_submitted_at := null;
    new.verification_reviewed_at := null;
    new.trending := false;
    new.trending_position := null;
    new.approved_at := null;
  end if;
  -- Also covers the security-definer create_shop RPCs, where current_user is the owner role.
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin')
     and public.business_verification_mode() = 'live' then
    new.approval_status := 'pending';
    new.approved_at := null;
    new.verification_status := 'unverified';
    new.verification_submitted_at := null;
    new.verification_reviewed_at := null;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- Apply a recorded check. Service role only. In shadow mode it does nothing.
create or replace function public.apply_business_verification(_check_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.business_verification_checks;
  b public.businesses;
  _listing boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role only' using errcode = '42501';
  end if;

  select * into c from public.business_verification_checks where id = _check_id for update;
  if not found then raise exception 'check not found'; end if;
  if c.applied_at is not null then return 'already_applied'; end if;
  if c.mode <> 'live' then return 'recorded'; end if;
  if c.decision = 'needs_review' then return 'queued'; end if;

  select * into b from public.businesses where id = c.business_id for update;
  if not found then return 'gone'; end if;
  -- An admin decided in the meantime, or the owner sent a newer document.
  if b.verification_status <> 'pending' then return 'stale'; end if;
  if not exists (select 1 from public.business_private p
                 where p.business_id = c.business_id and p.verification_document_path = c.document_path) then
    return 'stale';
  end if;

  if c.decision = 'approved' then
    begin
      insert into public.business_private (business_id, verified_company_number, verified_vat_number,
                                           verification_reviewed_by, verification_rejection_reason)
      values (c.business_id, c.company_number, c.vat_number, null, null)
      on conflict (business_id) do update
        set verified_company_number = excluded.verified_company_number,
            verified_vat_number = excluded.verified_vat_number,
            verification_reviewed_by = null,
            verification_rejection_reason = null;
    exception when unique_violation then
      update public.business_verification_checks
        set decision = 'rejected',
            decided_by = 'rules',
            spot_check = false,
            reasons = array_append(reasons, 'number_already_verified'),
            owner_message = 'This company or VAT number is already verified on another account. Contact support if this is your business.'
        where id = c.id
        returning * into c;
    end;
  end if;

  if c.decision = 'approved' then
    _listing := b.approval_status = 'pending';
    update public.businesses
      set verification_status = 'verified',
          verification_reviewed_at = now(),
          approval_status = case when _listing then 'approved'::business_approval_status else approval_status end,
          approved_at = case when _listing then now() else approved_at end
      where id = c.business_id;
    if _listing and b.google_place_id is not null and b.is_active then
      begin
        perform public.join_requested_shop(b.google_place_id, b.id);
      exception when others then
        null; -- a shop request link failing must not undo the approval
      end;
    end if;
  else
    update public.businesses
      set verification_status = 'rejected', verification_reviewed_at = now()
      where id = c.business_id;
    update public.business_private
      set verification_reviewed_by = null,
          verification_rejection_reason = c.owner_message
      where business_id = c.business_id;
  end if;

  update public.business_verification_checks
    set applied_at = now(), listing_approved = _listing
    where id = c.id;
  return c.decision;
end;
$$;
revoke all on function public.apply_business_verification(uuid) from public, anon, authenticated;
grant execute on function public.apply_business_verification(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Owner: the latest automatic result for their own shop.
create or replace function public.my_business_verification(_business_id uuid)
returns table (decision text, owner_message text, created_at timestamptz, mode text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid()) then
    raise exception 'not your business' using errcode = '42501';
  end if;
  return query
    select c.decision, c.owner_message, c.created_at, public.business_verification_mode()
    from public.business_verification_checks c
    where c.business_id = _business_id
    order by c.created_at desc
    limit 1;
end;
$$;
revoke all on function public.my_business_verification(uuid) from public, anon;
grant execute on function public.my_business_verification(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin: approving a verification also puts a hidden new shop live.
create or replace function public.admin_review_business_verification(_business_id uuid, _approve boolean, _reason text default null)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  _result public.businesses;
  _before public.businesses;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  select * into _before from public.businesses where id = _business_id for update;
  if not found then
    raise exception 'business not found';
  end if;

  update public.businesses
  set verification_status = case when _approve then 'verified' else 'rejected' end,
      verification_reviewed_at = now(),
      approval_status = case when _approve and approval_status = 'pending'
                             then 'approved'::business_approval_status else approval_status end,
      approved_at = case when _approve and approval_status = 'pending' then now() else approved_at end
  where id = _business_id
  returning * into _result;

  insert into public.business_private (business_id, verification_reviewed_by, verification_rejection_reason)
  values (_business_id, auth.uid(), case when _approve then null else _reason end)
  on conflict (business_id) do update
    set verification_reviewed_by = excluded.verification_reviewed_by,
        verification_rejection_reason = excluded.verification_rejection_reason;

  if _approve and _before.approval_status = 'pending' and _before.google_place_id is not null and _before.is_active then
    begin
      perform public.join_requested_shop(_before.google_place_id, _before.id);
    exception when others then
      null;
    end;
  end if;

  return _result;
end;
$$;

-- Admin: recent automatic checks (with the shop name), newest first.
create or replace function public.admin_business_verification_checks(_only_spot_check boolean default false, _limit int default 50)
returns table (
  id uuid, business_id uuid, business_name text, owner_email text, document_path text,
  route text, mode text, decision text, decided_by text, reasons text[], owner_message text,
  extraction jsonb, extraction_alt jsonb, register_result jsonb, ai_decision jsonb,
  register_checked boolean, spot_check boolean, spot_checked_at timestamptz, spot_check_ok boolean,
  applied_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select c.id, c.business_id, b.name, p.email, c.document_path,
           c.route, c.mode, c.decision, c.decided_by, c.reasons, c.owner_message,
           c.extraction, c.extraction_alt, c.register_result, c.ai_decision,
           c.register_checked, c.spot_check, c.spot_checked_at, c.spot_check_ok,
           c.applied_at, c.created_at
    from public.business_verification_checks c
    join public.businesses b on b.id = c.business_id
    left join public.profiles p on p.id = c.owner_id
    where not _only_spot_check
       or (c.spot_check and c.spot_checked_at is null and c.applied_at is not null and c.decision = 'approved')
    order by c.created_at desc
    limit least(greatest(coalesce(_limit, 50), 1), 200);
end;
$$;
revoke all on function public.admin_business_verification_checks(boolean, int) from public, anon;
grant execute on function public.admin_business_verification_checks(boolean, int) to authenticated;

-- Admin: confirm an automatic approval, or undo it.
create or replace function public.admin_spot_check_business_verification(_check_id uuid, _ok boolean, _reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.business_verification_checks;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select * into c from public.business_verification_checks where id = _check_id for update;
  if not found then raise exception 'check not found'; end if;

  update public.business_verification_checks
    set spot_checked_at = now(), spot_checked_by = auth.uid(), spot_check_ok = _ok
    where id = _check_id;

  if not _ok then
    update public.businesses
      set verification_status = 'rejected',
          verification_reviewed_at = now(),
          approval_status = case when c.listing_approved then 'pending'::business_approval_status else approval_status end
      where id = c.business_id;
    update public.business_private
      set verification_reviewed_by = auth.uid(),
          verification_rejection_reason = coalesce(nullif(trim(_reason), ''), 'We could not confirm this business. Please upload a clearer document.'),
          verified_company_number = null,
          verified_vat_number = null
      where business_id = c.business_id;
  end if;

  insert into public.platform_audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'verification_spot_check', 'business', c.business_id::text,
          jsonb_build_object('check_id', _check_id, 'ok', _ok, 'reason', _reason));
  return case when _ok then 'confirmed' else 'revoked' end;
end;
$$;
revoke all on function public.admin_spot_check_business_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_spot_check_business_verification(uuid, boolean, text) to authenticated;
