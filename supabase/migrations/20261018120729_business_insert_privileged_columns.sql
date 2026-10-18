-- businesses_insert_self_owner let an owner create a shop with admin-only columns preset
-- (verification_status = 'verified' shows a public badge; trending puts it on the home feed).
-- enforce_businesses_update_scope only guards UPDATE. Reset these on direct API inserts.
create or replace function public.enforce_business_insert_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role(auth.uid(), 'admin') then
    new.verification_status := 'unverified';
    new.verification_submitted_at := null;
    new.verification_reviewed_at := null;
    new.verification_reviewed_by := null;
    new.verification_rejection_reason := null;
    new.verification_document_path := null;
    new.verification_document_label := null;
    new.trending := false;
    new.trending_position := null;
    new.approved_at := null;
    new.approved_by := null;
    new.rejection_reason := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_business_insert_defaults() from public, anon, authenticated;

drop trigger if exists enforce_business_insert_defaults on public.businesses;
create trigger enforce_business_insert_defaults
  before insert on public.businesses
  for each row execute function public.enforce_business_insert_defaults();
