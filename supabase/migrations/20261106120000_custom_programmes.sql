-- Custom programmes (reward_model = 'custom'), designed by the AI programme builder.
--
-- A shop's programme is a rules document in businesses.programme_rules (format:
-- packages/loyalty/src/programme-rules.ts). The AI only ever writes that document;
-- everything here is fixed code that reads it, so no AI output runs as code.
--
--   * earning runs on the existing £ purchase path (manual entry and SumUp insert
--     type = 'spend' transactions; handle_spend_transaction dispatches here);
--   * the balance is memberships.points_balance, a wallet that never resets;
--   * points_earned on each transaction lets a refund take back exactly that;
--   * rewards in the rules are mirrored into reward_catalog (rule_key) so the
--     existing reward QR / short code / "£ off at the till" flows work unchanged;
--   * "3 points = £1 off" is redeem_points_for_cash, called by staff at the till;
--   * bonuses (sign-up, birthday, referral) and milestones are recorded once each
--     in programme_bonus_log;
--   * expiry runs daily from pg_cron.
--
-- Requests the engine cannot express are stored in programme_requests for the
-- team. Existing stamp / spend / tiers / points shops are not touched.

-- ---------------------------------------------------------------------
-- Model, columns

alter table public.businesses drop constraint businesses_reward_model_check;
alter table public.businesses
  add constraint businesses_reward_model_check
  check (reward_model in ('stamp_legacy', 'spend_threshold', 'tiers', 'points', 'custom'));

create or replace function public.reward_model_records_spend(_model text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(_model, '') in ('spend_threshold', 'tiers', 'points', 'custom')
$$;

alter table public.businesses add column programme_rules jsonb;

alter table public.reward_catalog
  add column rule_key text,
  add column discount_percent integer,
  add constraint reward_catalog_discount_percent_check
    check (discount_percent is null or discount_percent between 1 and 100),
  add constraint reward_catalog_one_discount_check
    check (discount_pence is null or discount_percent is null);

create unique index reward_catalog_rule_key_idx
  on public.reward_catalog (business_id, rule_key) where rule_key is not null;

-- Till cash-off redemptions share the points ledger (catalog_id null, pence set).
alter table public.points_redemptions add column pence integer check (pence is null or pence > 0);
alter table public.points_redemptions add column recorded_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- Ledgers

create table public.programme_bonus_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 120),
  period text not null check (char_length(period) between 1 and 20),
  points integer not null default 0,
  created_at timestamptz not null default now(),
  constraint programme_bonus_log_once unique (user_id, business_id, kind, period)
);
alter table public.programme_bonus_log enable row level security;
revoke all on public.programme_bonus_log from public, anon, authenticated;
grant select on public.programme_bonus_log to authenticated;
create policy "programme_bonus_log_select_self_or_owner_or_admin"
  on public.programme_bonus_log for select
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.businesses b
               where b.id = programme_bonus_log.business_id and b.owner_id = (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

-- What owners asked for that the building blocks could not do (admin reads these).
-- (Inserted by the design-programme edge function with the service role.)
create table public.programme_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  request text not null check (char_length(request) between 1 and 1000),
  closest text check (closest is null or char_length(closest) <= 1000),
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);
create index programme_requests_created_idx on public.programme_requests (created_at desc);
alter table public.programme_requests enable row level security;
revoke all on public.programme_requests from public, anon, authenticated;
grant select on public.programme_requests to authenticated;
grant update (status) on public.programme_requests to authenticated;
create policy "programme_requests_select_own_or_admin"
  on public.programme_requests for select
  using (owner_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "programme_requests_admin_update"
  on public.programme_requests for update
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- ---------------------------------------------------------------------
-- Rules validation. Mirrors validateRules() in packages/loyalty/src/programme-rules.ts.
-- Raises 'invalid_programme_rules' with the first problem as the detail.

create or replace function public.validate_programme_rules(_r jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  _e jsonb;
  _w jsonb;
  _i integer;
  _k text;
  _n integer;
  _level_keys text[] := '{}';
  _reward_keys text[] := '{}';
  _milestone_rewards text[] := '{}';
  _earns boolean := false;
  _spends boolean := false;
  _measure text;
  _set integer;
  _problem text;
begin
  if _r is null or jsonb_typeof(_r) <> 'object' then
    _problem := 'rules must be an object';
  end if;

  -- Small helpers inline: num(x) is a jsonb number; int(x) a whole number.
  if _problem is null then
    select string_agg(k, ',') into _k from jsonb_object_keys(_r) k
    where k not in ('version','unit','earn','bonuses','cash_value','rewards','milestones','levels','expiry','caps','summary');
    if _k is not null then _problem := 'unknown field ' || _k; end if;
  end if;
  if _problem is null and (_r->'version') is distinct from '1'::jsonb then _problem := 'version must be 1'; end if;
  if _problem is null and (
       jsonb_typeof(_r->'unit') is distinct from 'object'
       or jsonb_typeof(_r#>'{unit,one}') is distinct from 'string'
       or jsonb_typeof(_r#>'{unit,many}') is distinct from 'string'
       or char_length(btrim(_r#>>'{unit,one}')) not between 1 and 20
       or char_length(btrim(_r#>>'{unit,many}')) not between 1 and 20) then
    _problem := 'unit names must be 1-20 characters';
  end if;
  if _problem is null and (jsonb_typeof(_r->'summary') is distinct from 'string'
       or char_length(btrim(_r->>'summary')) not between 1 and 600) then
    _problem := 'summary must be 1-600 characters';
  end if;

  -- levels
  if _problem is null and _r ? 'levels' then
    if jsonb_typeof(_r->'levels') <> 'array' or jsonb_array_length(_r->'levels') > 6 then
      _problem := 'levels must be a list of at most 6';
    else
      for _e in select * from jsonb_array_elements(_r->'levels') loop
        if jsonb_typeof(_e) <> 'object' then _problem := 'level must be an object'; exit; end if;
        if exists (select 1 from jsonb_object_keys(_e) k where k not in ('key','name','min_visits','min_spend_12m_pence','multiplier','perks')) then
          _problem := 'level has an unknown field'; exit;
        end if;
        if jsonb_typeof(_e->'key') is distinct from 'string' or (_e->>'key') !~ '^[a-z0-9][a-z0-9-]{0,39}$' then
          _problem := 'level key is invalid'; exit;
        end if;
        if (_e->>'key') = any(_level_keys) then _problem := 'level key used twice'; exit; end if;
        _level_keys := _level_keys || (_e->>'key');
        if jsonb_typeof(_e->'name') is distinct from 'string' or char_length(btrim(_e->>'name')) not between 1 and 40 then
          _problem := 'level name must be 1-40 characters'; exit;
        end if;
        if (_e ? 'min_visits') = (_e ? 'min_spend_12m_pence') then
          _problem := 'level needs exactly one of min_visits or min_spend_12m_pence'; exit;
        end if;
        if _e ? 'min_visits' and not (jsonb_typeof(_e->'min_visits') = 'number'
             and (_e->>'min_visits')::numeric = trunc((_e->>'min_visits')::numeric)
             and (_e->>'min_visits')::numeric between 0 and 10000) then
          _problem := 'level min_visits out of range'; exit;
        end if;
        if _e ? 'min_spend_12m_pence' and not (jsonb_typeof(_e->'min_spend_12m_pence') = 'number'
             and (_e->>'min_spend_12m_pence')::numeric = trunc((_e->>'min_spend_12m_pence')::numeric)
             and (_e->>'min_spend_12m_pence')::numeric between 0 and 100000000) then
          _problem := 'level min_spend_12m_pence out of range'; exit;
        end if;
        _k := case when _e ? 'min_visits' then 'visits' else 'spend' end;
        if _measure is null then
          _measure := _k;
        elsif _measure <> _k then
          _problem := 'all levels must use the same measure'; exit;
        end if;
        if _e ? 'multiplier' and not (jsonb_typeof(_e->'multiplier') = 'number'
             and (_e->>'multiplier')::numeric between 1 and 10) then
          _problem := 'level multiplier must be 1-10'; exit;
        end if;
        if _e ? 'perks' and (jsonb_typeof(_e->'perks') <> 'array' or jsonb_array_length(_e->'perks') > 6
             or exists (select 1 from jsonb_array_elements(_e->'perks') p
                        where jsonb_typeof(p) <> 'string' or char_length(btrim(p #>> '{}')) not between 1 and 80)) then
          _problem := 'level perks are invalid'; exit;
        end if;
      end loop;
      if _problem is null and (
        select count(distinct coalesce(l->'min_visits', l->'min_spend_12m_pence')) from jsonb_array_elements(_r->'levels') l
      ) <> jsonb_array_length(_r->'levels') then
        _problem := 'each level needs a different threshold';
      end if;
      if _problem is null and jsonb_array_length(_r->'levels') > 0 then _spends := true; end if;
    end if;
  end if;

  -- earn
  if _problem is null then
    if jsonb_typeof(_r->'earn') is distinct from 'array' or jsonb_array_length(_r->'earn') > 12 then
      _problem := 'earn must be a list of at most 12';
    else
      for _e in select * from jsonb_array_elements(_r->'earn') loop
        if jsonb_typeof(_e) <> 'object' then _problem := 'earn rule must be an object'; exit; end if;
        if exists (select 1 from jsonb_object_keys(_e) k where k not in ('label','per_pound','per_visit','multiplier','when')) then
          _problem := 'earn rule has an unknown field'; exit;
        end if;
        if jsonb_typeof(_e->'label') is distinct from 'string' or char_length(btrim(_e->>'label')) not between 1 and 80 then
          _problem := 'earn label must be 1-80 characters'; exit;
        end if;
        _set := (_e ? 'per_pound')::int + (_e ? 'per_visit')::int + (_e ? 'multiplier')::int;
        if _set <> 1 then _problem := 'earn rule needs exactly one of per_pound, per_visit or multiplier'; exit; end if;
        if _e ? 'per_pound' then
          if jsonb_typeof(_e->'per_pound') <> 'number' or (_e->>'per_pound')::numeric <= 0 or (_e->>'per_pound')::numeric > 1000 then
            _problem := 'per_pound out of range'; exit;
          end if;
          _earns := true;
        elsif _e ? 'per_visit' then
          if jsonb_typeof(_e->'per_visit') <> 'number' or (_e->>'per_visit')::numeric <> trunc((_e->>'per_visit')::numeric)
             or (_e->>'per_visit')::numeric not between 1 and 100000 then
            _problem := 'per_visit out of range'; exit;
          end if;
          _earns := true;
        else
          if jsonb_typeof(_e->'multiplier') <> 'number' or (_e->>'multiplier')::numeric <= 1 or (_e->>'multiplier')::numeric > 10 then
            _problem := 'multiplier must be above 1 and at most 10'; exit;
          end if;
        end if;
        if _e ? 'when' then
          _w := _e->'when';
          if jsonb_typeof(_w) <> 'object' then _problem := 'when must be an object'; exit; end if;
          if exists (select 1 from jsonb_object_keys(_w) k where k not in
               ('days','from','to','min_spend_pence','every_nth_visit','first_visit','levels','start_date','end_date')) then
            _problem := 'when has an unknown field'; exit;
          end if;
          if _w ? 'days' and (jsonb_typeof(_w->'days') <> 'array'
               or jsonb_array_length(_w->'days') not between 1 and 7
               or exists (select 1 from jsonb_array_elements(_w->'days') d
                          where jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$')
               or (select count(distinct d #>> '{}') from jsonb_array_elements(_w->'days') d) <> jsonb_array_length(_w->'days')) then
            _problem := 'days must be distinct numbers 0-6'; exit;
          end if;
          if (_w ? 'from') <> (_w ? 'to') then _problem := 'when needs both from and to'; exit; end if;
          if _w ? 'from' and (jsonb_typeof(_w->'from') <> 'string' or jsonb_typeof(_w->'to') <> 'string'
               or (_w->>'from') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (_w->>'to') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
               or (_w->>'from') = (_w->>'to')) then
            _problem := 'from/to must be different HH:MM times'; exit;
          end if;
          if _w ? 'min_spend_pence' and not (jsonb_typeof(_w->'min_spend_pence') = 'number'
               and (_w->>'min_spend_pence')::numeric = trunc((_w->>'min_spend_pence')::numeric)
               and (_w->>'min_spend_pence')::numeric between 1 and 100000000) then
            _problem := 'min_spend_pence out of range'; exit;
          end if;
          if _w ? 'every_nth_visit' and not (jsonb_typeof(_w->'every_nth_visit') = 'number'
               and (_w->>'every_nth_visit')::numeric = trunc((_w->>'every_nth_visit')::numeric)
               and (_w->>'every_nth_visit')::numeric between 2 and 10000) then
            _problem := 'every_nth_visit out of range'; exit;
          end if;
          if _w ? 'first_visit' and (_w->'first_visit') <> 'true'::jsonb then
            _problem := 'first_visit can only be true'; exit;
          end if;
          if _w ? 'levels' and (jsonb_typeof(_w->'levels') <> 'array' or jsonb_array_length(_w->'levels') < 1
               or exists (select 1 from jsonb_array_elements(_w->'levels') l
                          where jsonb_typeof(l) <> 'string' or not ((l #>> '{}') = any(_level_keys)))) then
            _problem := 'when.levels must name existing level keys'; exit;
          end if;
          foreach _k in array array['start_date', 'end_date'] loop
            if _w ? _k then
              if jsonb_typeof(_w->_k) <> 'string' or (_w->>_k) !~ '^\d{4}-\d{2}-\d{2}$' then
                _problem := _k || ' must be YYYY-MM-DD'; exit;
              end if;
              begin
                perform (_w->>_k)::date;
                if to_char((_w->>_k)::date, 'YYYY-MM-DD') <> (_w->>_k) then _problem := _k || ' is not a real date'; exit; end if;
              exception when others then
                _problem := _k || ' is not a real date'; exit;
              end;
            end if;
          end loop;
          if _problem is not null then exit; end if;
          if _w ? 'start_date' and _w ? 'end_date' and (_w->>'start_date') > (_w->>'end_date') then
            _problem := 'start_date is after end_date'; exit;
          end if;
        end if;
      end loop;
    end if;
  end if;

  -- bonuses
  if _problem is null and _r ? 'bonuses' then
    if jsonb_typeof(_r->'bonuses') <> 'object'
       or exists (select 1 from jsonb_object_keys(_r->'bonuses') k where k not in ('signup','birthday','referral'))
       or exists (select 1 from jsonb_each(_r->'bonuses') b
                  where jsonb_typeof(b.value) <> 'number' or (b.value #>> '{}')::numeric <> trunc((b.value #>> '{}')::numeric)
                     or (b.value #>> '{}')::numeric not between 1 and 100000) then
      _problem := 'bonuses must be whole numbers 1-100000';
    elsif exists (select 1 from jsonb_object_keys(_r->'bonuses')) then
      _earns := true;
    end if;
  end if;

  -- cash value
  if _problem is null and _r ? 'cash_value' and jsonb_typeof(_r->'cash_value') <> 'null' then
    _e := _r->'cash_value';
    if jsonb_typeof(_e) <> 'object'
       or exists (select 1 from jsonb_object_keys(_e) k where k not in ('points','pence','max_pence_per_visit'))
       or jsonb_typeof(_e->'points') is distinct from 'number' or jsonb_typeof(_e->'pence') is distinct from 'number'
       or (_e->>'points')::numeric <> trunc((_e->>'points')::numeric) or (_e->>'points')::numeric not between 1 and 100000000
       or (_e->>'pence')::numeric <> trunc((_e->>'pence')::numeric) or (_e->>'pence')::numeric not between 1 and 100000000
       or (_e ? 'max_pence_per_visit' and (jsonb_typeof(_e->'max_pence_per_visit') <> 'number'
           or (_e->>'max_pence_per_visit')::numeric <> trunc((_e->>'max_pence_per_visit')::numeric)
           or (_e->>'max_pence_per_visit')::numeric < (_e->>'pence')::numeric
           or (_e->>'max_pence_per_visit')::numeric > 100000000)) then
      _problem := 'cash_value is invalid';
    else
      _spends := true;
    end if;
  end if;

  -- rewards
  if _problem is null then
    if jsonb_typeof(_r->'rewards') is distinct from 'array' or jsonb_array_length(_r->'rewards') > 12 then
      _problem := 'rewards must be a list of at most 12';
    else
      for _e in select * from jsonb_array_elements(_r->'rewards') loop
        if jsonb_typeof(_e) <> 'object'
           or exists (select 1 from jsonb_object_keys(_e) k where k not in ('key','title','description','points_cost','discount_pence','discount_percent')) then
          _problem := 'reward has an unknown field'; exit;
        end if;
        if jsonb_typeof(_e->'key') is distinct from 'string' or (_e->>'key') !~ '^[a-z0-9][a-z0-9-]{0,39}$' then
          _problem := 'reward key is invalid'; exit;
        end if;
        if (_e->>'key') = any(_reward_keys) then _problem := 'reward key used twice'; exit; end if;
        _reward_keys := _reward_keys || (_e->>'key');
        if jsonb_typeof(_e->'title') is distinct from 'string' or char_length(btrim(_e->>'title')) not between 1 and 80 then
          _problem := 'reward title must be 1-80 characters'; exit;
        end if;
        if _e ? 'description' and (jsonb_typeof(_e->'description') <> 'string' or char_length(btrim(_e->>'description')) > 200) then
          _problem := 'reward description is too long'; exit;
        end if;
        if _e ? 'points_cost' and not (jsonb_typeof(_e->'points_cost') = 'number'
             and (_e->>'points_cost')::numeric = trunc((_e->>'points_cost')::numeric)
             and (_e->>'points_cost')::numeric between 1 and 100000000) then
          _problem := 'reward points_cost out of range'; exit;
        end if;
        if _e ? 'discount_pence' and _e ? 'discount_percent' then _problem := 'reward has two discounts'; exit; end if;
        if _e ? 'discount_pence' and not (jsonb_typeof(_e->'discount_pence') = 'number'
             and (_e->>'discount_pence')::numeric = trunc((_e->>'discount_pence')::numeric)
             and (_e->>'discount_pence')::numeric between 1 and 100000000) then
          _problem := 'reward discount_pence out of range'; exit;
        end if;
        if _e ? 'discount_percent' and not (jsonb_typeof(_e->'discount_percent') = 'number'
             and (_e->>'discount_percent')::numeric = trunc((_e->>'discount_percent')::numeric)
             and (_e->>'discount_percent')::numeric between 1 and 100) then
          _problem := 'reward discount_percent must be 1-100'; exit;
        end if;
      end loop;
      if _problem is null and jsonb_array_length(_r->'rewards') > 0 then _spends := true; end if;
    end if;
  end if;

  -- milestones
  if _problem is null and _r ? 'milestones' then
    if jsonb_typeof(_r->'milestones') <> 'array' or jsonb_array_length(_r->'milestones') > 8 then
      _problem := 'milestones must be a list of at most 8';
    else
      for _e in select * from jsonb_array_elements(_r->'milestones') loop
        if jsonb_typeof(_e) <> 'object'
           or exists (select 1 from jsonb_object_keys(_e) k where k not in ('label','reward','every_visits','at_lifetime_spend_pence')) then
          _problem := 'milestone has an unknown field'; exit;
        end if;
        if jsonb_typeof(_e->'label') is distinct from 'string' or char_length(btrim(_e->>'label')) not between 1 and 80 then
          _problem := 'milestone label must be 1-80 characters'; exit;
        end if;
        if jsonb_typeof(_e->'reward') is distinct from 'string' or not ((_e->>'reward') = any(_reward_keys)) then
          _problem := 'milestone reward must name a reward key'; exit;
        end if;
        if (_e ? 'every_visits') = (_e ? 'at_lifetime_spend_pence') then
          _problem := 'milestone needs exactly one of every_visits or at_lifetime_spend_pence'; exit;
        end if;
        if _e ? 'every_visits' and not (jsonb_typeof(_e->'every_visits') = 'number'
             and (_e->>'every_visits')::numeric = trunc((_e->>'every_visits')::numeric)
             and (_e->>'every_visits')::numeric between 1 and 10000) then
          _problem := 'milestone every_visits out of range'; exit;
        end if;
        if _e ? 'at_lifetime_spend_pence' and not (jsonb_typeof(_e->'at_lifetime_spend_pence') = 'number'
             and (_e->>'at_lifetime_spend_pence')::numeric = trunc((_e->>'at_lifetime_spend_pence')::numeric)
             and (_e->>'at_lifetime_spend_pence')::numeric between 1 and 100000000) then
          _problem := 'milestone at_lifetime_spend_pence out of range'; exit;
        end if;
        _milestone_rewards := _milestone_rewards || (_e->>'reward');
        _earns := true;
      end loop;
    end if;
  end if;

  if _problem is null and exists (
    select 1 from jsonb_array_elements(_r->'rewards') x
    where not (x ? 'points_cost') and not ((x->>'key') = any(_milestone_rewards))
  ) then
    _problem := 'a reward has no points_cost and no milestone gives it out';
  end if;

  -- expiry, caps
  if _problem is null and _r ? 'expiry' and jsonb_typeof(_r->'expiry') <> 'null' then
    if jsonb_typeof(_r->'expiry') <> 'object'
       or exists (select 1 from jsonb_object_keys(_r->'expiry') k where k <> 'inactive_months')
       or jsonb_typeof(_r#>'{expiry,inactive_months}') is distinct from 'number'
       or (_r#>>'{expiry,inactive_months}') !~ '^[0-9]+$'
       or (_r#>>'{expiry,inactive_months}')::int not between 1 and 60 then
      _problem := 'expiry.inactive_months must be 1-60';
    end if;
  end if;
  if _problem is null and _r ? 'caps' then
    if jsonb_typeof(_r->'caps') <> 'object'
       or exists (select 1 from jsonb_object_keys(_r->'caps') k where k not in ('max_points_per_visit','max_points_per_day'))
       or exists (select 1 from jsonb_each(_r->'caps') c
                  where jsonb_typeof(c.value) <> 'number' or (c.value #>> '{}') !~ '^[0-9]+$'
                     or (c.value #>> '{}')::numeric not between 1 and 100000000) then
      _problem := 'caps must be whole numbers';
    end if;
  end if;

  if _problem is null and not _earns then _problem := 'the programme needs at least one way to earn'; end if;
  if _problem is null and not _spends then _problem := 'the programme needs a reward, a cash value or levels'; end if;

  if _problem is not null then
    raise exception 'invalid_programme_rules' using detail = _problem, errcode = '22023';
  end if;
exception when others then
  -- Anything unexpected (a string where a number belongs, say) is still just "invalid".
  if sqlerrm = 'invalid_programme_rules' then
    raise;
  end if;
  raise exception 'invalid_programme_rules' using detail = 'rules are malformed', errcode = '22023';
end;
$$;

-- A custom shop must always have valid rules; rules on other shops are refused.
create or replace function public.check_programme_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reward_model = 'custom' then
    perform public.validate_programme_rules(new.programme_rules);
  elsif new.programme_rules is not null and (tg_op = 'INSERT' or new.programme_rules is distinct from old.programme_rules) then
    raise exception 'invalid_programme_rules' using detail = 'only custom programmes take rules', errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger check_programme_rules
  before insert or update of reward_model, programme_rules on public.businesses
  for each row execute function public.check_programme_rules();

-- Mirror the rules' rewards into reward_catalog so every existing reward flow works.
create or replace function public.sync_programme_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _item jsonb;
  _i integer := 0;
  _keys text[] := '{}';
begin
  if new.reward_model <> 'custom' or new.programme_rules is null then
    return null;
  end if;
  for _item in select * from jsonb_array_elements(new.programme_rules->'rewards') loop
    _keys := _keys || (_item->>'key');
    insert into public.reward_catalog (
      business_id, rule_key, title, description, stamp_threshold, points_cost, discount_pence, discount_percent, sort_order
    ) values (
      new.id, _item->>'key', btrim(_item->>'title'), nullif(btrim(coalesce(_item->>'description', '')), ''), 1,
      (_item->>'points_cost')::integer, (_item->>'discount_pence')::integer, (_item->>'discount_percent')::integer, _i
    )
    on conflict (business_id, rule_key) where rule_key is not null do update
      set title = excluded.title, description = excluded.description, points_cost = excluded.points_cost,
          discount_pence = excluded.discount_pence, discount_percent = excluded.discount_percent,
          sort_order = excluded.sort_order;
    _i := _i + 1;
  end loop;
  -- Issued rewards keep their title; catalog_id becomes null (ON DELETE SET NULL).
  delete from public.reward_catalog
  where business_id = new.id and rule_key is not null and not (rule_key = any(_keys));
  return null;
end;
$$;

create trigger sync_programme_rewards
  after insert or update of programme_rules on public.businesses
  for each row execute function public.sync_programme_rewards();

revoke execute on function public.sync_programme_rewards() from public, anon, authenticated;
revoke execute on function public.check_programme_rules() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Engine helpers

create or replace function public.shop_local_now(_country_code text)
returns timestamp
language sql
stable
set search_path = ''
as $$
  select now() at time zone case coalesce(_country_code, 'GB') when 'PK' then 'Asia/Karachi' else 'Europe/London' end
$$;

create or replace function public.custom_rule_applies(
  _rule jsonb, _pence integer, _visit_no integer, _day integer, _time text, _date text, _level text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  _w jsonb := _rule->'when';
begin
  if _w is null then return true; end if;
  if _w ? 'days' and not exists (select 1 from jsonb_array_elements_text(_w->'days') d where d::int = _day) then
    return false;
  end if;
  if _w ? 'from' then
    if (_w->>'from') < (_w->>'to') then
      if not (_time >= (_w->>'from') and _time < (_w->>'to')) then return false; end if;
    else
      if not (_time >= (_w->>'from') or _time < (_w->>'to')) then return false; end if;
    end if;
  end if;
  if _w ? 'min_spend_pence' and _pence < (_w->>'min_spend_pence')::bigint then return false; end if;
  if _w ? 'every_nth_visit' and _visit_no % (_w->>'every_nth_visit')::int <> 0 then return false; end if;
  if (_w->>'first_visit') = 'true' and _visit_no <> 1 then return false; end if;
  if _w ? 'levels' and (_level is null or not exists (
       select 1 from jsonb_array_elements_text(_w->'levels') l where l = _level)) then
    return false;
  end if;
  if _w ? 'start_date' and _date < (_w->>'start_date') then return false; end if;
  if _w ? 'end_date' and _date > (_w->>'end_date') then return false; end if;
  return true;
end;
$$;

-- The highest level reached (null when none), matching levelFor().
create or replace function public.custom_level(_rules jsonb, _visits integer, _spend12 bigint)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select l from jsonb_array_elements(coalesce(_rules->'levels', '[]'::jsonb)) l
  where case when l ? 'min_visits' then _visits >= (l->>'min_visits')::int
             else _spend12 >= (l->>'min_spend_12m_pence')::bigint end
  order by coalesce((l->>'min_visits')::bigint, (l->>'min_spend_12m_pence')::bigint) desc
  limit 1
$$;

create or replace function public.custom_issue_reward(_user_id uuid, _business_id uuid, _reward_key text, _why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _cat public.reward_catalog;
begin
  select * into _cat from public.reward_catalog where business_id = _business_id and rule_key = _reward_key;
  if not found then return; end if;
  insert into public.rewards (user_id, business_id, title, catalog_id) values (_user_id, _business_id, _cat.title, _cat.id);
  insert into public.notifications (user_id, business_id, kind, title, body)
  values (_user_id, _business_id, 'reward', 'Reward earned!', _cat.title || ' is ready to redeem' || coalesce(' (' || _why || ')', '') || '.');
end;
$$;

revoke execute on function public.custom_issue_reward(uuid, uuid, text, text) from public, anon, authenticated;

-- One purchase at a custom shop. Called from handle_spend_transaction, which has
-- already locked the membership row.
create or replace function public.apply_custom_spend(
  _user_id uuid, _business_id uuid, _membership_id uuid, _transaction_id uuid, _value integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _b public.businesses;
  _m public.memberships;
  _r jsonb;
  _one text;
  _many text;
  _local timestamp;
  _day integer;
  _time text;
  _date text;
  _visit_no integer;
  _spend12 bigint;
  _life_after bigint;
  _level_before jsonb;
  _level_after jsonb;
  _rule jsonb;
  _base numeric := 0;
  _mult numeric := 1;
  _points integer;
  _today integer;
  _bonus integer := 0;
  _birthday date;
  _ms jsonb;
  _i integer := 0;
  _balance integer;
  _got boolean;
begin
  select * into _b from public.businesses where id = _business_id;
  select * into _m from public.memberships where id = _membership_id;
  _r := _b.programme_rules;
  _one := _r#>>'{unit,one}';
  _many := _r#>>'{unit,many}';

  _local := public.shop_local_now(_b.country_code);
  _day := extract(dow from _local)::int;
  _time := to_char(_local, 'HH24:MI');
  _date := to_char(_local, 'YYYY-MM-DD');
  _visit_no := _m.visit_count + 1;
  -- The new purchase is already inserted (AFTER INSERT trigger), so these include it.
  _spend12 := public.member_rolling_spend(_user_id, _business_id);
  select coalesce(sum(t.value), 0) into _life_after from public.transactions t
  where t.user_id = _user_id and t.business_id = _business_id and t.type = 'spend' and t.voided_at is null;

  _level_before := public.custom_level(_r, _m.visit_count, _spend12 - _value);
  _level_after := public.custom_level(_r, _visit_no, _spend12);

  for _rule in select * from jsonb_array_elements(_r->'earn') loop
    if public.custom_rule_applies(_rule, _value, _visit_no, _day, _time, _date, _level_before->>'key') then
      if _rule ? 'per_pound' then
        _base := _base + floor(_value::numeric * (_rule->>'per_pound')::numeric / 100);
      elsif _rule ? 'per_visit' then
        _base := _base + (_rule->>'per_visit')::numeric;
      else
        _mult := greatest(_mult, (_rule->>'multiplier')::numeric);
      end if;
    end if;
  end loop;
  if _level_before ? 'multiplier' then
    _mult := greatest(_mult, (_level_before->>'multiplier')::numeric);
  end if;
  _points := least(floor(_base * _mult), 100000000)::integer;

  if _r#>'{caps,max_points_per_visit}' is not null then
    _points := least(_points, (_r#>>'{caps,max_points_per_visit}')::integer);
  end if;
  if _r#>'{caps,max_points_per_day}' is not null then
    select coalesce(sum(t.points_earned), 0) into _today from public.transactions t
    where t.user_id = _user_id and t.business_id = _business_id and t.type = 'spend'
      and t.voided_at is null and t.id <> _transaction_id
      and (t.created_at at time zone case coalesce(_b.country_code, 'GB') when 'PK' then 'Asia/Karachi' else 'Europe/London' end)::date = _local::date;
    _points := greatest(0, least(_points, (_r#>>'{caps,max_points_per_day}')::integer - _today));
  end if;

  -- Birthday: once a year, on the first purchase in the birthday month.
  if _r#>'{bonuses,birthday}' is not null then
    select birthday into _birthday from public.profiles where id = _user_id;
    if _birthday is not null and extract(month from _birthday) = extract(month from _local) then
      insert into public.programme_bonus_log (user_id, business_id, kind, period, points)
      values (_user_id, _business_id, 'birthday', to_char(_local, 'YYYY'), (_r#>>'{bonuses,birthday}')::integer)
      on conflict do nothing
      returning true into _got;
      if _got then _bonus := (_r#>>'{bonuses,birthday}')::integer; end if;
    end if;
  end if;

  perform set_config('app.membership_trusted', 'on', true);
  update public.memberships
  set points_balance = points_balance + _points + _bonus,
      visit_count = visit_count + 1,
      current_tier = _level_after->>'name',
      last_visit_date = _local::date,
      last_activity_at = now()
  where id = _membership_id
  returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  update public.transactions set points_earned = _points + _bonus where id = _transaction_id;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    _user_id, _business_id, 'stamp', initcap(_many) || ' added',
    'You earned ' || (_points + _bonus) || ' ' || case when _points + _bonus = 1 then _one else _many end ||
      case when _bonus > 0 then ' (including a birthday bonus)' else '' end ||
      '. You now have ' || _balance || '.'
  );

  -- Milestones
  for _ms in select * from jsonb_array_elements(coalesce(_r->'milestones', '[]'::jsonb)) loop
    if _ms ? 'every_visits' then
      if _visit_no % (_ms->>'every_visits')::int = 0 then
        perform public.custom_issue_reward(_user_id, _business_id, _ms->>'reward', _ms->>'label');
      end if;
    elsif _life_after >= (_ms->>'at_lifetime_spend_pence')::bigint
          and _life_after - _value < (_ms->>'at_lifetime_spend_pence')::bigint then
      _got := false;
      insert into public.programme_bonus_log (user_id, business_id, kind, period)
      values (_user_id, _business_id, 'milestone:' || (_ms->>'reward') || ':' || (_ms->>'at_lifetime_spend_pence'), 'once')
      on conflict do nothing
      returning true into _got;
      if _got then
        perform public.custom_issue_reward(_user_id, _business_id, _ms->>'reward', _ms->>'label');
      end if;
    end if;
    _i := _i + 1;
  end loop;

  if _level_after is not null and (_level_before is null or (_level_after->>'key') <> (_level_before->>'key')) then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (_user_id, _business_id, 'reward', 'New level: ' || (_level_after->>'name'),
            'You are now a ' || (_level_after->>'name') || ' member at ' || _b.name || '.');
  end if;
end;
$$;

revoke execute on function public.apply_custom_spend(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Dispatch (only the custom branches are new)

create or replace function public.handle_spend_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _membership public.memberships;
  _model text;
  _threshold integer;
  _has_tiers boolean;
  _top integer;
  _pos bigint;
  _remaining bigint;
  _tier record;
  _needed bigint;
  _reward_count integer := 0;
  _next record;
begin
  select * into _membership
  from public.memberships
  where user_id = new.user_id and business_id = new.business_id
  for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  if new.membership_id is not null and new.membership_id != _membership.id then
    raise exception 'transaction membership does not match customer and business';
  end if;

  select b.reward_model, b.reward_threshold_pence
  into _model, _threshold
  from public.businesses b
  where b.id = new.business_id;

  if _model = 'tiers' then
    perform public.apply_tiers_spend(new.user_id, new.business_id, _membership.id);
    return new;
  elsif _model = 'points' then
    perform public.apply_points_spend(new.user_id, new.business_id, _membership.id, new.id, new.value);
    return new;
  elsif _model = 'custom' then
    perform public.apply_custom_spend(new.user_id, new.business_id, _membership.id, new.id, new.value);
    return new;
  end if;

  select max(spend_threshold_pence) into _top
  from public.reward_catalog
  where business_id = new.business_id and spend_threshold_pence is not null;
  _has_tiers := _top is not null;

  if _model is distinct from 'spend_threshold'
    or (not _has_tiers and (_threshold is null or _threshold <= 0)) then
    raise exception 'spend rewards require a configured positive threshold';
  end if;

  _pos := _membership.reward_progress_pence::bigint;
  _remaining := new.value::bigint;

  while _remaining > 0 loop
    if _has_tiers then
      select id, title, spend_threshold_pence as amount into _tier
      from public.reward_catalog
      where business_id = new.business_id
        and spend_threshold_pence is not null
        and spend_threshold_pence > _pos
      order by spend_threshold_pence
      limit 1;
      if not found then
        select id, title, spend_threshold_pence as amount into _tier
        from public.reward_catalog
        where business_id = new.business_id and spend_threshold_pence = _top
        limit 1;
      end if;
    else
      select null::uuid as id, 'Free reward'::text as title, _threshold as amount into _tier;
    end if;

    _needed := greatest(_tier.amount::bigint - _pos, 0);
    if _remaining < _needed then
      _pos := _pos + _remaining;
      _remaining := 0;
    else
      _remaining := _remaining - _needed;
      _reward_count := _reward_count + 1;
      if _reward_count > 1000 then
        raise exception 'spend transaction crosses too many reward thresholds';
      end if;

      insert into public.rewards (user_id, business_id, title, catalog_id)
      values (new.user_id, new.business_id, _tier.title, _tier.id);

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');

      _pos := case
        when not _has_tiers or _tier.amount >= _top then 0
        else _tier.amount
      end;
    end if;
  end loop;

  if _pos < -2147483648 or _pos > 2147483647 then
    raise exception 'reward progress exceeds integer range';
  end if;

  update public.memberships
  set reward_progress_pence = _pos::integer,
      redemption_blocked_reason =
        case when _pos >= 0 then null else redemption_blocked_reason end,
      visit_count = visit_count + 1,
      last_visit_date = (now() at time zone 'utc')::date,
      last_activity_at = now()
  where id = _membership.id;

  if _reward_count = 0 then
    select * into _next from public.spend_next_tier(new.business_id, _pos::integer);
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id, new.business_id, 'stamp', 'Progress updated',
      'You are £' ||
        to_char(greatest(0, _next.amount_pence::bigint - _pos) / 100.0, 'FM999999990.00') ||
        ' away from ' || coalesce(_next.title, 'your next reward') || '.'
    );
  end if;

  return new;
end;
$function$;

create or replace function public.handle_spend_void()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _model text;
  _new_progress integer;
  _shop_name text;
begin
  select b.reward_model, b.name into _model, _shop_name
  from public.businesses b where b.id = old.business_id;

  if _model = 'tiers' then
    perform public.recompute_member_tier(old.user_id, old.business_id);
  elsif _model in ('points', 'custom') then
    perform set_config('app.membership_trusted', 'on', true);
    update public.memberships
    set points_balance = points_balance - coalesce(old.points_earned, 0)
    where user_id = old.user_id and business_id = old.business_id;
    perform set_config('app.membership_trusted', 'off', true);
  else
    update public.memberships
    set reward_progress_pence = reward_progress_pence - old.value,
        redemption_blocked_reason = case
          when reward_progress_pence - old.value < 0
            then 'A purchase entry was corrected. Spend a little more to redeem again.'
          else redemption_blocked_reason
        end
    where user_id = old.user_id and business_id = old.business_id
    returning reward_progress_pence into _new_progress;
  end if;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (
    old.user_id, old.business_id, 'system', 'Purchase corrected',
    'A purchase of £' || to_char(old.value / 100.0, 'FM999999990.00') ||
      coalesce(' at ' || _shop_name, '') || ' was corrected by the shop.'
  );
  return new;
end;
$function$;

-- Same as before, with 'custom' guarded like 'points' and 'tiers'.
create or replace function public.enforce_membership_update_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _is_privileged boolean;
  _is_service_role boolean;
  _trusted boolean;
begin
  _is_service_role := coalesce(auth.role(), '') = 'service_role';
  _is_privileged := _is_service_role
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.owner_id = auth.uid()
    )
    or public.is_active_staff_of(new.business_id, auth.uid());
  _trusted := _is_service_role
    or public.has_role(auth.uid(), 'admin')
    or pg_trigger_depth() > 1
    or coalesce(current_setting('app.membership_trusted', true), '') = 'on';

  if (
      new.reward_progress_pence != old.reward_progress_pence
      or new.redemption_blocked_reason is distinct from old.redemption_blocked_reason
      or new.current_tier_id is distinct from old.current_tier_id
      or (new.points_balance != old.points_balance and exists (
        select 1 from public.businesses b where b.id = new.business_id and b.reward_model in ('points', 'custom')))
      or (new.current_tier is distinct from old.current_tier and exists (
        select 1 from public.businesses b where b.id = new.business_id and b.reward_model in ('tiers', 'custom')))
    )
    and not _trusted then
    raise exception 'reward progress requires a trusted transaction';
  end if;

  if _is_privileged or coalesce(current_setting('app.membership_trusted', true), '') = 'on' then
    return new;
  end if;

  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.stamp_count != old.stamp_count
    or new.points_balance != old.points_balance
    or new.current_tier is distinct from old.current_tier
    or new.current_streak != old.current_streak
    or new.longest_streak != old.longest_streak
    or new.visit_count != old.visit_count
    or new.last_visit_date is distinct from old.last_visit_date
    or new.last_activity_at is distinct from old.last_activity_at
    or new.joined_at != old.joined_at then
    raise exception 'customers may only change promos_opted_out';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- What scans and the apps show

create or replace function public.programme_snapshot(_user_id uuid, _business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  _b public.businesses;
  _m public.memberships;
  _spend bigint;
  _tier public.membership_tiers;
  _next public.membership_tiers;
  _level jsonb;
  _cash jsonb;
  _steps bigint;
begin
  select * into _b from public.businesses where id = _business_id;
  select * into _m from public.memberships where user_id = _user_id and business_id = _business_id;
  if _b.reward_model = 'tiers' then
    _spend := public.member_rolling_spend(_user_id, _business_id);
    select * into _tier from public.membership_tiers t
    where t.business_id = _business_id and t.spend_threshold_pence <= _spend
    order by t.spend_threshold_pence desc limit 1;
    select * into _next from public.membership_tiers t
    where t.business_id = _business_id and t.spend_threshold_pence > _spend
    order by t.spend_threshold_pence limit 1;
    return jsonb_build_object(
      'programme', 'tiers',
      'tierName', _tier.name,
      'tierPerks', coalesce(to_jsonb(_tier.perks), '[]'::jsonb),
      'rollingSpendPence', _spend,
      'nextTierName', _next.name,
      'toNextTierPence', case when _next.id is null then null else _next.spend_threshold_pence - _spend end
    );
  elsif _b.reward_model = 'points' then
    return jsonb_build_object(
      'programme', 'points',
      'pointsBalance', coalesce(_m.points_balance, 0),
      'pointsPerPound', coalesce((_b.loyalty_config ->> 'points_per_pound')::numeric, 1)
    );
  elsif _b.reward_model = 'custom' then
    _spend := public.member_rolling_spend(_user_id, _business_id);
    _level := public.custom_level(_b.programme_rules, coalesce(_m.visit_count, 0), _spend);
    _cash := _b.programme_rules->'cash_value';
    if _cash is not null and jsonb_typeof(_cash) = 'object' then
      _steps := greatest(coalesce(_m.points_balance, 0), 0) / (_cash->>'points')::bigint;
      if _cash ? 'max_pence_per_visit' then
        _steps := least(_steps, (_cash->>'max_pence_per_visit')::bigint / (_cash->>'pence')::bigint);
      end if;
    end if;
    return jsonb_build_object(
      'programme', 'custom',
      'pointsBalance', coalesce(_m.points_balance, 0),
      'unitOne', _b.programme_rules#>>'{unit,one}',
      'unitMany', _b.programme_rules#>>'{unit,many}',
      'levelName', _level->>'name',
      'levelPerks', coalesce(_level->'perks', '[]'::jsonb),
      'cashPoints', (_cash->>'points')::integer,
      'cashPence', (_cash->>'pence')::integer,
      'cashAvailablePoints', case when _steps is null then 0 else _steps * (_cash->>'points')::bigint end,
      'cashAvailablePence', case when _steps is null then 0 else _steps * (_cash->>'pence')::bigint end,
      'visitCount', coalesce(_m.visit_count, 0)
    );
  elsif _b.reward_model = 'spend_threshold' then
    return jsonb_build_object('programme', 'spend');
  end if;
  return jsonb_build_object('programme', 'stamps');
end;
$function$;

-- Customers swap points for a catalogue reward: now also at custom shops.
create or replace function public.redeem_points_reward(_business_id uuid, _catalog_id uuid, _client_ref uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _uid uuid := auth.uid();
  _business public.businesses;
  _membership public.memberships;
  _catalog public.reward_catalog;
  _existing public.points_redemptions;
  _reward_id uuid;
  _balance integer;
begin
  if _uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if _business_id is null or _catalog_id is null or _client_ref is null then
    raise exception 'invalid_arguments';
  end if;

  select * into _existing from public.points_redemptions where client_ref = _client_ref;
  if found then
    if _existing.user_id <> _uid then
      raise exception 'invalid_client_ref';
    end if;
    select points_balance into _balance from public.memberships
    where user_id = _uid and business_id = _business_id;
    return jsonb_build_object('status', 'duplicate', 'rewardId', _existing.reward_id, 'pointsBalance', _balance);
  end if;

  select * into _business from public.businesses where id = _business_id;
  if not found or _business.reward_model not in ('points', 'custom') or not _business.is_active then
    raise exception 'shop_not_points';
  end if;

  select * into _catalog from public.reward_catalog
  where id = _catalog_id and business_id = _business_id and points_cost is not null;
  if not found then
    raise exception 'reward_not_found';
  end if;

  select * into _membership from public.memberships
  where user_id = _uid and business_id = _business_id for update;
  if not found then
    raise exception 'not_a_member';
  end if;
  if _membership.points_balance < _catalog.points_cost then
    raise exception 'not_enough_points';
  end if;

  perform set_config('app.membership_trusted', 'on', true);
  update public.memberships
  set points_balance = points_balance - _catalog.points_cost
  where id = _membership.id
  returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  insert into public.rewards (user_id, business_id, title, catalog_id)
  values (_uid, _business_id, _catalog.title, _catalog.id)
  returning id into _reward_id;

  begin
    insert into public.points_redemptions (user_id, business_id, catalog_id, points, reward_id, client_ref)
    values (_uid, _business_id, _catalog.id, _catalog.points_cost, _reward_id, _client_ref);
  exception when unique_violation then
    raise exception 'duplicate_in_flight';
  end;

  insert into public.notifications (user_id, business_id, kind, title, body)
  values (_uid, _business_id, 'reward', 'Reward ready', _catalog.title || ' is ready to redeem.');

  return jsonb_build_object('status', 'redeemed', 'rewardId', _reward_id, 'pointsBalance', _balance);
end;
$function$;

-- "3 points = £1 off": staff take points off the customer's balance as money.
create or replace function public.redeem_points_for_cash(
  _business_id uuid, _customer_id uuid, _points integer, _client_ref uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  _caller uuid := auth.uid();
  _b public.businesses;
  _m public.memberships;
  _cash jsonb;
  _existing public.points_redemptions;
  _pence bigint;
  _balance integer;
  _unit text;
begin
  if _business_id is null or _customer_id is null or _client_ref is null or _points is null then
    raise exception 'invalid_arguments';
  end if;
  if not public.can_record_manual_spend(_business_id, _caller) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into _existing from public.points_redemptions where client_ref = _client_ref;
  if found then
    if _existing.user_id <> _customer_id or _existing.business_id <> _business_id or _existing.pence is null then
      raise exception 'invalid_client_ref';
    end if;
    select points_balance into _balance from public.memberships where user_id = _customer_id and business_id = _business_id;
    return jsonb_build_object('status', 'duplicate', 'pointsUsed', _existing.points, 'discountPence', _existing.pence, 'pointsBalance', _balance);
  end if;

  select * into _b from public.businesses where id = _business_id;
  _cash := _b.programme_rules->'cash_value';
  if _b.reward_model <> 'custom' or not _b.is_active or _cash is null or jsonb_typeof(_cash) <> 'object' then
    raise exception 'shop_has_no_cash_value';
  end if;
  if _points < 1 or _points % (_cash->>'points')::integer <> 0 then
    raise exception 'points_not_a_whole_step' using detail = (_cash->>'points');
  end if;
  _pence := (_points / (_cash->>'points')::integer)::bigint * (_cash->>'pence')::bigint;
  if _cash ? 'max_pence_per_visit' and _pence > (_cash->>'max_pence_per_visit')::bigint then
    raise exception 'above_visit_limit' using detail = (_cash->>'max_pence_per_visit');
  end if;

  select * into _m from public.memberships where user_id = _customer_id and business_id = _business_id for update;
  if not found then
    raise exception 'not_a_member';
  end if;
  if _m.points_balance < _points then
    raise exception 'not_enough_points';
  end if;

  perform set_config('app.membership_trusted', 'on', true);
  update public.memberships set points_balance = points_balance - _points, last_activity_at = now()
  where id = _m.id returning points_balance into _balance;
  perform set_config('app.membership_trusted', 'off', true);

  begin
    insert into public.points_redemptions (user_id, business_id, catalog_id, points, reward_id, client_ref, pence, recorded_by)
    values (_customer_id, _business_id, null, _points, null, _client_ref, _pence::integer, _caller);
  exception when unique_violation then
    raise exception 'duplicate_in_flight';
  end;

  _unit := case when _points = 1 then _b.programme_rules#>>'{unit,one}' else _b.programme_rules#>>'{unit,many}' end;
  insert into public.notifications (user_id, business_id, kind, title, body)
  values (_customer_id, _business_id, 'reward', 'Money off used',
          'You used ' || _points || ' ' || _unit || ' for £' || to_char(_pence / 100.0, 'FM999999990.00') ||
          ' off at ' || _b.name || '. You have ' || _balance || ' left.');

  return jsonb_build_object('status', 'redeemed', 'pointsUsed', _points, 'discountPence', _pence, 'pointsBalance', _balance);
end;
$$;

revoke all on function public.redeem_points_for_cash(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.redeem_points_for_cash(uuid, uuid, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Sign-up and referral bonuses

create or replace function public.grant_custom_join_bonuses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r jsonb;
  _name text;
  _referrer uuid;
  _got boolean;
  _n integer;
begin
  select programme_rules, name into _r, _name from public.businesses
  where id = new.business_id and reward_model = 'custom';
  if _r is null then
    return null;
  end if;

  _n := (_r#>>'{bonuses,signup}')::integer;
  if _n is not null then
    insert into public.programme_bonus_log (user_id, business_id, kind, period, points)
    values (new.user_id, new.business_id, 'signup', 'once', _n)
    on conflict do nothing returning true into _got;
    if _got then
      perform set_config('app.membership_trusted', 'on', true);
      update public.memberships set points_balance = points_balance + _n where id = new.id;
      perform set_config('app.membership_trusted', 'off', true);
      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Welcome to ' || _name,
              'You got ' || _n || ' ' || case when _n = 1 then _r#>>'{unit,one}' else _r#>>'{unit,many}' end || ' for joining.');
    end if;
  end if;

  _n := (_r#>>'{bonuses,referral}')::integer;
  if _n is not null then
    select referred_by into _referrer from public.profiles where id = new.user_id;
    if _referrer is not null and _referrer <> new.user_id and exists (
      select 1 from public.memberships m where m.user_id = _referrer and m.business_id = new.business_id
    ) then
      _got := false;
      insert into public.programme_bonus_log (user_id, business_id, kind, period, points)
      values (_referrer, new.business_id, 'referral:' || new.user_id::text, 'once', _n)
      on conflict do nothing returning true into _got;
      if _got then
        perform set_config('app.membership_trusted', 'on', true);
        update public.memberships set points_balance = points_balance + _n
        where user_id = _referrer and business_id = new.business_id;
        perform set_config('app.membership_trusted', 'off', true);
        insert into public.notifications (user_id, business_id, kind, title, body)
        values (_referrer, new.business_id, 'reward', 'A friend joined',
                'You got ' || _n || ' ' || case when _n = 1 then _r#>>'{unit,one}' else _r#>>'{unit,many}' end ||
                ' because a friend you invited joined ' || _name || '.');
      end if;
    end if;
  end if;
  return null;
end;
$$;

create trigger grant_custom_join_bonuses
  after insert on public.memberships
  for each row execute function public.grant_custom_join_bonuses();

revoke execute on function public.grant_custom_join_bonuses() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Expiry (daily)

create or replace function public.expire_custom_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row record;
  _count integer := 0;
begin
  perform set_config('app.membership_trusted', 'on', true);
  for _row in
    select m.id, m.user_id, m.business_id, m.points_balance, b.name, b.programme_rules r
    from public.memberships m
    join public.businesses b on b.id = m.business_id
    where b.reward_model = 'custom'
      and b.programme_rules #> '{expiry,inactive_months}' is not null
      and m.points_balance > 0
      and coalesce(m.last_activity_at, m.joined_at)
          < now() - make_interval(months => (b.programme_rules #>> '{expiry,inactive_months}')::int)
    for update of m skip locked
  loop
    update public.memberships set points_balance = 0 where id = _row.id;
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (_row.user_id, _row.business_id, 'system', initcap(_row.r#>>'{unit,many}') || ' expired',
            'Your ' || _row.points_balance || ' ' || (_row.r#>>'{unit,many}') || ' at ' || _row.name ||
            ' expired after ' || (_row.r#>>'{expiry,inactive_months}') || ' months without a visit.');
    _count := _count + 1;
  end loop;
  perform set_config('app.membership_trusted', 'off', true);
  return _count;
end;
$$;

revoke execute on function public.expire_custom_points() from public, anon, authenticated;

select cron.schedule('expire-custom-points', '15 3 * * *', $$select public.expire_custom_points()$$);

-- ---------------------------------------------------------------------
-- Owners: create a custom shop, or change a shop's custom rules

create or replace function public.create_shop_with_custom_programme(
  _name text,
  _category text,
  _country_code text,
  _rules jsonb,
  _brand_color text default '#8B7355'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _name_clean text := btrim(coalesce(_name, ''));
  _category_clean text := nullif(btrim(coalesce(_category, '')), '');
  _slug_base text;
  _slug text;
  _id uuid;
begin
  if _uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.has_role(_uid, 'business_owner') then
    raise exception 'not_a_business_owner' using errcode = '42501';
  end if;
  if char_length(_name_clean) not between 1 and 80 then
    raise exception 'invalid_name' using hint = 'Shop name must be 1 to 80 characters.';
  end if;
  if _category_clean is not null and char_length(_category_clean) > 60 then
    raise exception 'invalid_category';
  end if;
  if not exists (select 1 from public.countries where code = _country_code) then
    raise exception 'invalid_country';
  end if;
  if _brand_color is null or _brand_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid_brand_color';
  end if;
  perform public.validate_programme_rules(_rules);

  _slug_base := regexp_replace(regexp_replace(lower(_name_clean), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
  if _slug_base = '' then _slug_base := 'shop'; end if;
  _slug_base := left(_slug_base, 50);
  loop
    _slug := _slug_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    exit when not exists (select 1 from public.businesses where slug = _slug);
  end loop;

  insert into public.businesses (
    owner_id, name, slug, category, country_code, brand_color,
    reward_model, loyalty_type, loyalty_config, programme_rules
  ) values (
    _uid, _name_clean, _slug, _category_clean, _country_code, _brand_color,
    'custom', 'points', jsonb_build_object('stamps_required', 10), _rules
  ) returning id into _id;

  update public.programme_requests set business_id = _id
  where owner_id = _uid and business_id is null and created_at > now() - interval '1 day';

  return _id;
end;
$$;

revoke all on function public.create_shop_with_custom_programme(text, text, text, jsonb, text) from public, anon;
grant execute on function public.create_shop_with_custom_programme(text, text, text, jsonb, text) to authenticated;

-- Change the rules later, or move a shop with no customer progress yet to custom.
-- (lock_programme_after_activity still refuses a model change once customers have progress.)
create or replace function public.set_custom_programme(_business_id uuid, _rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null or not exists (
    select 1 from public.businesses b where b.id = _business_id
      and (b.owner_id = _uid or public.has_role(_uid, 'admin'))
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.validate_programme_rules(_rules);
  update public.businesses
  set reward_model = 'custom', loyalty_type = 'points', programme_rules = _rules
  where id = _business_id;
  -- Rewards from the shop's previous programme type no longer apply.
  delete from public.reward_catalog where business_id = _business_id and rule_key is null;
end;
$$;

revoke all on function public.set_custom_programme(uuid, jsonb) from public, anon;
grant execute on function public.set_custom_programme(uuid, jsonb) to authenticated;
