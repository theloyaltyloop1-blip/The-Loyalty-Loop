-- Supabase's anon role can retain a direct execute grant independently of
-- PUBLIC. The deletion RPC must only be reachable by signed-in users.
revoke execute on function public.delete_owned_business(uuid, text) from anon;
grant execute on function public.delete_owned_business(uuid, text) to authenticated;
