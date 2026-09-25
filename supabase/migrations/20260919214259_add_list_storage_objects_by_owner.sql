create or replace function public.list_storage_objects_by_owner(p_owner uuid)
returns table (bucket_id text, name text)
language sql
security definer
set search_path = public, storage
as $$
  select bucket_id, name from storage.objects where owner = p_owner;
$$;

revoke all on function public.list_storage_objects_by_owner(uuid) from public, anon, authenticated;
grant execute on function public.list_storage_objects_by_owner(uuid) to service_role;;
