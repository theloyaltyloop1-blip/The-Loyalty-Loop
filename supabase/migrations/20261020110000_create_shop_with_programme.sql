-- Onboarding: create a shop, its programme and its rewards/tiers in ONE transaction.
-- Needs 20261020100000_programme_tiers_points.sql (reward models 'tiers'/'points',
-- membership_tiers, reward_catalog.points_cost).
--
-- Replaces the app's separate "insert business" then "insert rewards" calls, which
-- could leave a half-created shop. The caller becomes the owner. The ordinary
-- BEFORE INSERT triggers on businesses still run (enforce_business_insert_defaults,
-- country amount checks); because this function is SECURITY DEFINER it also checks
-- for the business_owner role itself, since the insert policy is bypassed.

create or replace function public.create_shop_with_programme(
  _name text,
  _category text,
  _country_code text,
  _programme text,                -- 'stamps' | 'spend' | 'tiers' | 'points'
  _brand_color text default '#8B7355',
  _stamps_required integer default 10,
  _points_per_pound integer default 1,
  _rewards jsonb default '[]'::jsonb, -- [{title, description?, stamp_threshold?, spend_threshold_pence?, points_cost?}]
  _tiers jsonb default '[]'::jsonb    -- [{name, spend_threshold_pence, perks?: text[], colour?}]
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
  _model text;
  _config jsonb;
  _item jsonb;
  _i integer := 0;
  _n integer;
  _title text;
  _threshold bigint;
  _perks text[];
  _colour text;
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
  if _programme not in ('stamps', 'spend', 'tiers', 'points') then
    raise exception 'invalid_programme';
  end if;
  if jsonb_typeof(coalesce(_rewards, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(_tiers, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_payload';
  end if;

  _model := case _programme
    when 'stamps' then 'stamp_legacy'
    when 'spend' then 'spend_threshold'
    else _programme
  end;
  _config := '{}'::jsonb;

  -- ---- validate the programme payload before writing anything -------------
  if _programme = 'tiers' then
    _n := jsonb_array_length(_tiers);
    if _n not between 1 and 8 then
      raise exception 'invalid_tier_count' using hint = 'Add between 1 and 8 membership levels.';
    end if;
    if jsonb_array_length(_rewards) <> 0 then
      raise exception 'invalid_payload' using hint = 'Membership tiers shops do not take rewards.';
    end if;
    for _item in select * from jsonb_array_elements(_tiers) loop
      if jsonb_typeof(_item) <> 'object' then raise exception 'invalid_payload'; end if;
      if char_length(btrim(coalesce(_item->>'name', ''))) not between 1 and 40 then
        raise exception 'invalid_tier_name';
      end if;
      begin
        _threshold := (_item->>'spend_threshold_pence')::bigint;
      exception when others then
        raise exception 'invalid_tier_threshold';
      end;
      if _threshold is null or _threshold not between 0 and 100000000 then
        raise exception 'invalid_tier_threshold';
      end if;
      if _item ? 'perks' and jsonb_typeof(_item->'perks') <> 'array' then
        raise exception 'invalid_tier_perks';
      end if;
      if jsonb_array_length(coalesce(_item->'perks', '[]'::jsonb)) > 6
         or exists (
           select 1 from jsonb_array_elements(coalesce(_item->'perks', '[]'::jsonb)) p
           where jsonb_typeof(p) <> 'string' or char_length(p #>> '{}') > 80
         ) then
        raise exception 'invalid_tier_perks';
      end if;
      _colour := nullif(_item->>'colour', '');
      if _colour is not null and _colour !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'invalid_tier_colour';
      end if;
    end loop;
    if (select count(distinct (t->>'spend_threshold_pence')::bigint) from jsonb_array_elements(_tiers) t) <> _n then
      raise exception 'duplicate_tier_threshold' using hint = 'Each level needs a different spend amount.';
    end if;
  else
    if jsonb_array_length(_tiers) <> 0 then
      raise exception 'invalid_payload' using hint = 'Only membership tiers shops take tiers.';
    end if;
    _n := jsonb_array_length(_rewards);
    if _n not between 1 and 10 then
      raise exception 'invalid_reward_count' using hint = 'Add between 1 and 10 rewards.';
    end if;
    for _item in select * from jsonb_array_elements(_rewards) loop
      if jsonb_typeof(_item) <> 'object' then raise exception 'invalid_payload'; end if;
      if char_length(btrim(coalesce(_item->>'title', ''))) not between 1 and 80 then
        raise exception 'invalid_reward_title';
      end if;
      if char_length(coalesce(_item->>'description', '')) > 200 then
        raise exception 'invalid_reward_description';
      end if;
      begin
        _threshold := case _programme
          when 'stamps' then (_item->>'stamp_threshold')::bigint
          when 'spend' then (_item->>'spend_threshold_pence')::bigint
          else (_item->>'points_cost')::bigint
        end;
      exception when others then
        raise exception 'invalid_reward_threshold';
      end;
      if _threshold is null or _threshold < 1
         or _threshold > case _programme when 'stamps' then 100 else 100000000 end then
        raise exception 'invalid_reward_threshold';
      end if;
    end loop;
    if _programme in ('spend', 'points') and
       (select count(distinct case _programme when 'spend' then (r->>'spend_threshold_pence') else (r->>'points_cost') end)
          from jsonb_array_elements(_rewards) r) <> _n then
      raise exception 'duplicate_reward_threshold' using hint = 'Each reward needs a different amount.';
    end if;
  end if;

  if _programme = 'stamps' then
    if _stamps_required is null or _stamps_required not between 1 and 100 then
      raise exception 'invalid_stamps_required';
    end if;
    _config := jsonb_build_object('stamps_required', _stamps_required);
  elsif _programme = 'points' then
    if _points_per_pound is null or _points_per_pound not between 1 and 1000 then
      raise exception 'invalid_points_per_pound';
    end if;
    _config := jsonb_build_object('stamps_required', 10, 'points_per_pound', _points_per_pound);
  else
    _config := jsonb_build_object('stamps_required', 10);
  end if;

  -- ---- unique slug ---------------------------------------------------------
  _slug_base := regexp_replace(regexp_replace(lower(_name_clean), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
  if _slug_base = '' then _slug_base := 'shop'; end if;
  _slug_base := left(_slug_base, 50);
  loop
    _slug := _slug_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    exit when not exists (select 1 from public.businesses where slug = _slug);
  end loop;

  -- ---- write everything (one transaction: this function call) -------------
  insert into public.businesses (
    owner_id, name, slug, category, country_code, brand_color,
    reward_model, loyalty_type, loyalty_config
  ) values (
    _uid, _name_clean, _slug, _category_clean, _country_code, _brand_color,
    _model, 'stamp_card', _config
  ) returning id into _id;

  if _programme = 'tiers' then
    for _item in select * from jsonb_array_elements(_tiers) loop
      select coalesce(array_agg(btrim(p #>> '{}')) filter (where btrim(p #>> '{}') <> ''), '{}')
        into _perks
        from jsonb_array_elements(coalesce(_item->'perks', '[]'::jsonb)) p;
      insert into public.membership_tiers (business_id, name, spend_threshold_pence, perks, colour, sort_order)
      values (
        _id, btrim(_item->>'name'), (_item->>'spend_threshold_pence')::integer,
        _perks, nullif(_item->>'colour', ''), _i
      );
      _i := _i + 1;
    end loop;
  else
    for _item in select * from jsonb_array_elements(_rewards) loop
      insert into public.reward_catalog (
        business_id, title, description, stamp_threshold, spend_threshold_pence, points_cost, sort_order
      ) values (
        _id,
        btrim(_item->>'title'),
        nullif(btrim(coalesce(_item->>'description', '')), ''),
        case _programme
          when 'stamps' then (_item->>'stamp_threshold')::integer
          when 'spend' then 10
          else 1
        end,
        case when _programme = 'spend' then (_item->>'spend_threshold_pence')::integer end,
        case when _programme = 'points' then (_item->>'points_cost')::integer end,
        _i
      );
      _i := _i + 1;
    end loop;
  end if;

  return _id;
end;
$$;

revoke all on function public.create_shop_with_programme(text, text, text, text, text, integer, integer, jsonb, jsonb) from public, anon;
grant execute on function public.create_shop_with_programme(text, text, text, text, text, integer, integer, jsonb, jsonb) to authenticated;
