-- Preserve all bootstrap behaviour while honouring the signup intent.
create or replace function public.ensure_current_user_bootstrap()
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _email text; _meta jsonb; _intent text; _ref text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select email, raw_user_meta_data into _email, _meta from auth.users where id = _uid;
  _intent := _meta->>'intent'; _ref := _meta->>'ref_code';
  insert into public.profiles (id,email) values (_uid,_email) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (_uid) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id,role) values (_uid,'consumer') on conflict do nothing;
  if _intent = 'business_owner' then insert into public.user_roles(user_id,role) values(_uid,'business_owner') on conflict do nothing; end if;
  if lower(_email) in ('zahihussain92@gmail.com','flyhigher722@gmail.com','developer@the-loyalty-loop.com') then insert into public.user_roles(user_id,role) values(_uid,'admin') on conflict do nothing; end if;
  if coalesce((_meta->>'legal_accepted')::boolean,false) then insert into public.legal_acceptances(user_id,document_key,document_version) values(_uid,'terms','2026-08-07'),(_uid,'privacy','2026-08-07') on conflict do nothing; end if;
  if _ref is not null then perform public.apply_referral_code(_ref); end if;
end; $$;
