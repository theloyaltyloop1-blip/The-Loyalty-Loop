-- Birthday reward can be a free item, not only bonus stamps/points.
--
--   * businesses.birthday_reward_item: short text the owner names ("Free coffee").
--     Null = no free item. A shop has either birthday_bonus or birthday_reward_item,
--     never both (check constraint). The 20261121120000 bonus path is untouched.
--   * The free item is an ordinary row in public.rewards (title = the item, no
--     catalog_id), so it shows up wherever the member's rewards show and is redeemed
--     by the existing staff Redeem path. That path already allows one redemption only
--     (enforce_rewards_update_scope) and refuses redemption after expires_at.
--   * Expiry: the end of the member's birthday month, shop local time.
--   * Once a year: the same programme_bonus_log row (kind 'birthday', period 'YYYY')
--     the stamp/points bonus uses, so switching reward type cannot give two in a year.
--   * Awarded by one new trigger on transactions (stamp and spend visits), so it works
--     for every programme type without touching the award functions.
--   * Undoing a purchase (spend void) that carried a birthday item deletes the reward
--     if it is not yet redeemed and frees this year's birthday. If it was already
--     redeemed it is kept and the year stays used (no second reward).

alter table public.businesses
  add column birthday_reward_item text
  constraint businesses_birthday_reward_item_check
    check (birthday_reward_item is null or char_length(btrim(birthday_reward_item)) between 2 and 40);

alter table public.businesses
  add constraint businesses_birthday_one_kind_check
  check (birthday_bonus is null or birthday_reward_item is null);

comment on column public.businesses.birthday_reward_item is
  'Name of a free item given once a year on the first visit in the member''s birthday month (2-40 characters). Null = off. Exclusive with birthday_bonus.';

alter table public.transactions
  add column birthday_item text,
  add column birthday_reward_id uuid references public.rewards(id) on delete set null;

comment on column public.transactions.birthday_item is
  'Free birthday item this visit unlocked (set by the database, never by clients).';

create index if not exists transactions_birthday_reward_id_idx
  on public.transactions (birthday_reward_id) where birthday_reward_id is not null;

-- Clients cannot set the new columns on insert.
create or replace function public.reset_transaction_birthday_bonus()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.birthday_bonus := 0;
  new.birthday_item := null;
  new.birthday_reward_id := null;
  return new;
end;
$$;

revoke execute on function public.reset_transaction_birthday_bonus() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- The award. Runs after the visit's own trigger (name sorts last), same transaction.

create or replace function public.award_birthday_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _b public.businesses;
  _birthday date;
  _local timestamp;
  _tz text;
  _expires timestamptz;
  _got boolean := false;
  _reward_id uuid;
  _item text;
begin
  select * into _b from public.businesses where id = new.business_id;
  if not found or _b.birthday_reward_item is null then
    return new;
  end if;
  _item := btrim(_b.birthday_reward_item);

  select birthday into _birthday from public.profiles where id = new.user_id;
  _local := public.shop_local_now(_b.country_code);
  if _birthday is null or extract(month from _birthday) <> extract(month from _local) then
    return new;
  end if;

  insert into public.programme_bonus_log (user_id, business_id, kind, period, points)
  values (new.user_id, new.business_id, 'birthday', to_char(_local, 'YYYY'), 0)
  on conflict do nothing
  returning true into _got;
  if not coalesce(_got, false) then
    return new;
  end if;

  _tz := case coalesce(_b.country_code, 'GB') when 'PK' then 'Asia/Karachi' else 'Europe/London' end;
  _expires := (date_trunc('month', _local) + interval '1 month') at time zone _tz;

  insert into public.rewards (user_id, business_id, title, expires_at)
  values (new.user_id, new.business_id, _item, _expires)
  returning id into _reward_id;

  update public.transactions
  set birthday_item = _item, birthday_reward_id = _reward_id
  where id = new.id;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    new.user_id, new.business_id, 'reward', 'Happy birthday!',
    'Happy birthday from ' || _b.name || '! ' || _item || ' is waiting for you. Redeem it before '
      || to_char(_expires at time zone _tz - interval '1 day', 'FMDD FMMonth') || '.'
  );

  return new;
end;
$$;

revoke execute on function public.award_birthday_item() from public, anon, authenticated;

create trigger zz_award_birthday_item
  after insert on public.transactions
  for each row
  when (new.type in ('stamp', 'spend'))
  execute function public.award_birthday_item();

-- ---------------------------------------------------------------------
-- Undo of a purchase that carried a birthday item.

create or replace function public.void_birthday_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _country text;
  _deleted integer;
begin
  select b.country_code into _country from public.businesses b where b.id = old.business_id;

  delete from public.rewards
  where id = old.birthday_reward_id and redeemed_at is null;
  get diagnostics _deleted = row_count;

  -- Only free the year when the reward really went away; a redeemed one stays used.
  if _deleted > 0 then
    delete from public.programme_bonus_log
    where user_id = old.user_id and business_id = old.business_id and kind = 'birthday'
      and period = to_char(old.created_at at time zone case coalesce(_country, 'GB') when 'PK' then 'Asia/Karachi' else 'Europe/London' end, 'YYYY');
  end if;
  return new;
end;
$$;

revoke execute on function public.void_birthday_item() from public, anon, authenticated;

create trigger zz_void_birthday_item
  after update of voided_at on public.transactions
  for each row
  when (old.voided_at is null and new.voided_at is not null and new.type = 'spend' and old.birthday_reward_id is not null)
  execute function public.void_birthday_item();
