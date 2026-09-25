-- delete-my-account looks up a user's storage.objects rows to remove their
-- files before deleting the auth user. That schema-scoped REST call
-- (`admin.schema('storage').from('objects')...`) 406'd for every account,
-- because 'storage' isn't in this project's PostgREST exposed-schemas list —
-- it silently blocked account deletion for every shopper. This SECURITY
-- DEFINER function is called via RPC instead, which bypasses that restriction
-- entirely regardless of the exposed-schemas config.
create or replace function public.list_storage_objects_by_owner(p_owner uuid)
returns table (bucket_id text, name text)
language sql
security definer
set search_path = public, storage
as $$
  select bucket_id, name from storage.objects where owner = p_owner;
$$;

revoke all on function public.list_storage_objects_by_owner(uuid) from public, anon, authenticated;
grant execute on function public.list_storage_objects_by_owner(uuid) to service_role;
