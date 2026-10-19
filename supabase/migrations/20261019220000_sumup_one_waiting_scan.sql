-- One customer at a time. While a customer is waiting to pay, a second scan at
-- the same shop is refused ("busy") until the first is paid, cancelled or
-- older than the matching window. With a single waiting scan, two customers can
-- never compete for one sale. Walk-ins and two-sales-one-scan are still held for
-- the owner by the matcher.

-- Test data from the first ambiguity test: nothing waits across this change.
update public.pos_scans set status = 'expired' where status = 'pending';

create unique index pos_scans_one_pending_per_shop
  on public.pos_scans (business_id) where status = 'pending';

create or replace function public.record_pos_scan(_business_id uuid, _customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _id uuid;
  _other record;
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

  -- A scan older than the matching window can no longer match any new sale.
  update public.pos_scans set status = 'expired'
  where business_id = _business_id and status = 'pending'
    and scanned_at < now() - interval '10 minutes';

  select sc.id, sc.customer_id, sc.scanned_at into _other
  from public.pos_scans sc
  where sc.business_id = _business_id and sc.status = 'pending'
  order by sc.scanned_at desc limit 1;

  if found then
    if _other.customer_id = _customer_id then
      -- The same customer scanned again: keep one scan, refresh its time.
      update public.pos_scans set scanned_at = now() where id = _other.id;
      return jsonb_build_object('status', 'refreshed', 'scanId', _other.id);
    end if;
    return jsonb_build_object(
      'status', 'busy', 'scanId', _other.id, 'customerId', _other.customer_id,
      'scannedAt', _other.scanned_at,
      'name', coalesce((
        select nullif(trim(concat_ws(' ', p.first_name, nullif(left(p.last_name, 1), '') || '.')), '')
        from public.profiles p where p.id = _other.customer_id
      ), 'Customer'));
  end if;

  begin
    insert into public.pos_scans (business_id, customer_id, scanned_by)
    values (_business_id, _customer_id, _caller)
    returning id into _id;
  exception when unique_violation then
    -- Someone else scanned in the same instant.
    return jsonb_build_object('status', 'busy');
  end;
  return jsonb_build_object('status', 'recorded', 'scanId', _id);
end;
$$;

-- The scan screen polls this while it waits for the till.
create or replace function public.pos_scan_status(_scan_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _scan public.pos_scans;
  _amount integer;
begin
  select * into _scan from public.pos_scans where id = _scan_id;
  if not found or not public.can_record_manual_spend(_scan.business_id, auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select s.amount_pence - s.refunded_pence into _amount
  from public.pos_sales s where s.scan_id = _scan_id and s.state = 'matched' limit 1;
  return jsonb_build_object('status', _scan.status, 'amountPence', _amount);
end;
$$;

revoke execute on function
  public.record_pos_scan(uuid, uuid),
  public.pos_scan_status(uuid)
  from public, anon, authenticated;
grant execute on function
  public.record_pos_scan(uuid, uuid),
  public.pos_scan_status(uuid)
  to authenticated;
