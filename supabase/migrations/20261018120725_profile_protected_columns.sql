-- profiles_update_self let customers rewrite email (used as the recipient for platform emails),
-- stamp_code (scan identifier) and referred_by via the REST API. Block direct API changes to them;
-- SECURITY DEFINER functions (e.g. apply_referral_code) run as a different current_user.
create or replace function public.enforce_profile_protected_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.email is distinct from old.email
    or new.stamp_code is distinct from old.stamp_code
    or new.referred_by is distinct from old.referred_by
  ) then
    raise exception 'email, stamp_code and referred_by cannot be changed directly';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_profile_protected_columns() from public, anon, authenticated;

drop trigger if exists enforce_profile_protected_columns on public.profiles;
create trigger enforce_profile_protected_columns
  before update on public.profiles
  for each row execute function public.enforce_profile_protected_columns();
