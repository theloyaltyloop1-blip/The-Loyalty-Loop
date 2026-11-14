-- Win-back coupons become checkable at the till: each code is unique, expires
-- 30 days after sending, and can be redeemed once by the shop that sent it.

alter table public.winback_email_log
  add column if not exists expires_at timestamptz,
  add column if not exists redeemed_at timestamptz,
  add column if not exists redeemed_by uuid references auth.users(id);

update public.winback_email_log set expires_at = sent_at + interval '30 days' where expires_at is null;
alter table public.winback_email_log alter column expires_at set default now() + interval '30 days';

create unique index if not exists winback_email_log_coupon_code_key
  on public.winback_email_log (coupon_code);

-- Owner or staff with scan permission redeems a code for their own shop.
-- Returns the customer so the till can show who it is.
create or replace function public.redeem_winback_coupon(_business_id uuid, _code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := auth.uid();
  _row public.winback_email_log;
begin
  if _business_id is null or coalesce(trim(_code), '') = '' then
    raise exception 'invalid_arguments';
  end if;
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into _row from public.winback_email_log
  where coupon_code = upper(regexp_replace(_code, '\s', '', 'g'))
    and business_id = _business_id and status = 'sent'
  for update;

  if not found then
    raise exception 'coupon_not_found';
  end if;
  if _row.redeemed_at is not null then
    raise exception 'coupon_already_used';
  end if;
  if _row.expires_at is not null and _row.expires_at < now() then
    raise exception 'coupon_expired';
  end if;

  update public.winback_email_log
  set redeemed_at = now(), redeemed_by = _caller
  where id = _row.id;

  return jsonb_build_object('user_id', _row.user_id, 'code', _row.coupon_code, 'sent_at', _row.sent_at);
end;
$$;

revoke all on function public.redeem_winback_coupon(uuid, text) from public, anon;
grant execute on function public.redeem_winback_coupon(uuid, text) to authenticated;
