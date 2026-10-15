-- ALREADY EXECUTED on 2026-10-15 against The Loyalty Loop (tgukdabfvvoywawmzbdo). DO NOT RUN AGAIN.
-- The apps are live, so a rerun would delete real sign-ups. The guard below makes a rerun fail
-- before anything is changed. Kept only as the record of what was run.
begin;
do $guard$ begin raise exception 'This wipe was already executed on 2026-10-15. Refusing to run again.'; end $guard$;
-- (original script follows; unreachable because the guard above always raises)
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table auth.users in share row exclusive mode;
do $wipe$
declare
 targets text; r record; n bigint; before_users bigint; deleted_users bigint; tables_count integer;
 preserved text[] := array['shop_request_settings','whatsapp_dispatch_settings','fidel_retired_metadata_ids','admin_laptop_backups'];
begin
 select string_agg(format('%I.%I',schemaname,tablename),', ' order by schemaname,tablename),count(*) into targets,tables_count
 from pg_tables where schemaname in ('public','whatsapp_archive','business_activation_private')
 and not (schemaname='public' and tablename=any(preserved));
 execute 'lock table '||targets||' in access exclusive mode';
 lock table public.shop_request_settings,public.whatsapp_dispatch_settings,public.fidel_retired_metadata_ids,public.admin_laptop_backups in access exclusive mode;
 create temp table wipe_admin_ids on commit drop as select distinct u.id from auth.users u join public.user_roles ur on ur.user_id=u.id where ur.role='admin';
 if (select count(*) from wipe_admin_ids) <> 2 then raise exception 'Expected two admins'; end if;
 create temp table wipe_admin_profiles on commit drop as select p.* from public.profiles p join wipe_admin_ids a on a.id=p.id;
 create temp table wipe_admin_roles on commit drop as select p.* from public.user_roles p join wipe_admin_ids a on a.id=p.user_id;
 create temp table wipe_admin_settings on commit drop as select p.* from public.user_settings p join wipe_admin_ids a on a.id=p.user_id;
 create temp table wipe_kept on commit drop as select t::text name,'[]'::jsonb rows from unnest(preserved)t;
 for r in select * from wipe_kept loop
 execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',r.name) into r.rows;
 update wipe_kept set rows=r.rows where name=r.name;
 end loop;
 select count(*) into before_users from auth.users;
 execute 'truncate table '||targets||' restrict';
 delete from auth.users u where not exists(select 1 from wipe_admin_ids a where a.id=u.id);
 get diagnostics deleted_users=row_count;
 insert into public.profiles select * from wipe_admin_profiles;
 insert into public.user_roles select * from wipe_admin_roles;
 insert into public.user_settings select * from wipe_admin_settings;
 -- Profile restoration generates referral codes; these are app test data too.
 delete from public.referral_codes;
 if exists((select * from public.profiles except select * from wipe_admin_profiles) union all (select * from wipe_admin_profiles except select * from public.profiles)) then raise exception 'Admin profiles differ'; end if;
 if exists((select * from public.user_roles except select * from wipe_admin_roles) union all (select * from wipe_admin_roles except select * from public.user_roles)) then raise exception 'Admin roles differ'; end if;
 if exists((select * from public.user_settings except select * from wipe_admin_settings) union all (select * from wipe_admin_settings except select * from public.user_settings)) then raise exception 'Admin settings differ'; end if;
 if exists((select id from auth.users except select id from wipe_admin_ids) union all (select id from wipe_admin_ids except select id from auth.users)) then raise exception 'Auth survivors differ'; end if;
 for r in select * from wipe_kept loop
 execute format('select count(*) from (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) j from public.%I t) s where s.j is distinct from $1',r.name) into n using r.rows;
 if n<>0 then raise exception 'Protected table changed: %',r.name; end if;
 end loop;
 for r in select schemaname,tablename from pg_tables where schemaname in ('public','whatsapp_archive','business_activation_private') and not(schemaname='public' and tablename=any(preserved||array['profiles','user_roles','user_settings'])) loop
 execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into n;
 if n<>0 then raise exception 'App table not empty: %.% (% rows)',r.schemaname,r.tablename,n; end if;
 end loop;
 create temp table wipe_result on commit drop as select tables_count as tables_cleared, before_users as logins_before,deleted_users as logins_deleted,(select count(*) from auth.users) as admin_logins_preserved, true as final_checks_passed;
end $wipe$;
select * from wipe_result;
commit;
