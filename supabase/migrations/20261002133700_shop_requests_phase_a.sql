-- Shop requests phase A. Contact data is accessible only to privileged RPCs.
alter table public.businesses add column google_place_id text;
create index businesses_google_place_id_idx on public.businesses(google_place_id) where google_place_id is not null;
create function public.protect_business_google_place() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.google_place_id is null) or (tg_op='UPDATE' and new.google_place_id is not distinct from old.google_place_id) then return new; end if;
 if current_setting('role',true)='service_role' or (session_user='postgres' and current_setting('role',true)='none') or coalesce(public.has_role(auth.uid(),'admin'),false) then return new; end if;
 raise exception 'Only an operator can link a Google place' using errcode='42501';
end $$;
create trigger protect_business_google_place before insert or update of google_place_id on public.businesses for each row execute function public.protect_business_google_place();
create table public.requested_shops (
  place_id text primary key, name text not null, address text not null, postcode text,
  lat double precision not null check(lat between -90 and 90), lng double precision not null check(lng between -180 and 180),
  website text, phone text, primary_type text,
  request_count integer not null default 0 check(request_count>=0),
  status text not null default 'collecting' check(status in ('collecting','ready','contacted','joined','declined','suppressed')),
  ready_at timestamptz,contacted_at timestamptz,joined_at timestamptz,
  joined_business_id uuid references public.businesses(id) on delete set null,
  email_sent_at timestamptz, email_attempted_at timestamptz, notify_error text, notify_lease_until timestamptz, notify_lease uuid,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.shop_requests (
  place_id text not null references public.requested_shops on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_notification_id uuid references public.notifications(id) on delete set null,
  joined_push_claimed_at timestamptz,
  created_at timestamptz not null default now(),primary key(place_id,user_id)
);
create index shop_requests_user_idx on public.shop_requests(user_id);
create table public.shop_request_settings(id boolean primary key default true check(id),threshold integer not null default 5 check(threshold between 1 and 10000));
insert into public.shop_request_settings default values;
-- Counters survive withdrawal: deleting votes cannot reset the daily allowance.
create table public.shop_request_usage(user_id uuid references auth.users on delete cascade, day date not null,
  requests integer not null default 0, searches integer not null default 0,primary key(user_id,day));
alter table public.requested_shops enable row level security;
alter table public.shop_requests enable row level security;
alter table public.shop_request_settings enable row level security;
alter table public.shop_request_usage enable row level security;
revoke all on public.requested_shops,public.shop_requests,public.shop_request_settings,public.shop_request_usage from public,anon,authenticated;
grant select on public.shop_requests to authenticated;
create policy shop_requests_read_own on public.shop_requests for select to authenticated using(user_id=(select auth.uid()));
grant all on public.requested_shops,public.shop_requests,public.shop_request_settings,public.shop_request_usage to service_role;

create function public.shop_request_listed(p_place jsonb) returns uuid language sql stable security definer set search_path='' as $$
 select b.id from public.businesses b where b.is_active and b.approval_status='approved' and
  (b.google_place_id=p_place->>'place_id' or
   (regexp_replace(lower(b.name),'[^a-z0-9]','','g')=regexp_replace(lower(p_place->>'name'),'[^a-z0-9]','','g')
    and b.lat is not null and b.lng is not null and
    6371000*2*asin(sqrt(least(1.0,power(sin(radians(b.lat-(p_place->>'lat')::double precision)/2),2)+
     cos(radians(b.lat))*cos(radians((p_place->>'lat')::double precision))*power(sin(radians(b.lng-(p_place->>'lng')::double precision)/2),2))))<=75)) limit 1
$$;
create function public.wake_shop_request_notify(p_place_id text,p_mode text default 'ready') returns void
language plpgsql security definer set search_path='' as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='SHOP_REQUEST_NOTIFY_SECRET' limit 1;
  if secret is null then return; end if;
  perform net.http_post(url:='https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/shop-request-notify',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
    body:=jsonb_build_object('place_id',p_place_id,'mode',p_mode),timeout_milliseconds:=30000);
exception when others then raise warning 'Shop request notification wake unavailable';
end $$;
create function public.shop_request_ready_transition() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.wake_shop_request_notify(new.place_id); return new; end $$;
create trigger shop_request_ready_transition after update of status on public.requested_shops for each row
when(old.status='collecting' and new.status='ready') execute function public.shop_request_ready_transition();
create function public.recount_shop_requests(p_place_id text default null) returns void
language plpgsql security definer set search_path='' as $$
declare item record; n integer; threshold_value integer;
begin
 select threshold into threshold_value from public.shop_request_settings;
 for item in select * from public.requested_shops where p_place_id is null or place_id=p_place_id order by place_id for update loop
  select count(*) into n from public.shop_requests where place_id=item.place_id;
  update public.requested_shops set request_count=n,updated_at=now(),
    status=case when item.status='collecting' and n>=threshold_value then 'ready' else item.status end,
    ready_at=case when item.status='collecting' and n>=threshold_value then now() else item.ready_at end where place_id=item.place_id;
 end loop;
end $$;
create function public.request_shop(p_place jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); payload text:=p_place->>'payload'; place jsonb; secret text; signature text; used integer; inserted integer; pid text;
begin
 if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
 -- Per-user lock also protects concurrent different-shop votes at the cap.
 perform 1 from auth.users where id=uid for update;
 if not found then raise exception 'account no longer exists'; end if;
 if payload is null or length(payload)>16000 then raise exception 'invalid place token'; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='SHOP_REQUEST_SIGNING_SECRET' limit 1;
 if secret is null then raise exception 'shop requests not configured'; end if;
 signature:=encode(extensions.hmac(convert_to(payload,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 if signature is distinct from p_place->>'signature' then raise exception 'invalid place token'; end if;
 place:=payload::jsonb;pid:=place->>'place_id';
 if place->>'user_id' is distinct from uid::text or (place->>'expires_at')::bigint<=extract(epoch from now())
    or (place->>'expires_at')::bigint>extract(epoch from now())+900 or place->>'country' is distinct from 'GB'
    or pid is null or length(pid)>255 or coalesce(length(place->>'name'),0)=0 or coalesce(length(place->>'address'),0)=0
    or (place->>'lat')::double precision not between -90 and 90 or (place->>'lng')::double precision not between -180 and 180
 then raise exception 'invalid place token'; end if;
 if public.shop_request_listed(place) is not null then raise exception 'shop already listed'; end if;
 insert into public.shop_request_usage(user_id,day) values(uid,(now() at time zone 'UTC')::date) on conflict do nothing;
 select requests into used from public.shop_request_usage where user_id=uid and day=(now() at time zone 'UTC')::date for update;
 if used>=10 and not exists(select 1 from public.shop_requests where place_id=pid and user_id=uid) then raise exception 'daily request limit reached'; end if;
 insert into public.requested_shops(place_id,name,address,postcode,lat,lng,website,phone,primary_type)
 values(pid,place->>'name',place->>'address',place->>'postcode',(place->>'lat')::double precision,(place->>'lng')::double precision,
  place->>'website',place->>'phone',place->>'primary_type') on conflict do nothing;
 perform 1 from public.requested_shops where place_id=pid for update;
 insert into public.shop_requests(place_id,user_id) values(pid,uid) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then update public.shop_request_usage set requests=requests+1 where user_id=uid and day=(now() at time zone 'UTC')::date; end if;
 perform public.recount_shop_requests(pid);
 return jsonb_build_object('requested',true,'count',(select request_count from public.requested_shops where place_id=pid));
end $$;
create function public.withdraw_shop_request(p_place_id text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 perform 1 from public.requested_shops where place_id=p_place_id for update;
 delete from public.shop_requests where place_id=p_place_id and user_id=auth.uid();
 perform public.recount_shop_requests(p_place_id);
 return jsonb_build_object('requested',false,'count',(select request_count from public.requested_shops where place_id=p_place_id));
end $$;
create function public.my_shop_requests() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('place_id',s.place_id,'name',s.name,'address',s.address,'count',s.request_count,
  'status',s.status,'business_id',s.joined_business_id) order by r.created_at desc),'[]'::jsonb)
 from public.shop_requests r join public.requested_shops s using(place_id) where r.user_id=auth.uid()
$$;
create function public.consume_shop_search(p_user_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.shop_request_usage(user_id,day) values(p_user_id,(now() at time zone 'UTC')::date) on conflict do nothing;
 update public.shop_request_usage set searches=searches+1 where user_id=p_user_id and day=(now() at time zone 'UTC')::date and searches<30;
 get diagnostics n=row_count;return n=1;
end $$;

-- Internal join helper; permanent suppression and joined states cannot be reset.
create function public.join_requested_shop(p_place_id text,p_business_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare item public.requested_shops; vote record; nid uuid;
begin
 select * into item from public.requested_shops where place_id=p_place_id for update;
 if not found or item.status='joined' then return; end if;
 if not exists(select 1 from public.businesses where id=p_business_id and is_active and approval_status='approved') then raise exception 'link an approved active business'; end if;
 update public.requested_shops set status='joined',joined_at=now(),joined_business_id=p_business_id,updated_at=now() where place_id=p_place_id;
 update public.businesses set google_place_id=p_place_id where id=p_business_id;
 for vote in select * from public.shop_requests where place_id=p_place_id and joined_notification_id is null loop
  insert into public.notifications(user_id,business_id,kind,title,body) values(vote.user_id,p_business_id,'system',
    item.name||' just joined', 'You asked for it. Open their shop to see their rewards.') returning id into nid;
  update public.shop_requests set joined_notification_id=nid where place_id=p_place_id and user_id=vote.user_id;
 end loop;
 perform public.wake_shop_request_notify(p_place_id,'joined');
end $$;
create function public.admin_shop_requests() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.has_role(auth.uid(),'admin'),false) then raise exception 'not allowed'; end if;
 return jsonb_build_object('threshold',(select threshold from public.shop_request_settings),
  'shops',(select coalesce(jsonb_agg(to_jsonb(s)-'notify_lease'-'notify_lease_until' order by s.request_count desc,s.created_at),'[]'::jsonb) from public.requested_shops s));
end $$;
create function public.admin_set_shop_request(p_place_id text,p_status text,p_business_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare old_status text;
begin
 if not coalesce(public.has_role(auth.uid(),'admin'),false) then raise exception 'not allowed'; end if;
 select status into old_status from public.requested_shops where place_id=p_place_id for update;
 if old_status='joined' then return; end if;
 if p_status='joined' then perform public.join_requested_shop(p_place_id,p_business_id); return; end if;
 if old_status='suppressed' and p_status<>'suppressed' then raise exception 'suppression is permanent'; end if;
 if p_status not in ('collecting','ready','contacted','declined','suppressed') then raise exception 'invalid status'; end if;
 if p_status='collecting' and old_status<>'collecting' then raise exception 'cannot reset outreach'; end if;
 update public.requested_shops set status=p_status,contacted_at=case when p_status='contacted' then coalesce(contacted_at,now()) else contacted_at end,
  ready_at=case when p_status='ready' then coalesce(ready_at,now()) else ready_at end,
  updated_at=now() where place_id=p_place_id;
 -- Only a collecting -> ready transition wakes; re-setting later status never re-emails.
end $$;
create function public.admin_set_shop_request_threshold(p_threshold integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.has_role(auth.uid(),'admin'),false) then raise exception 'not allowed'; end if;
 update public.shop_request_settings set threshold=p_threshold;perform public.recount_shop_requests();
end $$;
create function public.approve_requested_shop() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.google_place_id is not null and new.is_active and new.approval_status='approved' then
  perform public.join_requested_shop(new.google_place_id,new.id);
 end if; return new;
end $$;
create trigger approve_requested_shop after insert or update of google_place_id,approval_status,is_active on public.businesses
for each row execute function public.approve_requested_shop();

-- One email claim per ready transition, with Resend's stable idempotency key.
create function public.claim_shop_request_notify(p_place_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.requested_shops; token uuid:=gen_random_uuid();
begin
 select * into item from public.requested_shops where place_id=p_place_id for update;
 if not found or item.status<>'ready' or item.email_attempted_at is not null then return null; end if;
 update public.requested_shops set notify_lease=token,email_attempted_at=now(),notify_lease_until=now()+interval '2 minutes' where place_id=p_place_id;
 return (to_jsonb(item)-'notify_lease'-'notify_lease_until')||jsonb_build_object('lease',token);
end $$;
create function public.finish_shop_request_notify(p_place_id text,p_lease uuid,p_sent boolean) returns void language sql security definer set search_path='' as $$
 update public.requested_shops set email_sent_at=case when p_sent then now() else email_sent_at end,notify_error=case when p_sent then null else 'email_not_confirmed' end,notify_lease_until=null
 where place_id=p_place_id and notify_lease=p_lease
$$;
-- Expo has no idempotency key: reserve before sending to prevent duplicate pushes
-- on concurrent wakes. Ambiguous/crashed deliveries require manual investigation.
create function public.claim_shop_request_push(p_notification_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare vote public.shop_requests; item public.notifications;
begin
 update public.shop_requests set joined_push_claimed_at=now() where joined_notification_id=p_notification_id and joined_push_claimed_at is null returning * into vote;
 if not found then return null; end if;
 select * into item from public.notifications where id=p_notification_id and user_id=vote.user_id;
 return to_jsonb(item);
end $$;

revoke execute on function public.protect_business_google_place(),public.shop_request_ready_transition(),public.shop_request_listed(jsonb),public.wake_shop_request_notify(text,text),public.recount_shop_requests(text),
 public.request_shop(jsonb),public.withdraw_shop_request(text),public.my_shop_requests(),public.consume_shop_search(uuid),
 public.join_requested_shop(text,uuid),public.admin_shop_requests(),public.admin_set_shop_request(text,text,uuid),public.admin_set_shop_request_threshold(integer),
 public.approve_requested_shop(),public.claim_shop_request_notify(text),public.finish_shop_request_notify(text,uuid,boolean),public.claim_shop_request_push(uuid) from public,anon,authenticated;
grant execute on function public.request_shop(jsonb),public.withdraw_shop_request(text),public.my_shop_requests(),public.admin_shop_requests(),
 public.admin_set_shop_request(text,text,uuid),public.admin_set_shop_request_threshold(integer) to authenticated;
grant execute on function public.shop_request_listed(jsonb),public.recount_shop_requests(text),public.consume_shop_search(uuid),
 public.claim_shop_request_notify(text),public.finish_shop_request_notify(text,uuid,boolean),public.claim_shop_request_push(uuid) to service_role;
