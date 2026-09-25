-- Admin bootstrap email is zahihussain92@gmail.com (see 0001/0002 for the
-- functions this touches). Retroactively grant admin to that account since
-- it already existed before this was settled.
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where lower(email) = 'zahihussain92@gmail.com'
on conflict (user_id, role) do nothing;
