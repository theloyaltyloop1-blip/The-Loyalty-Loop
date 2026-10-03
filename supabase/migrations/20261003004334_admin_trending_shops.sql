-- Admin-chosen Trending shops. `trending` already existed but nothing read it,
-- and owners could set it on their own shop; both fields are now admin-only.
alter table public.businesses add column trending_position smallint
  check (trending_position is null or trending_position between 1 and 12);

-- Unchanged from the live definition except for the two Trending fields.
create or replace function public.enforce_businesses_update_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _is_admin boolean := public.has_role(auth.uid(), 'admin');
  _is_owner boolean := old.owner_id = auth.uid();
begin
  if _is_admin then
    return new;
  end if;

  if new.owner_id != old.owner_id
    or new.approval_status != old.approval_status
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.rejection_reason is distinct from old.rejection_reason
    or new.is_active != old.is_active
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.verification_reviewed_by is distinct from old.verification_reviewed_by
    or new.verification_rejection_reason is distinct from old.verification_rejection_reason
    or new.trending is distinct from old.trending
    or new.trending_position is distinct from old.trending_position
  then
    raise exception 'this field can only be changed by an admin';
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verification_document_path is distinct from old.verification_document_path
     or new.verification_document_label is distinct from old.verification_document_label
     or new.verification_submitted_at is distinct from old.verification_submitted_at
  then
    if not _is_owner then
      raise exception 'only the shop owner can submit verification';
    end if;
    if new.verification_status != 'pending' then
      raise exception 'owners can only submit for review';
    end if;
    if old.verification_status = 'verified' then
      raise exception 'a verified shop cannot resubmit — contact support';
    end if;
    if new.verification_document_path is null then
      raise exception 'a verification document is required';
    end if;
  end if;

  return new;
end;
$function$;

-- Replaces the whole Trending list in one go, in the given order. An empty
-- list clears it, and the apps go back to showing the first shops.
create function public.admin_set_trending(p_business_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare n integer := coalesce(cardinality(p_business_ids), 0);
begin
  if not coalesce(public.has_role(auth.uid(), 'admin'), false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if n > 12 then raise exception 'choose at most 12 trending shops'; end if;
  if exists (select 1 from unnest(p_business_ids) id where id is null) then
    raise exception 'invalid shop';
  end if;
  if (select count(distinct id) from unnest(p_business_ids) id) <> n then
    raise exception 'each shop can only appear once';
  end if;
  if (select count(*) from public.businesses b
      where b.id = any(p_business_ids) and b.is_active and b.approval_status = 'approved') <> n then
    raise exception 'only approved, active shops can trend';
  end if;
  -- Serialise concurrent saves so two admins can't interleave positions.
  perform 1 from public.businesses
    where trending or trending_position is not null or id = any(p_business_ids)
    order by id for update;
  update public.businesses set trending = false, trending_position = null
    where (trending or trending_position is not null) and not (id = any(p_business_ids));
  update public.businesses b set trending = true, trending_position = t.ord
    from unnest(p_business_ids) with ordinality as t(id, ord)
    where b.id = t.id
      and (b.trending is distinct from true or b.trending_position is distinct from t.ord);
end $$;
revoke execute on function public.admin_set_trending(uuid[]) from public, anon;
grant execute on function public.admin_set_trending(uuid[]) to authenticated;
