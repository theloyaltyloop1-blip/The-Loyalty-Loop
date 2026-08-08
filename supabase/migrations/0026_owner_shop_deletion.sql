-- A deliberately guarded, owner-only destructive operation. It is an RPC
-- rather than a browser-side delete so every dependent loyalty record is
-- removed in the correct order and ownership is checked server-side.
create or replace function public.delete_owned_business(
  _business_id uuid,
  _confirmation_name text
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  _document_path text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select verification_document_path into _document_path
  from public.businesses
  where id = _business_id
    and owner_id = auth.uid()
    and name = _confirmation_name;

  if not found then
    raise exception 'shop not found or confirmation does not match';
  end if;

  -- These relationships intentionally preserve data under normal operation,
  -- so they must be removed before the shop row can be deleted.
  delete from public.notifications where business_id = _business_id;
  delete from public.transactions where business_id = _business_id;
  delete from public.rewards where business_id = _business_id;
  delete from public.memberships where business_id = _business_id;

  -- Clear uploaded shop images as well as their database records.
  delete from storage.objects
  where (bucket_id in ('logos', 'covers', 'gallery') and name like _business_id::text || '/%')
     or (bucket_id = 'owner_verification_docs' and _document_path is not null and name = _document_path);

  delete from public.businesses where id = _business_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.delete_owned_business(uuid, text) from public;
revoke execute on function public.delete_owned_business(uuid, text) from anon;
grant execute on function public.delete_owned_business(uuid, text) to authenticated;
