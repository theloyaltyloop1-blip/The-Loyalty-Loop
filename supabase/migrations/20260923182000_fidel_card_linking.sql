-- Card linking database stage (CARD_LINKING_PLAN.md CL-2, §3.3, §3.6 and §4).
-- Additive only. The four applied Fidel migrations are not edited.
-- Nothing here changes behaviour until a shop's Fidel Location is marked
-- 'active' and a customer has an active linked card.

-- A per-user secret passed to Fidel as card metadata.id. The server lists the
-- cards enrolled under it to prove a card belongs to the signed-in user.
create table public.fidel_link_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  metadata_id text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  constraint fidel_link_identities_metadata_id_key unique (metadata_id),
  constraint fidel_link_identities_metadata_id_check
    check (metadata_id ~ '^[0-9a-f]{32}$')
);

alter table public.fidel_link_identities enable row level security;
revoke all on table public.fidel_link_identities from public, anon, authenticated;

-- Fidel may return the same card.id after an unlink and re-link, so only
-- active rows must be unique. Unlinked rows stay for the purchase audit trail.
alter table public.linked_cards
  drop constraint linked_cards_fidel_card_id_key;

create unique index linked_cards_active_fidel_card_id_key
  on public.linked_cards (fidel_card_id)
  where unlinked_at is null;

alter table public.linked_cards
  add column fidel_deleted_at timestamptz,
  add column fidel_delete_error text,
  add column unlink_reason text,
  add constraint linked_cards_unlink_reason_check
    check (unlink_reason is null
      or unlink_reason in ('user', 'account_deleted', 'admin', 'cap_exceeded')),
  add constraint linked_cards_unlink_state_check
    check ((unlinked_at is null) = (unlink_reason is null)),
  add constraint linked_cards_fidel_deleted_requires_unlink_check
    check (fidel_deleted_at is null or unlinked_at is not null);

create index linked_cards_pending_fidel_delete_idx
  on public.linked_cards (unlinked_at)
  where unlinked_at is not null and fidel_deleted_at is null;

-- Fidel Location status. Only an 'active' Location earns automatically, so
-- only those shops get the badge and the linked-customer manual-entry rule.
alter table public.business_fidel_locations
  add column fidel_status text,
  add column fidel_status_checked_at timestamptz,
  add constraint business_fidel_locations_fidel_status_check
    check (fidel_status is null
      or fidel_status in ('idle', 'syncing', 'active', 'not_found'));

-- Staff-confirmed payment method and the inserter, for manual entries.
alter table public.transactions
  add column manual_payment_method text,
  add column recorded_by uuid references auth.users(id) on delete set null,
  add constraint transactions_manual_payment_method_check
    check (manual_payment_method is null
      or manual_payment_method in ('cash', 'unlinked_card'));

create index transactions_manual_entries_idx
  on public.transactions (user_id, business_id, created_at desc)
  where manual_payment_method is not null;

-- Start of the Europe/London calendar day containing _at, correct across
-- BST/GMT changes.
create or replace function public.london_day_start(_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', _at at time zone 'Europe/London') at time zone 'Europe/London'
$$;

create or replace function public.business_has_active_fidel_location(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_fidel_locations l
    where l.business_id = _business_id and l.fidel_status = 'active'
  )
$$;

create or replace function public.user_has_active_linked_card(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.linked_cards c
    where c.user_id = _user_id and c.unlinked_at is null
  )
$$;

-- Returns the caller's metadata id, creating it on first use. Service role only:
-- the fidel-card-session Edge Function passes the verified JWT user id.
create or replace function public.fidel_link_identity(_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _metadata_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'fidel_link_identity requires service role';
  end if;
  if _user_id is null then
    raise exception 'fidel_link_identity requires a user id';
  end if;

  insert into public.fidel_link_identities (user_id, metadata_id)
  values (_user_id, replace(gen_random_uuid()::text, '-', ''))
  on conflict (user_id) do nothing;

  select metadata_id into _metadata_id
  from public.fidel_link_identities
  where user_id = _user_id;
  return _metadata_id;
end;
$$;

-- Stores a card the Edge Function has already verified at Fidel under this
-- user's metadata id. Locking the identity row serializes one user's claims,
-- so the 5-card limit can't be raced. The partial unique index is the
-- cross-user backstop.
create or replace function public.claim_linked_card(
  _user_id uuid,
  _fidel_card_id text,
  _fidel_account_id text,
  _card_scheme text,
  _last_numbers text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _existing public.linked_cards;
  _active_count integer;
  _linked_card_id uuid;
  _card_limit constant integer := 5;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'claim_linked_card requires service role';
  end if;
  if _user_id is null
    or _fidel_card_id is null or length(trim(_fidel_card_id)) = 0
    or length(_fidel_card_id) > 200
    or length(coalesce(_fidel_account_id, '')) > 200
    or (_card_scheme is not null and _card_scheme not in ('visa', 'mastercard', 'amex'))
    or (_last_numbers is not null and _last_numbers !~ '^[0-9]{4}$') then
    raise exception 'invalid verified card arguments';
  end if;

  perform 1 from public.fidel_link_identities
  where user_id = _user_id
  for update;
  if not found then
    return jsonb_build_object('status', 'no_identity');
  end if;

  select * into _existing
  from public.linked_cards
  where fidel_card_id = _fidel_card_id and unlinked_at is null;
  if found then
    if _existing.user_id = _user_id then
      return jsonb_build_object('status', 'already_linked', 'linked_card_id', _existing.id);
    end if;
    return jsonb_build_object('status', 'already_linked_elsewhere');
  end if;

  select count(*) into _active_count
  from public.linked_cards
  where user_id = _user_id and unlinked_at is null;
  if _active_count >= _card_limit then
    return jsonb_build_object('status', 'limit_reached');
  end if;

  begin
    insert into public.linked_cards (
      user_id, fidel_card_id, fidel_account_id, card_scheme, last_numbers
    ) values (
      _user_id, _fidel_card_id, _fidel_account_id, _card_scheme, _last_numbers
    )
    returning id into _linked_card_id;
  exception when unique_violation then
    -- Another user's claim for the same card committed first.
    return jsonb_build_object('status', 'already_linked_elsewhere');
  end;

  return jsonb_build_object('status', 'claimed', 'linked_card_id', _linked_card_id);
end;
$$;

-- Stops earning immediately. The Edge Function then deletes the card at Fidel
-- with the returned id and records the outcome with mark_fidel_card_deleted.
create or replace function public.unlink_linked_card(
  _user_id uuid,
  _linked_card_id uuid,
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _fidel_card_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'unlink_linked_card requires service role';
  end if;
  if _user_id is null or _linked_card_id is null
    or _reason is null or _reason not in ('user', 'account_deleted', 'admin', 'cap_exceeded') then
    raise exception 'invalid unlink arguments';
  end if;

  update public.linked_cards
  set unlinked_at = now(), unlink_reason = _reason
  where id = _linked_card_id and user_id = _user_id and unlinked_at is null
  returning fidel_card_id into _fidel_card_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'unlinked', 'fidel_card_id', _fidel_card_id);
end;
$$;

create or replace function public.mark_fidel_card_deleted(
  _linked_card_id uuid,
  _error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'mark_fidel_card_deleted requires service role';
  end if;

  update public.linked_cards
  set fidel_deleted_at = case when _error is null then now() else null end,
      fidel_delete_error = left(_error, 500)
  where id = _linked_card_id and unlinked_at is not null and fidel_deleted_at is null;
end;
$$;

-- Unlinked cards still to be deleted at Fidel, for the retry sweep. A card
-- that has since been re-linked (same Fidel card id, active row) is skipped:
-- deleting it at Fidel would silently break the new link.
create or replace function public.fidel_cards_pending_delete(_max_rows integer)
returns table (linked_card_id uuid, fidel_card_id text, unlinked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'fidel_cards_pending_delete requires service role';
  end if;

  return query
  select c.id, c.fidel_card_id, c.unlinked_at
  from public.linked_cards c
  where c.unlinked_at is not null
    and c.fidel_deleted_at is null
    and not exists (
      select 1 from public.linked_cards active
      where active.fidel_card_id = c.fidel_card_id and active.unlinked_at is null
    )
  order by c.unlinked_at
  limit greatest(least(coalesce(_max_rows, 50), 500), 1);
end;
$$;

-- Business ids that earn automatically. Exposes nothing about Locations.
create or replace function public.card_linked_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct l.business_id
  from public.business_fidel_locations l
  where l.fidel_status = 'active'
$$;

-- What the retailer app needs before recording a manual entry. Owner, active
-- staff or admin of that business only. Never returns card details.
create or replace function public.customer_card_link_status(
  _customer_id uuid,
  _business_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _day_start timestamptz := public.london_day_start(now());
  _manual_today integer;
  _latest timestamptz;
  _next_allowed timestamptz;
begin
  if _caller is null
    or not (
      exists (
        select 1 from public.businesses b
        where b.id = _business_id and b.owner_id = _caller
      )
      or public.is_active_staff_of(_business_id, _caller)
      or public.has_role(_caller, 'admin')
    ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select count(*) filter (where t.created_at >= _day_start), max(t.created_at)
  into _manual_today, _latest
  from public.transactions t
  where t.user_id = _customer_id
    and t.business_id = _business_id
    and t.manual_payment_method is not null;

  if _manual_today >= 3 then
    _next_allowed := public.london_day_start(_day_start + interval '36 hours');
  elsif _latest is not null and now() < _latest + interval '30 minutes' then
    _next_allowed := _latest + interval '30 minutes';
  end if;

  return jsonb_build_object(
    'linked', public.user_has_active_linked_card(_customer_id)
      and public.business_has_active_fidel_location(_business_id),
    'manualToday', _manual_today,
    'nextAllowedAt', _next_allowed
  );
end;
$$;

-- P5: a card-linked customer at a shop with an active Fidel Location can still
-- get a manual entry, but staff must declare how they paid, and entries are
-- limited to 3 per London day, at least 30 minutes apart. Admins and the
-- service role (the webhook) are exempt. Every other insert is unchanged
-- apart from recording its inserter.
create or replace function public.enforce_linked_customer_manual_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _day_start timestamptz;
  _manual_today integer;
  _latest timestamptz;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  new.recorded_by := _caller;

  if new.type::text not in ('stamp', 'spend') then
    return new;
  end if;
  if _caller is not null and public.has_role(_caller, 'admin') then
    return new;
  end if;
  if not public.user_has_active_linked_card(new.user_id)
    or not public.business_has_active_fidel_location(new.business_id) then
    return new;
  end if;

  if new.manual_payment_method is null then
    raise exception 'linked_customer_payment_method_required';
  end if;

  -- Serialize concurrent entries for this customer at this shop.
  perform pg_advisory_xact_lock(hashtextextended(
    'manual-entry:' || new.user_id::text || ':' || new.business_id::text, 0));

  -- The limits are measured from the server clock, never a client value.
  new.created_at := now();
  _day_start := public.london_day_start(now());

  select count(*) filter (where t.created_at >= _day_start), max(t.created_at)
  into _manual_today, _latest
  from public.transactions t
  where t.user_id = new.user_id
    and t.business_id = new.business_id
    and t.manual_payment_method is not null;

  if _manual_today >= 3 then
    raise exception 'manual_daily_limit_reached'
      using detail = to_char(
        public.london_day_start(_day_start + interval '36 hours'),
        'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;
  if _latest is not null and now() < _latest + interval '30 minutes' then
    raise exception 'manual_too_soon'
      using detail = to_char(_latest + interval '30 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;

  return new;
end;
$$;

create trigger enforce_linked_customer_manual_entry
  before insert on public.transactions
  for each row execute function public.enforce_linked_customer_manual_entry();

-- Privileges. Service-role RPCs: service_role only. Client-facing: authenticated.
revoke execute on function
  public.london_day_start(timestamptz),
  public.business_has_active_fidel_location(uuid),
  public.user_has_active_linked_card(uuid),
  public.fidel_link_identity(uuid),
  public.claim_linked_card(uuid, text, text, text, text),
  public.unlink_linked_card(uuid, uuid, text),
  public.mark_fidel_card_deleted(uuid, text),
  public.fidel_cards_pending_delete(integer),
  public.card_linked_business_ids(),
  public.customer_card_link_status(uuid, uuid),
  public.enforce_linked_customer_manual_entry()
  from public, anon, authenticated;

grant execute on function
  public.fidel_link_identity(uuid),
  public.claim_linked_card(uuid, text, text, text, text),
  public.unlink_linked_card(uuid, uuid, text),
  public.mark_fidel_card_deleted(uuid, text),
  public.fidel_cards_pending_delete(integer)
  to service_role;

grant execute on function
  public.card_linked_business_ids(),
  public.customer_card_link_status(uuid, uuid)
  to authenticated;
