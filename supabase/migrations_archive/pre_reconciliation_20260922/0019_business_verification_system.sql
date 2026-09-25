-- §3/§6 Business verification: proof-of-business doc upload (private bucket)
-- -> admin review -> verified badge. See docs/LOYALTY-LOOP-DATA-MODEL.md §8, §7.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('owner_verification_docs', 'owner_verification_docs', false, 10485760,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "verification_docs_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'owner_verification_docs'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

create policy "verification_docs_owner_or_admin_read"
  on storage.objects for select
  using (
    bucket_id = 'owner_verification_docs'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "verification_docs_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'owner_verification_docs'
    and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- Real gap found while building this: businesses_update_owner_or_admin RLS
-- lets an owner UPDATE any column on their own row, including
-- verification_status — nothing was stopping an owner from just setting
-- their own shop to 'verified' via a raw client update. This trigger locks
-- the review fields to admin-only, and separately scopes what an owner may
-- do when *submitting* a verification request (move unverified/rejected ->
-- pending, with a real document attached — nothing else).
create or replace function public.enforce_businesses_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create trigger enforce_businesses_update_scope
  before update on public.businesses
  for each row execute function public.enforce_businesses_update_scope();

-- ---------------------------------------------------------------------
create or replace function public.submit_business_verification(_business_id uuid, _doc_path text, _doc_label text)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  _result public.businesses;
begin
  if not exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid()) then
    raise exception 'not your business';
  end if;

  update public.businesses
  set verification_status = 'pending',
      verification_document_path = _doc_path,
      verification_document_label = _doc_label,
      verification_submitted_at = now()
  where id = _business_id
  returning * into _result;

  return _result;
end;
$$;

grant execute on function public.submit_business_verification(uuid, text, text) to authenticated;

create or replace function public.admin_pending_business_verifications()
returns table (
  id uuid,
  name text,
  slug text,
  category text,
  owner_id uuid,
  owner_email text,
  verification_document_path text,
  verification_document_label text,
  verification_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  return query
    select b.id, b.name, b.slug, b.category, b.owner_id, p.email,
           b.verification_document_path, b.verification_document_label, b.verification_submitted_at
    from public.businesses b
    left join public.profiles p on p.id = b.owner_id
    where b.verification_status = 'pending'
    order by b.verification_submitted_at asc nulls last;
end;
$$;

grant execute on function public.admin_pending_business_verifications() to authenticated;

create or replace function public.admin_review_business_verification(_business_id uuid, _approve boolean, _reason text default null)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  _result public.businesses;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  update public.businesses
  set verification_status = case when _approve then 'verified' else 'rejected' end,
      verification_reviewed_at = now(),
      verification_reviewed_by = auth.uid(),
      verification_rejection_reason = case when _approve then null else _reason end
  where id = _business_id
  returning * into _result;

  if _result.id is null then
    raise exception 'business not found';
  end if;

  return _result;
end;
$$;

grant execute on function public.admin_review_business_verification(uuid, boolean, text) to authenticated;
