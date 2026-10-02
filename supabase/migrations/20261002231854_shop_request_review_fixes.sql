-- Forward-only fixes for the live shop-request release. No other jobs change.
alter table public.requested_shops
 add column notify_attempts integer not null default 0 check (notify_attempts between 0 and 5),
 add column next_attempt_at timestamptz default now();

-- Reserve a provider attempt before any network call. Concurrent wakes skip it.
create function public.begin_shop_request_notify(p_place_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.requested_shops; attempt integer;
begin
 select * into item from public.requested_shops where place_id=p_place_id for update;
 if not found or item.status<>'ready' or item.email_attempted_at is not null
   or item.notify_attempts>=5 or item.next_attempt_at is null or item.next_attempt_at>now() then return null; end if;
 attempt:=item.notify_attempts+1;
 update public.requested_shops set notify_attempts=attempt,
  next_attempt_at=case attempt when 1 then now()+interval '1 minute' when 2 then now()+interval '10 minutes'
   when 3 then now()+interval '1 hour' when 4 then now()+interval '6 hours' else null end,
  notify_error=case when attempt=5 then 'notify_attempts_exhausted' else 'notify_retry_pending' end
 where place_id=p_place_id;
 return jsonb_build_object('attempt',attempt);
end $$;
revoke all on function public.begin_shop_request_notify(text) from public,anon,authenticated;
grant execute on function public.begin_shop_request_notify(text) to service_role;

create or replace function public.sweep_shop_request_notifications() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; n integer:=0;
begin
 for item in select s.place_id,s.status from public.requested_shops s where
  (s.status='ready' and s.email_attempted_at is null and s.notify_attempts<5 and s.next_attempt_at<=now())
  or (s.status='joined' and exists(select 1 from public.shop_requests r where r.place_id=s.place_id
   and r.joined_notification_id is not null and r.joined_push_claimed_at is null))
  order by s.updated_at,s.place_id limit 20 loop
  perform public.wake_shop_request_notify(item.place_id,case when item.status='joined' then 'joined' else 'ready' end);n:=n+1;
 end loop;return n;
end $$;

-- F2: viewing requested shops uses its own details budget, never the search caps.
alter table public.shop_request_usage add column details integer not null default 0;
alter table public.shop_search_global_usage add column details integer not null default 0;
alter table public.shop_request_settings add column global_details_cap integer not null default 2000 check (global_details_cap between 1 and 100000);
-- Reserves all p_count lookups or none. Admins skip only the personal cap.
create function public.consume_shop_details(p_user_id uuid,p_count integer,p_admin boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare user_n integer; global_n integer; cap integer; d date:=(now() at time zone 'UTC')::date;
begin
 if p_count is null or p_count<1 or p_count>50 then return false; end if;
 select global_details_cap into cap from public.shop_request_settings;
 insert into public.shop_search_global_usage(day) values(d) on conflict do nothing;
 select details into global_n from public.shop_search_global_usage where day=d for update;
 insert into public.shop_request_usage(user_id,day) values(p_user_id,d) on conflict do nothing;
 select details into user_n from public.shop_request_usage where user_id=p_user_id and day=d for update;
 if global_n+p_count>cap or (not p_admin and user_n+p_count>60) then return false; end if;
 update public.shop_search_global_usage set details=details+p_count where day=d;
 update public.shop_request_usage set details=details+p_count where user_id=p_user_id and day=d;
 return true;
end $$;
revoke all on function public.consume_shop_details(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.consume_shop_details(uuid,integer,boolean) to service_role;

-- F3: recount only the deleted rows' shops, locking them in place_id order.
drop trigger recount_deleted_shop_requests on public.shop_requests;
create or replace function public.recount_deleted_shop_requests() returns trigger language plpgsql security definer set search_path='' as $$
declare pid text;
begin
 for pid in select distinct place_id from deleted_shop_requests order by place_id loop
  perform public.recount_shop_requests(pid);
 end loop;
 return null;
end $$;
create trigger recount_deleted_shop_requests after delete on public.shop_requests
 referencing old table as deleted_shop_requests for each statement execute function public.recount_deleted_shop_requests();
-- The delete trigger recounts; the user-row lock still serialises one user's actions.
create or replace function public.withdraw_shop_request(p_place_id text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 delete from public.shop_requests where place_id=p_place_id and user_id=auth.uid();
 return jsonb_build_object('requested',false,'count',(select request_count from public.requested_shops where place_id=p_place_id));
end $$;
