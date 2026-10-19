-- SumUp till link: sales from the shop's card reader are attached to the
-- customer the staff just scanned, and credited through the existing spend
-- path (transactions type = 'spend', so tiers, rewards and notifications all
-- work unchanged). Additive only. NOT applied to any database yet.
--
-- SumUp does not say who paid, so a sale is only auto-attached when exactly one
-- customer scanned around that time and that customer has exactly one such
-- sale (see supabase/functions/_shared/pos-matcher.ts). Anything less certain
-- goes to the owner as "Which sale was this?".

-- ---------------------------------------------------------------------
-- Connections. Tokens live here and ONLY here: RLS on, no policies, no
-- grants, so only the service role (edge functions) can ever read them.
create table public.pos_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('sumup')),
  merchant_code text not null check (length(trim(merchant_code)) > 0),
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scope text,
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_synced_at timestamptz,
  sync_cursor timestamptz,
  last_error text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_connections_business_provider_key unique (business_id, provider)
);

alter table public.pos_connections enable row level security;
revoke all on public.pos_connections from public, anon, authenticated;

create trigger set_updated_at
  before update on public.pos_connections
  for each row execute function public.update_updated_at_column();

-- One-time OAuth state, bound to the owner and business that started it.
create table public.pos_oauth_states (
  state uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('sumup')),
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);

alter table public.pos_oauth_states enable row level security;
revoke all on public.pos_oauth_states from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- A customer was scanned at the counter.
create table public.pos_scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  scanned_by uuid references auth.users(id) on delete set null,
  scanned_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'matched', 'expired')),
  created_at timestamptz not null default now()
);

create index pos_scans_pending_idx
  on public.pos_scans (business_id, scanned_at) where status = 'pending';

alter table public.pos_scans enable row level security;
revoke all on public.pos_scans from public, anon, authenticated;

-- A sale reported by the till. Only what we need: no card digits, no payload.
create table public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('sumup')),
  provider_txn_id text not null check (length(trim(provider_txn_id)) > 0),
  amount_pence integer not null check (amount_pence >= 0),
  currency text not null,
  occurred_at timestamptz not null,
  provider_status text not null,
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  -- open: waiting for a scan; matched: credited; review: owner must choose;
  -- no_scan: nobody scanned, nothing to credit; ignored: owner dismissed it,
  -- or it can't be credited (not £, not successful).
  state text not null default 'open'
    check (state in ('open', 'matched', 'review', 'no_scan', 'ignored')),
  scan_id uuid references public.pos_scans(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_sales_provider_txn_key unique (provider, provider_txn_id),
  constraint pos_sales_refund_not_exceed check (refunded_pence <= amount_pence)
);

create index pos_sales_business_state_idx on public.pos_sales (business_id, state, occurred_at);

alter table public.pos_sales enable row level security;
revoke all on public.pos_sales from public, anon, authenticated;

create trigger set_updated_at
  before update on public.pos_sales
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Client: connection status for the owner (never returns tokens).
create or replace function public.pos_connection_status(_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _row public.pos_connections;
begin
  if not exists (select 1 from public.businesses b where b.id = _business_id and b.owner_id = auth.uid())
    and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into _row from public.pos_connections
  where business_id = _business_id and provider = 'sumup';
  if not found then
    return jsonb_build_object('connected', false);
  end if;
  return jsonb_build_object(
    'connected', true, 'provider', _row.provider, 'status', _row.status,
    'lastSyncedAt', _row.last_synced_at, 'lastError', _row.last_error);
end;
$$;

-- Staff: used by the scan screen to know whether to wait for the till instead
-- of asking for an amount. Staff may call it for their own shop.
create or replace function public.pos_is_connected(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_record_manual_spend(_business_id, auth.uid())
    and exists (
      select 1 from public.pos_connections c
      where c.business_id = _business_id and c.status = 'active'
    )
$$;

-- Client: a customer was just scanned. Duplicate scans of the same customer
-- within two minutes collapse into one.
create or replace function public.record_pos_scan(_business_id uuid, _customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _id uuid;
begin
  if _business_id is null or _customer_id is null then
    raise exception 'invalid_arguments';
  end if;
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pos_connections c
    where c.business_id = _business_id and c.status = 'active'
  ) then
    return jsonb_build_object('status', 'not_connected');
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = _customer_id and m.business_id = _business_id
  ) then
    raise exception 'not_a_member';
  end if;

  select id into _id from public.pos_scans
  where business_id = _business_id and customer_id = _customer_id
    and status = 'pending' and scanned_at > now() - interval '2 minutes'
  order by scanned_at desc limit 1;
  if found then
    return jsonb_build_object('status', 'duplicate', 'scanId', _id);
  end if;

  insert into public.pos_scans (business_id, customer_id, scanned_by)
  values (_business_id, _customer_id, _caller)
  returning id into _id;
  return jsonb_build_object('status', 'recorded', 'scanId', _id);
end;
$$;

-- Client: staff chose to enter the amount by hand (e.g. a cash sale), so the
-- waiting scan must not later attach itself to someone else's card sale.
create or replace function public.pos_cancel_scan(_business_id uuid, _customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_record_manual_spend(_business_id, auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.pos_scans set status = 'expired'
  where business_id = _business_id and customer_id = _customer_id and status = 'pending';
end;
$$;

-- Client: sales the matcher could not settle, with the customers who might
-- have paid. Names only: no contact details.
create or replace function public.pos_pending_review(_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_record_manual_spend(_business_id, auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'saleId', s.id,
      'amountPence', s.amount_pence,
      'occurredAt', s.occurred_at,
      'candidates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'scanId', sc.id,
          'customerId', sc.customer_id,
          'name', coalesce(nullif(trim(concat_ws(' ', p.first_name, nullif(left(p.last_name, 1), '') || '.')), ''), 'Customer'),
          'scannedAt', sc.scanned_at
        ) order by sc.scanned_at)
        from public.pos_scans sc
        left join public.profiles p on p.id = sc.customer_id
        where sc.business_id = s.business_id
          and sc.status = 'pending'
          and sc.scanned_at between s.occurred_at - interval '15 minutes'
                                and s.occurred_at + interval '15 minutes'
      ), '[]'::jsonb)
    ) order by s.occurred_at desc)
    from public.pos_sales s
    where s.business_id = _business_id and s.state = 'review'
      and s.occurred_at > now() - interval '7 days'
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Service role: credit a sale to a scan. All-or-nothing and safe to repeat.
create or replace function public.pos_credit_sale(_sale_id uuid, _scan_id uuid, _resolved_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sale public.pos_sales;
  _scan public.pos_scans;
  _membership_id uuid;
  _tx_id uuid;
  _net integer;
begin
  select * into _sale from public.pos_sales where id = _sale_id for update;
  if not found then raise exception 'sale_not_found'; end if;
  if _sale.state = 'matched' then
    return jsonb_build_object('status', 'already_matched', 'transactionId', _sale.transaction_id);
  end if;
  if _sale.state in ('ignored', 'no_scan') or _sale.provider_status <> 'SUCCESSFUL'
    or _sale.currency <> 'GBP' then
    raise exception 'sale_not_creditable';
  end if;

  select * into _scan from public.pos_scans where id = _scan_id for update;
  if not found or _scan.business_id <> _sale.business_id or _scan.status <> 'pending' then
    raise exception 'scan_not_available';
  end if;

  select id into _membership_id from public.memberships
  where user_id = _scan.customer_id and business_id = _sale.business_id;
  if not found then raise exception 'not_a_member'; end if;

  _net := _sale.amount_pence - _sale.refunded_pence;
  if _net > 0 then
    insert into public.transactions (user_id, business_id, membership_id, type, value, client_ref)
    values (_scan.customer_id, _sale.business_id, _membership_id, 'spend', _net, _sale.id)
    returning id into _tx_id;
  end if;

  update public.pos_scans set status = 'matched' where id = _scan_id;
  update public.pos_sales
  set state = 'matched', scan_id = _scan_id, customer_id = _scan.customer_id,
      transaction_id = _tx_id
  where id = _sale_id;

  return jsonb_build_object('status', 'credited', 'transactionId', _tx_id, 'amountPence', _net);
end;
$$;

-- Service role: the till reports a (bigger) refund on a sale we already
-- credited. Void what we credited, then credit the remainder if any.
create or replace function public.pos_apply_refund(_sale_id uuid, _refunded_pence integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sale public.pos_sales;
  _net integer;
  _tx_id uuid;
  _membership_id uuid;
begin
  select * into _sale from public.pos_sales where id = _sale_id for update;
  if not found then raise exception 'sale_not_found'; end if;
  if _refunded_pence is null or _refunded_pence < 0 or _refunded_pence > _sale.amount_pence then
    raise exception 'invalid_arguments';
  end if;
  if _refunded_pence <= _sale.refunded_pence then
    return jsonb_build_object('status', 'unchanged');
  end if;

  if _sale.state = 'matched' then
    if _sale.transaction_id is not null then
      update public.transactions
      set voided_at = now(), void_reason = 'Refunded at the till'
      where id = _sale.transaction_id and voided_at is null;
    end if;
    _net := _sale.amount_pence - _refunded_pence;
    _tx_id := null;
    if _net > 0 then
      select id into _membership_id from public.memberships
      where user_id = _sale.customer_id and business_id = _sale.business_id;
      if found then
        insert into public.transactions (user_id, business_id, membership_id, type, value, client_ref)
        values (_sale.customer_id, _sale.business_id, _membership_id, 'spend', _net,
                md5(_sale.id::text || ':net:' || _refunded_pence::text)::uuid)
        returning id into _tx_id;
      end if;
    end if;
    update public.pos_sales set refunded_pence = _refunded_pence, transaction_id = _tx_id
    where id = _sale_id;
  else
    update public.pos_sales set refunded_pence = _refunded_pence where id = _sale_id;
  end if;
  return jsonb_build_object('status', 'refunded');
end;
$$;

-- Client: the owner or staff settle a sale the matcher could not. A null scan
-- means "nobody I know paid for this", which dismisses the sale.
create or replace function public.pos_resolve_sale(_sale_id uuid, _scan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _sale public.pos_sales;
begin
  select * into _sale from public.pos_sales where id = _sale_id for update;
  if not found or not public.can_record_manual_spend(_sale.business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _sale.state <> 'review' then
    raise exception 'sale_not_in_review';
  end if;
  if _scan_id is null then
    update public.pos_sales set state = 'ignored' where id = _sale_id;
    return jsonb_build_object('status', 'ignored');
  end if;
  -- Only a customer who was actually scanned around the time of the sale.
  if not exists (
    select 1 from public.pos_scans sc
    where sc.id = _scan_id and sc.business_id = _sale.business_id
      and sc.scanned_at between _sale.occurred_at - interval '15 minutes'
                            and _sale.occurred_at + interval '15 minutes'
  ) then
    raise exception 'scan_not_near_sale';
  end if;
  return public.pos_credit_sale(_sale_id, _scan_id, _caller);
end;
$$;

-- Client: the last till sales that were credited, so a mistake can be undone.
create or replace function public.pos_recent_matched(_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_record_manual_spend(_business_id, auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'saleId', r.id, 'amountPence', r.amount_pence - r.refunded_pence,
      'occurredAt', r.occurred_at,
      'name', coalesce(nullif(trim(concat_ws(' ', p.first_name, nullif(left(p.last_name, 1), '') || '.')), ''), 'Customer')
    ) order by r.occurred_at desc)
    from (
      select s.* from public.pos_sales s
      where s.business_id = _business_id and s.state = 'matched' and s.transaction_id is not null
        and s.occurred_at > now() - interval '7 days'
      order by s.occurred_at desc limit 20
    ) r
    left join public.profiles p on p.id = r.customer_id
  ), '[]'::jsonb);
end;
$$;

-- Client: owner (or admin) undoes a credit that went to the wrong customer.
-- The sale is voided and dismissed; the right customer can then be given the
-- amount through the normal manual entry. Within 7 days, like manual undo.
create or replace function public.pos_undo_sale(_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _sale public.pos_sales;
begin
  select * into _sale from public.pos_sales where id = _sale_id for update;
  if not found or not (
    exists (select 1 from public.businesses b where b.id = _sale.business_id and b.owner_id = _caller)
    or public.has_role(_caller, 'admin')
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _sale.state <> 'matched' or _sale.transaction_id is null then
    raise exception 'sale_not_undoable';
  end if;
  if now() > _sale.occurred_at + interval '7 days' then
    raise exception 'too_late';
  end if;

  update public.transactions
  set voided_at = now(), voided_by = _caller, void_reason = 'Sale attached to the wrong customer'
  where id = _sale.transaction_id and voided_at is null;
  update public.pos_sales set state = 'ignored', transaction_id = null where id = _sale_id;
  return jsonb_build_object('status', 'undone', 'amountPence', _sale.amount_pence - _sale.refunded_pence);
end;
$$;

-- Privileges. Service-role functions: service_role only.
revoke execute on function
  public.pos_connection_status(uuid),
  public.pos_is_connected(uuid),
  public.record_pos_scan(uuid, uuid),
  public.pos_pending_review(uuid),
  public.pos_cancel_scan(uuid, uuid),
  public.pos_recent_matched(uuid),
  public.pos_undo_sale(uuid),
  public.pos_credit_sale(uuid, uuid, uuid),
  public.pos_apply_refund(uuid, integer),
  public.pos_resolve_sale(uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.pos_connection_status(uuid),
  public.pos_is_connected(uuid),
  public.record_pos_scan(uuid, uuid),
  public.pos_pending_review(uuid),
  public.pos_cancel_scan(uuid, uuid),
  public.pos_recent_matched(uuid),
  public.pos_undo_sale(uuid),
  public.pos_resolve_sale(uuid, uuid)
  to authenticated;

grant execute on function
  public.pos_credit_sale(uuid, uuid, uuid),
  public.pos_apply_refund(uuid, integer)
  to service_role;
