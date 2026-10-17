-- 1. Deleting a catalogue reward failed once any customer had earned it:
--    rewards.catalog_id referenced it with no ON DELETE action. Earned rewards
--    keep their own title, and the apps already treat an unlinked reward as a
--    plain Redeem, so unlink instead of blocking.
alter table public.rewards drop constraint if exists rewards_catalog_id_fkey;
alter table public.rewards
  add constraint rewards_catalog_id_fkey
  foreign key (catalog_id) references public.reward_catalog(id) on delete set null;

-- The rewards update guard must let that ON DELETE SET NULL through: only
-- catalog_id changes, to null, and its catalogue row is already gone.
create or replace function public.enforce_rewards_update_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _redemption_blocked_reason text;
  _is_business_owner boolean;
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if old.catalog_id is not null and new.catalog_id is null
    and (to_jsonb(new) - 'catalog_id') = (to_jsonb(old) - 'catalog_id')
    and not exists (select 1 from public.reward_catalog where id = old.catalog_id) then
    return new;
  end if;

  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.title != old.title
    or new.qr_token != old.qr_token
    or new.short_code != old.short_code
    or new.catalog_id is distinct from old.catalog_id
    or new.expires_at is distinct from old.expires_at
    or new.created_at != old.created_at then
    raise exception 'only redeemed_at may be changed';
  end if;

  if old.redeemed_at is not null then
    raise exception 'reward already redeemed';
  end if;

  if new.redeemed_at is not null
    and new.expires_at is not null
    and new.redeemed_at > new.expires_at then
    raise exception 'reward has expired';
  end if;

  if new.redeemed_at is not null and old.redeemed_at is null then
    select exists (
      select 1
      from public.businesses b
      where b.id = new.business_id
        and b.owner_id = auth.uid()
    )
    into _is_business_owner;

    if not _is_business_owner then
      select m.redemption_blocked_reason
      into _redemption_blocked_reason
      from public.memberships m
      where m.user_id = new.user_id
        and m.business_id = new.business_id
      for update;

      if not found then
        raise exception 'reward membership not found';
      end if;

      if _redemption_blocked_reason is not null then
        raise exception 'reward redemption is temporarily blocked';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- 2. Shop deletion: platform admins could not delete (owner-only lookup), and
--    every shop with uploaded images failed because Supabase now blocks direct
--    deletes from storage.objects (protect_objects_delete trigger). Image files
--    must be removed through the Storage API instead.
create or replace function public.delete_owned_business(_business_id uuid, _confirmation_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.businesses
  where id = _business_id
    and name = _confirmation_name
    and (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

  if not found then
    raise exception 'shop not found or confirmation does not match';
  end if;

  delete from public.notifications where business_id = _business_id;
  delete from public.transactions where business_id = _business_id;
  delete from public.rewards where business_id = _business_id;
  delete from public.memberships where business_id = _business_id;
  delete from public.businesses where id = _business_id;
end;
$function$;

-- 3. Several catalogue rewards at the same stamp count: the loop only ever
--    picked one of them (lowest threshold, LIMIT 1), so the others were never
--    issued. Issue every reward at the threshold being crossed.
create or replace function public.handle_stamp_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _membership public.memberships;
  _loyalty_type loyalty_type;
  _config jsonb;
  _stamps_required integer;
  _remaining integer;
  _next integer;
  _top integer;
  _tier record;
  _new_count integer;
  _crossed_any boolean := false;
  _unit text;
begin
  select * into _membership from public.memberships
    where user_id = new.user_id and business_id = new.business_id
    for update;

  if not found then
    raise exception 'customer has no membership at this business';
  end if;

  select loyalty_type into _loyalty_type from public.businesses where id = new.business_id;

  if _loyalty_type = 'points' then
    _new_count := _membership.points_balance;
    _unit := 'points';
  else
    _new_count := _membership.stamp_count;
    _unit := case when _loyalty_type = 'tiered' then 'visits' else 'stamps' end;
  end if;

  _remaining := new.value;
  _top := (select max(stamp_threshold) from public.reward_catalog where business_id = new.business_id);

  if _top is not null then
    while _remaining > 0 loop
      _next := coalesce(
        (select min(stamp_threshold) from public.reward_catalog
          where business_id = new.business_id and stamp_threshold > _new_count),
        _top);

      if _remaining < _next - _new_count then
        _new_count := _new_count + _remaining;
        _remaining := 0;
      else
        _remaining := _remaining - greatest(_next - _new_count, 0);
        _crossed_any := true;

        for _tier in
          select id, title from public.reward_catalog
          where business_id = new.business_id and stamp_threshold = _next
          order by sort_order, created_at
        loop
          insert into public.rewards (user_id, business_id, title, catalog_id)
          values (new.user_id, new.business_id, _tier.title, _tier.id);

          insert into public.notifications (user_id, business_id, kind, title, body)
          values (new.user_id, new.business_id, 'reward', 'Reward earned!', _tier.title || ' is ready to redeem.');
        end loop;

        _new_count := case when _next >= _top then 0 else _next end;
      end if;
    end loop;
  else
    _config := (select loyalty_config from public.businesses where id = new.business_id);
    _stamps_required := coalesce((_config->>'stamps_required')::integer, 10);
    _new_count := _new_count + new.value;

    if _new_count >= _stamps_required then
      _crossed_any := true;
      insert into public.rewards (user_id, business_id, title)
      values (new.user_id, new.business_id, 'Free reward');

      insert into public.notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', 'Free reward is ready to redeem.');

      _new_count := _new_count % _stamps_required;
    end if;
  end if;

  if _loyalty_type = 'points' then
    update public.memberships
      set points_balance = _new_count,
          visit_count = visit_count + 1,
          last_visit_date = (now() at time zone 'utc')::date,
          last_activity_at = now()
      where id = _membership.id;
  else
    update public.memberships
      set stamp_count = _new_count,
          visit_count = visit_count + 1,
          last_visit_date = (now() at time zone 'utc')::date,
          last_activity_at = now()
      where id = _membership.id;
  end if;

  if not _crossed_any then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id, new.business_id, 'stamp',
      case
        when _loyalty_type = 'points' then 'Points added'
        when _loyalty_type = 'tiered' then 'Visit recorded'
        else 'Stamp added'
      end,
      'You now have ' || _new_count || ' ' || _unit || '.'
    );
  end if;

  return new;
end;
$function$;
