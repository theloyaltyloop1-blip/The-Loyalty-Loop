create or replace function public.admin_assert()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'admin only'; end if;
end; $$;
revoke all on function public.admin_assert() from public, anon;
grant execute on function public.admin_assert() to authenticated;
