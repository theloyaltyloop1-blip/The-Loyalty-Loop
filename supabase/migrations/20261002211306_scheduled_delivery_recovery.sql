-- Shop requests only. WhatsApp/Fidel jobs await their separately authorized release.
create extension if not exists pg_cron;
create function public.sweep_shop_request_notifications() returns integer language plpgsql security definer set search_path='' as $$
declare item record; n integer:=0;
begin
 for item in select s.place_id,s.status from public.requested_shops s where
  (s.status='ready' and s.email_attempted_at is null) or (s.status='joined' and exists(select 1 from public.shop_requests r where r.place_id=s.place_id and r.joined_notification_id is not null and r.joined_push_claimed_at is null))
  order by s.updated_at limit 20 loop
  perform public.wake_shop_request_notify(item.place_id,case when item.status='joined' then 'joined' else 'ready' end);n:=n+1;
 end loop;return n;
end $$;
create function public.scheduled_jobs_health() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if to_regclass('cron.job') is null then return jsonb_build_object('ok',false,'detail','Cron is not installed'); end if;
 select jsonb_build_object('ok',coalesce(j.active and r.status='succeeded' and r.start_time>now()-interval '5 minutes',false),
 'detail','Shop-request recovery: '||coalesce(r.status,'no recent run')) into result from cron.job j
 left join lateral(select status,start_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1) r on true
 where j.jobname='shop-request-delivery-recovery';
 return coalesce(result,jsonb_build_object('ok',false,'detail','Shop-request recovery job missing'));
end $$;
revoke execute on function public.sweep_shop_request_notifications(),public.scheduled_jobs_health() from public,anon,authenticated;
grant execute on function public.sweep_shop_request_notifications(),public.scheduled_jobs_health() to service_role;
select cron.schedule('shop-request-delivery-recovery','* * * * *', $$select public.sweep_shop_request_notifications()$$);
