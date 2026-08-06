-- Harden §0-1 functions per advisor output: pin search_path, move pg_net out
-- of public, and restrict RPC exposure of internal/trigger-only functions.

alter function public.gen_short_code() set search_path = public;
alter function public.ensure_profile_stamp_code() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

drop extension if exists pg_net;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;

revoke execute on function public.ensure_current_user_bootstrap() from public, anon;
grant execute on function public.ensure_current_user_bootstrap() to authenticated;
