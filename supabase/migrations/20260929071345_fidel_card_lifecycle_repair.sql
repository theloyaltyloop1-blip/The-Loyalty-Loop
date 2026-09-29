-- R1-R4. Additive repair; no applied migration is changed.
alter table public.linked_cards
  add column fidel_delete_state text,
  add column fidel_delete_lease_until timestamptz,
  add column fidel_delete_attempts integer not null default 0;
update public.linked_cards set fidel_delete_state = case
  when fidel_deleted_at is not null then 'deleted'
  when fidel_delete_error is not null then 'failed' else 'pending' end
where unlinked_at is not null;
alter table public.linked_cards
  add constraint linked_cards_delete_state_check check (
    fidel_delete_state in ('pending','in_progress','deleted','failed','superseded')),
  add constraint linked_cards_delete_active_check check (
    (unlinked_at is null) = (fidel_delete_state is null)),
  add constraint linked_cards_delete_done_check check (
    (coalesce(fidel_delete_state = 'deleted', false)) = (fidel_deleted_at is not null)),
  add constraint linked_cards_delete_lease_check check (
    (fidel_delete_lease_until is not null) = coalesce(fidel_delete_state = 'in_progress', false));
alter table public.fidel_link_identities add column deleting_at timestamptz;
create table public.fidel_retired_metadata_ids (
  metadata_id text primary key, retired_at timestamptz not null default now()
);
alter table public.fidel_retired_metadata_ids enable row level security;
revoke all on public.fidel_retired_metadata_ids from public, anon, authenticated;
-- Provider-only orphans have no linked_cards row/user. Keep their transient
-- deletion lease separately so a cross-metadata claim sees the in-flight delete.
create table public.fidel_orphan_delete_leases (
  fidel_card_id text primary key,
  lease_until timestamptz not null,
  attempt integer not null default 1
);
alter table public.fidel_orphan_delete_leases enable row level security;
revoke all on public.fidel_orphan_delete_leases from public, anon, authenticated;
alter table public.fidel_webhook_events add column outcome text;

create or replace function public.fidel_link_identity(_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare _identity public.fidel_link_identities;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  insert into public.fidel_link_identities(user_id, metadata_id)
    values (_user_id, replace(gen_random_uuid()::text, '-', '')) on conflict (user_id) do nothing;
  select * into _identity from public.fidel_link_identities where user_id = _user_id for update;
  if _identity.deleting_at > clock_timestamp() - interval '1 hour'
    or exists (select 1 from public.fidel_retired_metadata_ids where metadata_id = _identity.metadata_id)
    then raise exception 'account_deleting'; end if;
  return _identity.metadata_id;
end $$;

create or replace function public.claim_linked_card_v2(
  _user_id uuid, _fidel_card_id text, _fidel_account_id text,
  _card_scheme text, _last_numbers text, _explicit boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare _identity public.fidel_link_identities; _row public.linked_cards; _id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if _user_id is null or _fidel_card_id is null or length(trim(_fidel_card_id)) = 0
    or length(_fidel_card_id) > 200 or length(coalesce(_fidel_account_id,'')) > 200
    or (_card_scheme is not null and _card_scheme not in ('visa','mastercard','amex'))
    or (_last_numbers is not null and _last_numbers !~ '^[0-9]{4}$')
    then raise exception 'invalid verified card arguments'; end if;
  select * into _identity from public.fidel_link_identities where user_id = _user_id for update;
  if not found then return jsonb_build_object('status','no_identity'); end if;
  if _identity.deleting_at > clock_timestamp() - interval '1 hour'
    or exists (select 1 from public.fidel_retired_metadata_ids where metadata_id = _identity.metadata_id)
    then return jsonb_build_object('status','account_deleting'); end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _fidel_card_id, 0));
  if exists(select 1 from public.fidel_orphan_delete_leases where fidel_card_id=_fidel_card_id
    and lease_until > clock_timestamp()) then return jsonb_build_object('status','removal_in_progress'); end if;
  select * into _row from public.linked_cards where fidel_card_id = _fidel_card_id and unlinked_at is null;
  if found then
    if _row.user_id = _user_id then return jsonb_build_object('status','already_linked','linked_card_id',_row.id); end if;
    return jsonb_build_object('status','already_linked_elsewhere');
  end if;
  -- A DELETE for another user's historical row is equally dangerous to a new enrollment.
  if exists (select 1 from public.linked_cards where fidel_card_id = _fidel_card_id
    and fidel_delete_state = 'in_progress' and fidel_delete_lease_until > clock_timestamp())
    then return jsonb_build_object('status','removal_in_progress'); end if;
  if exists (select 1 from public.linked_cards where fidel_card_id = _fidel_card_id
    and fidel_delete_state in ('pending','failed','in_progress')) then
    if _explicit is not true or exists (select 1 from public.linked_cards
      where fidel_card_id = _fidel_card_id and user_id <> _user_id
      and fidel_delete_state in ('pending','failed','in_progress'))
      then return jsonb_build_object('status','removal_pending'); end if;
    update public.linked_cards set fidel_delete_state = 'superseded', fidel_delete_lease_until = null
      where fidel_card_id = _fidel_card_id and user_id = _user_id
      and fidel_delete_state in ('pending','failed','in_progress');
  end if;
  if (select count(*) from public.linked_cards where user_id = _user_id and unlinked_at is null) >= 5 then
    insert into public.linked_cards(user_id,fidel_card_id,fidel_account_id,card_scheme,last_numbers,
      unlinked_at,unlink_reason,fidel_delete_state)
      values(_user_id,_fidel_card_id,_fidel_account_id,_card_scheme,_last_numbers,
        clock_timestamp(),'cap_exceeded','pending') returning id into _id;
    return jsonb_build_object('status','limit_reached','linked_card_id',_id);
  end if;
  insert into public.linked_cards(user_id,fidel_card_id,fidel_account_id,card_scheme,last_numbers)
    values(_user_id,_fidel_card_id,_fidel_account_id,_card_scheme,_last_numbers) returning id into _id;
  return jsonb_build_object('status','claimed','linked_card_id',_id);
end $$;

-- Old deployed callers cannot distinguish recovery from explicit enrollment.
-- Keep the signature, but choose recovery semantics until they are upgraded.
create or replace function public.claim_linked_card(
  _user_id uuid, _fidel_card_id text, _fidel_account_id text, _card_scheme text, _last_numbers text
) returns jsonb language sql security definer set search_path = '' as $$
  select public.claim_linked_card_v2($1,$2,$3,$4,$5,false)
$$;

create or replace function public.unlink_linked_card(_user_id uuid, _linked_card_id uuid, _reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare _card text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  if _reason is null or _reason not in ('user','account_deleted','admin','cap_exceeded')
    then raise exception 'invalid unlink arguments'; end if;
  perform 1 from public.fidel_link_identities where user_id = _user_id for update;
  select fidel_card_id into _card from public.linked_cards where id = _linked_card_id and user_id = _user_id;
  if not found then return jsonb_build_object('status','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _card,0));
  update public.linked_cards set unlinked_at = clock_timestamp(), unlink_reason = _reason, fidel_delete_state = 'pending'
    where id = _linked_card_id and unlinked_at is null;
  if not found then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','unlinked','fidel_card_id',_card);
end $$;

create or replace function public.begin_fidel_card_delete(_linked_card_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare _row public.linked_cards;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select * into _row from public.linked_cards where id = _linked_card_id;
  if not found then return jsonb_build_object('status','not_acquired'); end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _row.fidel_card_id,0));
  select * into _row from public.linked_cards where id = _linked_card_id;
  if _row.fidel_delete_state not in ('pending','failed','in_progress') or _row.unlinked_at is null
    then return jsonb_build_object('status','not_acquired'); end if;
  if exists (select 1 from public.linked_cards where fidel_card_id = _row.fidel_card_id and unlinked_at is null) then
    update public.linked_cards set fidel_delete_state='superseded', fidel_delete_lease_until=null where id=_linked_card_id;
    return jsonb_build_object('status','not_acquired');
  end if;
  if exists (select 1 from public.linked_cards where fidel_card_id = _row.fidel_card_id
    and fidel_delete_state='in_progress' and fidel_delete_lease_until > clock_timestamp())
    then return jsonb_build_object('status','not_acquired'); end if;
  update public.linked_cards set fidel_delete_state='in_progress',
    fidel_delete_lease_until=clock_timestamp()+interval '5 minutes', fidel_delete_attempts=fidel_delete_attempts+1
    where id=_linked_card_id returning * into _row;
  return jsonb_build_object('status','acquired','fidel_card_id',_row.fidel_card_id,'attempt',_row.fidel_delete_attempts);
end $$;

-- Attempt fences delayed workers after a lease has been reacquired.
create or replace function public.finish_fidel_card_delete(_linked_card_id uuid, _error text, _attempt integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare _card text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select fidel_card_id into _card from public.linked_cards where id=_linked_card_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _card,0));
  update public.linked_cards set fidel_delete_state=case when _error is null then 'deleted' else 'failed' end,
    fidel_deleted_at=case when _error is null then clock_timestamp() else null end,
    fidel_delete_error=left(_error,500), fidel_delete_lease_until=null
    where id=_linked_card_id and fidel_delete_state='in_progress'
    and (_attempt is null or fidel_delete_attempts=_attempt);
  if not found then raise log 'Ignored stale Fidel delete completion'; end if;
end $$;

create or replace function public.mark_fidel_card_deleted(_linked_card_id uuid, _error text)
returns void language plpgsql security definer set search_path = '' as $$
declare _card text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select fidel_card_id into _card from public.linked_cards where id=_linked_card_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _card,0));
  update public.linked_cards set fidel_delete_state=case when _error is null then 'deleted' else 'failed' end,
    fidel_deleted_at=case when _error is null then clock_timestamp() else null end,
    fidel_delete_error=left(_error,500), fidel_delete_lease_until=null
    where id=_linked_card_id and fidel_delete_state in ('pending','failed','in_progress');
end $$;

create or replace function public.fidel_cards_pending_delete(_max_rows integer)
returns table(linked_card_id uuid,fidel_card_id text,unlinked_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  return query select c.id,c.fidel_card_id,c.unlinked_at from public.linked_cards c
    where (c.fidel_delete_state in ('pending','failed') or
      (c.fidel_delete_state='in_progress' and c.fidel_delete_lease_until <= clock_timestamp()))
    and not exists (select 1 from public.linked_cards a where a.fidel_card_id=c.fidel_card_id and a.unlinked_at is null)
    order by c.unlinked_at,c.id limit greatest(least(coalesce(_max_rows,50),500),1);
end $$;

create or replace function public.begin_fidel_account_deletion(_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare _identity public.fidel_link_identities; _card text; _created integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  -- Serialize first-time identity creation as well: insert a tombstone identity
  -- even for an account that never linked. No provider listing is needed then.
  insert into public.fidel_link_identities(user_id,metadata_id)
    values(_user_id,replace(gen_random_uuid()::text,'-','')) on conflict(user_id) do nothing;
  get diagnostics _created = row_count;
  select * into _identity from public.fidel_link_identities where user_id=_user_id for update;
  if _identity.deleting_at > clock_timestamp()-interval '1 hour' then
    return jsonb_build_object('status','account_deleting'); end if;
  update public.fidel_link_identities set deleting_at=clock_timestamp() where user_id=_user_id;
  for _card in select distinct fidel_card_id from public.linked_cards where user_id=_user_id order by fidel_card_id loop
    perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _card,0));
  end loop;
  update public.linked_cards set unlinked_at=clock_timestamp(),unlink_reason='account_deleted',fidel_delete_state='pending'
    where user_id=_user_id and unlinked_at is null;
  return jsonb_build_object('status','begun','provider_lookup',_created=0,'metadata_id',_identity.metadata_id,'rows',coalesce((
    select jsonb_agg(jsonb_build_object('linked_card_id',id) order by fidel_card_id,id) from public.linked_cards
    where user_id=_user_id and fidel_delete_state not in ('deleted','superseded')), '[]'::jsonb));
end $$;

-- Provider-only cards discovered after the initial snapshot also get durable
-- cleanup rows before HTTP. Metadata ownership was checked by the Edge caller.
create or replace function public.prepare_fidel_account_card_delete(_user_id uuid, _fidel_card_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _identity public.fidel_link_identities; _id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select * into _identity from public.fidel_link_identities where user_id=_user_id for update;
  if not found or _identity.deleting_at is null or _identity.deleting_at <= clock_timestamp()-interval '1 hour'
    then raise exception 'account deletion not begun'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _fidel_card_id,0));
  if exists(select 1 from public.fidel_orphan_delete_leases where fidel_card_id=_fidel_card_id
    and lease_until > clock_timestamp()) then raise exception 'orphan deletion in progress'; end if;
  if exists(select 1 from public.linked_cards where fidel_card_id=_fidel_card_id and unlinked_at is null)
    then raise exception 'card still active'; end if;
  select id into _id from public.linked_cards where fidel_card_id=_fidel_card_id
    and fidel_delete_state in ('pending','failed','in_progress') order by linked_at desc,id limit 1;
  if found then return _id; end if;
  insert into public.linked_cards(user_id,fidel_card_id,unlinked_at,unlink_reason,fidel_delete_state)
    values(_user_id,_fidel_card_id,clock_timestamp(),'account_deleted','pending') returning id into _id;
  return _id;
end $$;

create or replace function public.complete_fidel_account_deletion(_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare _identity public.fidel_link_identities;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select * into _identity from public.fidel_link_identities where user_id=_user_id for update;
  if not found or _identity.deleting_at is null or _identity.deleting_at <= clock_timestamp()-interval '1 hour'
    then raise exception 'account deletion not begun'; end if;
  if exists(select 1 from public.linked_cards where user_id=_user_id and
    (fidel_delete_state is null or fidel_delete_state not in ('deleted','superseded'))) then
    raise exception 'card deletion incomplete'; end if;
  insert into public.fidel_retired_metadata_ids(metadata_id) values(_identity.metadata_id) on conflict do nothing;
end $$;

create or replace function public.abort_fidel_account_deletion(_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  perform 1 from public.fidel_link_identities where user_id=_user_id for update;
  update public.fidel_link_identities set deleting_at=null where user_id=_user_id;
end $$;

-- Orphan pass never directly deletes a card with local history. Return rows
-- so the caller uses the same lease protocol, or refuses an active enrollment.
create or replace function public.fidel_orphan_card_action(_metadata_id text, _fidel_card_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare _row public.linked_cards; _id uuid; _attempt integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _fidel_card_id,0));
  if not exists(select 1 from public.fidel_retired_metadata_ids where metadata_id=_metadata_id)
    or exists(select 1 from public.linked_cards where fidel_card_id=_fidel_card_id and unlinked_at is null)
    then return jsonb_build_object('status','keep'); end if;
  if exists(select 1 from public.linked_cards where fidel_card_id=_fidel_card_id) then
    -- A retired enrollment may reappear after confirmed deletion. Give this
    -- deletion its own row instead of erasing the old confirmed outcome.
    if not exists(select 1 from public.linked_cards where fidel_card_id=_fidel_card_id
      and fidel_delete_state in ('pending','failed','in_progress')) then
      select * into _row from public.linked_cards where fidel_card_id=_fidel_card_id order by linked_at desc,id limit 1;
      insert into public.linked_cards(user_id,fidel_card_id,unlinked_at,unlink_reason,fidel_delete_state)
        values(_row.user_id,_fidel_card_id,clock_timestamp(),'account_deleted','pending') returning id into _id;
    end if;
    return jsonb_build_object('status','local','rows',coalesce((select jsonb_agg(id)
      from public.linked_cards where fidel_card_id=_fidel_card_id and fidel_delete_state in ('pending','failed','in_progress')),'[]'::jsonb));
  end if;
  if exists(select 1 from public.fidel_orphan_delete_leases where fidel_card_id=_fidel_card_id
    and lease_until > clock_timestamp()) then return jsonb_build_object('status','keep'); end if;
  insert into public.fidel_orphan_delete_leases(fidel_card_id,lease_until)
    values(_fidel_card_id,clock_timestamp()+interval '5 minutes')
    on conflict(fidel_card_id) do update set lease_until=excluded.lease_until,
      attempt=public.fidel_orphan_delete_leases.attempt+1 returning attempt into _attempt;
  return jsonb_build_object('status','orphan','attempt',_attempt);
end $$;

create or replace function public.finish_fidel_orphan_delete(_fidel_card_id text, _attempt integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fidel-card:' || _fidel_card_id,0));
  update public.fidel_orphan_delete_leases set lease_until=clock_timestamp()
    where fidel_card_id=_fidel_card_id and attempt=_attempt;
end $$;

create or replace function public.fidel_location_accepts_new_awards(_location_row public.business_fidel_locations)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((_location_row).fidel_status = 'active',false)
$$;

revoke execute on function
  public.claim_linked_card_v2(uuid,text,text,text,text,boolean),
  public.begin_fidel_card_delete(uuid), public.finish_fidel_card_delete(uuid,text,integer),
  public.begin_fidel_account_deletion(uuid),public.complete_fidel_account_deletion(uuid),public.abort_fidel_account_deletion(uuid),
  public.prepare_fidel_account_card_delete(uuid,text),
  public.finish_fidel_orphan_delete(text,integer),
  public.fidel_orphan_card_action(text,text), public.fidel_location_accepts_new_awards(public.business_fidel_locations)
from public,anon,authenticated;
grant execute on function
  public.claim_linked_card_v2(uuid,text,text,text,text,boolean),
  public.begin_fidel_card_delete(uuid), public.finish_fidel_card_delete(uuid,text,integer),
  public.begin_fidel_account_deletion(uuid),public.complete_fidel_account_deletion(uuid),public.abort_fidel_account_deletion(uuid),
  public.prepare_fidel_account_card_delete(uuid,text),
  public.finish_fidel_orphan_delete(text,integer),
  public.fidel_orphan_card_action(text,text), public.fidel_location_accepts_new_awards(public.business_fidel_locations)
to service_role;

create or replace function public.process_fidel_webhook_event(
  _fidel_message_id text,
  _event_type text,
  _fidel_transaction_id text,
  _program_id text,
  _fidel_card_id text,
  _fidel_location_id text,
  _original_transaction_id text,
  _amount_pence integer,
  _auth boolean,
  _cleared boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _event_id uuid;
  _business_location public.business_fidel_locations;
  _linked_card public.linked_cards;
  _membership public.memberships;
  _purchase public.fidel_transactions;
  _refund_amount bigint;
  _new_total_refunded bigint;
  _new_progress_credited bigint;
  _delta bigint;
  _reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'process_fidel_webhook_event requires service role';
  end if;

  if _event_type not in ('transaction.auth', 'transaction.clearing', 'transaction.refund')
    or _fidel_message_id is null or length(trim(_fidel_message_id)) = 0
    or _fidel_transaction_id is null or length(trim(_fidel_transaction_id)) = 0
    or _program_id is null or length(trim(_program_id)) = 0
    or _fidel_card_id is null or length(trim(_fidel_card_id)) = 0
    or _fidel_location_id is null or length(trim(_fidel_location_id)) = 0 then
    raise exception 'invalid validated Fidel transaction arguments';
  end if;

  -- The ledger insert and all later actions are in this single transaction.
  begin
    insert into public.fidel_webhook_events (
      fidel_message_id, fidel_transaction_id, event_type
    ) values (
      _fidel_message_id, _fidel_transaction_id, _event_type
    ) returning id into _event_id;
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicate');
  end;

  -- Exact-zero verification authorizations and clearings are valid provider
  -- events. Keep their idempotency record, then acknowledge them as no-ops.
  if _amount_pence = 0
    and _event_type in ('transaction.auth', 'transaction.clearing') then
    update public.fidel_webhook_events set outcome = 'ignored_zero_amount' where id = _event_id;
    return jsonb_build_object('status', 'ignored_zero_amount');
  end if;

  select * into _business_location
  from public.business_fidel_locations
  where fidel_location_id = _fidel_location_id
    and fidel_program_id = _program_id;
  if not found then
    raise warning 'Fidel webhook unknown merchant location: %', _fidel_location_id;
    update public.fidel_webhook_events set outcome = 'unknown_merchant' where id = _event_id;
    return jsonb_build_object('status', 'unknown_merchant');
  end if;

  if _event_type = 'transaction.auth' then
    if not public.fidel_location_accepts_new_awards(_business_location) then
      update public.fidel_webhook_events set outcome = 'ineligible_location' where id = _event_id;
    return jsonb_build_object('status','ineligible_location');
    end if;
    select * into _linked_card from public.linked_cards
      where fidel_card_id = _fidel_card_id and unlinked_at is null for share;
    if not found then update public.fidel_webhook_events set outcome = 'unknown_card' where id = _event_id;
    return jsonb_build_object('status','unknown_card'); end if;
    select * into _membership from public.memberships
      where user_id = _linked_card.user_id and business_id = _business_location.business_id for update;
    if not found then update public.fidel_webhook_events set outcome = 'unknown_membership' where id = _event_id;
    return jsonb_build_object('status','unknown_membership'); end if;

    if _amount_pence < 0 or _auth is not true then
      raise exception 'invalid authorization event';
    end if;

    insert into public.fidel_transactions (
      fidel_transaction_id, business_id, linked_card_id, user_id,
      original_amount_pence, progress_credited_pence, status
    ) values (
      _fidel_transaction_id, _business_location.business_id, _linked_card.id,
      _linked_card.user_id, _amount_pence, _amount_pence, 'authorized'
    );

    insert into public.transactions (
      user_id, business_id, membership_id, type, value, note
    ) values (
      _linked_card.user_id, _business_location.business_id, _membership.id,
      'spend', _amount_pence, 'fidel:auth:' || _fidel_transaction_id
    );

    update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
  end if;

  if _event_type = 'transaction.clearing' then
    -- Fidel emits a negative auth=false clearing as part of a refund. It is
    -- ledgered for idempotency but never changes purchase state or progress.
    if _amount_pence < 0 or _auth is false then
      update public.fidel_webhook_events set outcome = 'ignored_negative_clearing' where id = _event_id;
    return jsonb_build_object('status', 'ignored_negative_clearing');
    end if;
    if _amount_pence < 0 or _cleared is not true then
      raise exception 'invalid positive clearing event';
    end if;

    update public.fidel_transactions
    set status = 'cleared'
    where fidel_transaction_id = _fidel_transaction_id
      and business_id = _business_location.business_id
      and exists (select 1 from public.linked_cards c
        where c.id = fidel_transactions.linked_card_id and c.fidel_card_id = _fidel_card_id
          and c.user_id = fidel_transactions.user_id);
    if not found then
      raise warning 'Fidel clearing did not resolve to an authorization: %', _fidel_transaction_id;
      update public.fidel_webhook_events set outcome = 'unresolved_clearing' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_clearing');
    end if;
    update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
  end if;

  -- transaction.refund: do not infer a purchase when the provider correlation
  -- is absent or has a shape contradicted by a future signed sandbox delivery.
  if _amount_pence >= 0 or _auth is not false then
    raise exception 'invalid refund event';
  end if;
  if _original_transaction_id is null or length(trim(_original_transaction_id)) = 0 then
    raise warning 'Fidel refund had no original transaction id';
    update public.fidel_webhook_events set outcome = 'unresolved_refund' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  select * into _purchase
  from public.fidel_transactions
  where fidel_transaction_id = _original_transaction_id
    and business_id = _business_location.business_id
    and exists (select 1 from public.linked_cards c
      where c.id = fidel_transactions.linked_card_id and c.fidel_card_id = _fidel_card_id
        and c.user_id = fidel_transactions.user_id)
  for update;
  if not found then
    raise warning 'Fidel refund did not resolve to a known purchase';
    update public.fidel_webhook_events set outcome = 'unresolved_refund' where id = _event_id;
    return jsonb_build_object('status', 'unresolved_refund');
  end if;

  select * into _membership from public.memberships
    where user_id = _purchase.user_id and business_id = _purchase.business_id for update;
  if not found then update public.fidel_webhook_events set outcome = 'refund_membership_missing' where id = _event_id;
    return jsonb_build_object('status','refund_membership_missing'); end if;

  _refund_amount := -_amount_pence::bigint;
  _new_total_refunded := _purchase.total_refunded_pence::bigint + _refund_amount;
  if _new_total_refunded > _purchase.original_amount_pence then
    raise warning 'Fidel refund exceeds original authorization amount';
    update public.fidel_webhook_events set outcome = 'invalid_refund' where id = _event_id;
    return jsonb_build_object('status', 'invalid_refund');
  end if;
  _new_progress_credited := _purchase.original_amount_pence::bigint - _new_total_refunded;
  _delta := _new_progress_credited - _purchase.progress_credited_pence::bigint;
  if _delta > 0 then
    raise warning 'Fidel refund would increase reward progress';
    update public.fidel_webhook_events set outcome = 'invalid_refund' where id = _event_id;
    return jsonb_build_object('status', 'invalid_refund');
  end if;

  if _delta < 0 then
    _reason := 'A refund reduced your reward progress. Spend more to redeem again.';
    perform public.apply_spend_clawback(_membership.id, _delta::integer, _reason);
  end if;

  update public.fidel_transactions
  set total_refunded_pence = _new_total_refunded::integer,
      progress_credited_pence = _new_progress_credited::integer,
      status = case
        when _new_total_refunded = _purchase.original_amount_pence then 'refunded'
        else 'partially_refunded'
      end
  where id = _purchase.id;

  update public.fidel_webhook_events set outcome = 'processed' where id = _event_id;
    return jsonb_build_object('status', 'processed');
end;
$$;

revoke execute on function public.process_fidel_webhook_event(
  text, text, text, text, text, text, text, integer, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.process_fidel_webhook_event(
  text, text, text, text, text, text, text, integer, boolean, boolean
) to service_role;

