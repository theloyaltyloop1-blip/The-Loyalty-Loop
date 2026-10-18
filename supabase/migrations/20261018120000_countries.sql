-- Countries the platform runs in, and which one each shopper and shop belongs to.
-- The rules per country (currency, card-linking) live here, so they can change
-- without an app update.

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  currency_code text not null,
  currency_symbol text not null,
  -- Money is stored in minor units (pence, paisa). Pakistani prices are shown
  -- in whole rupees.
  display_decimals smallint not null default 2 check (display_decimals between 0 and 2),
  card_linking boolean not null default false,
  -- Spend limits are written for pounds; other currencies multiply them so the
  -- same real-world amount is allowed (PKR: about 300 rupees to the pound).
  amount_scale integer not null default 1 check (amount_scale between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.countries (code, name, currency_code, currency_symbol, display_decimals, card_linking, amount_scale) values
  ('GB', 'United Kingdom', 'GBP', '£', 2, true, 1),
  ('PK', 'Pakistan', 'PKR', 'Rs', 0, false, 300);

alter table public.countries enable row level security;
create policy "countries_read_all" on public.countries for select to anon, authenticated using (true);
grant select on public.countries to anon, authenticated;

-- Null means the shopper has not confirmed a country yet; the app asks once.
alter table public.profiles
  add column country_code text references public.countries(code);

-- Existing shops are all in the UK.
alter table public.businesses
  add column country_code text not null default 'GB' references public.countries(code);

create index businesses_country_code_idx on public.businesses (country_code);

-- Per-entry spend cap: was 1 to 1,000 pounds. Now 1 to 1,000 pounds' worth in
-- the shop's currency, checked against its country by the trigger below.
alter table public.businesses drop constraint businesses_manual_spend_max_pence_check;
alter table public.businesses add constraint businesses_manual_spend_max_pence_check
  check (manual_spend_max_pence between 100 and 1000000000);

-- "Money off" rewards: same idea, up to 10,000 pounds' worth.
alter table public.reward_catalog drop constraint reward_catalog_discount_pence_check;
alter table public.reward_catalog add constraint reward_catalog_discount_pence_check
  check (discount_pence is null or discount_pence between 1 and 2000000000);

create or replace function public.check_business_country_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _scale integer;
begin
  select amount_scale into _scale from public.countries where code = new.country_code;
  if new.manual_spend_max_pence > 100000::bigint * coalesce(_scale, 1) then
    raise exception 'manual_spend_max_pence is above the limit for this country'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger businesses_country_amounts
  before insert or update of manual_spend_max_pence, country_code on public.businesses
  for each row execute function public.check_business_country_amounts();

create or replace function public.check_reward_country_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _scale integer;
begin
  if new.discount_pence is null then
    return new;
  end if;
  select c.amount_scale into _scale
    from public.businesses b join public.countries c on c.code = b.country_code
   where b.id = new.business_id;
  if new.discount_pence > 1000000::bigint * coalesce(_scale, 1) then
    raise exception 'discount_pence is above the limit for this country'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reward_catalog_country_amounts
  before insert or update of discount_pence on public.reward_catalog
  for each row execute function public.check_reward_country_amounts();
