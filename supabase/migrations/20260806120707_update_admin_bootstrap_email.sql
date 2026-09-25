create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'consumer')
  on conflict (user_id, role) do nothing;

  if lower(new.email) = 'zahihussain92@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.ensure_current_user_bootstrap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select email into _email from auth.users where id = _uid;

  insert into public.profiles (id, email)
  values (_uid, _email)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (_uid)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (_uid, 'consumer')
  on conflict (user_id, role) do nothing;

  if lower(_email) = 'zahihussain92@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (_uid, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
end;
$$;

-- Retroactively grant admin to the account matching the (now-updated)
-- hardcoded bootstrap email, since it already exists.
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where lower(email) = 'zahihussain92@gmail.com'
on conflict (user_id, role) do nothing;
;
