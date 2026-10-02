-- WhatsApp stage 2, D1 approved. Existing contact/signup restoration is a
-- prerequisite. Restore the authoritative archived outbox without deleting data.
do $$ begin
  if to_regclass('public.whatsapp_outbox') is null then
    alter table whatsapp_archive.whatsapp_outbox set schema public;
  end if;
end $$;
drop trigger if exists zz_queue_whatsapp_transaction_update on public.transactions;
drop function if exists whatsapp_archive.queue_whatsapp_transaction_update();
drop function if exists public.queue_whatsapp_transaction_update();
alter table public.whatsapp_contacts add column if not exists logged_out_at timestamptz;
create function public.whatsapp_contact_relinked() returns trigger language plpgsql set search_path='' as $$
begin if new.user_id is not null and new.user_id is distinct from old.user_id then new.logged_out_at:=null; end if; return new; end $$;
create trigger whatsapp_contact_relinked before update on public.whatsapp_contacts for each row execute function public.whatsapp_contact_relinked();
revoke execute on function public.whatsapp_contact_relinked() from public,anon,authenticated;
alter table public.whatsapp_outbox
  drop constraint whatsapp_outbox_event_type_check,
  drop constraint whatsapp_outbox_status_check,
  alter column body set default '',
  add column parameters jsonb not null default '[]',
  add column attempts integer not null default 0,
  add column lease_id uuid,
  add column lease_until timestamptz,
  add column available_at timestamptz not null default now();
-- Retire old pending messages rather than converting stamp copy to spend copy.
update public.whatsapp_outbox set status='suppressed' where status='pending';
alter table public.whatsapp_outbox add constraint whatsapp_outbox_event_type_check
  check(event_type in ('visit_update','reward_redeemed','move_to_app','spend_progress','reward_ready')),
  add constraint whatsapp_outbox_status_check
  check(status in ('pending','sending','sent','failed','suppressed'));
create table public.whatsapp_dispatch_settings (
  id boolean primary key default true check(id), daily_cap integer not null default 500 check(daily_cap>=0)
);
insert into public.whatsapp_dispatch_settings default values;
create table public.whatsapp_dispatch_usage(day date primary key, attempts integer not null default 0);
alter table public.whatsapp_outbox enable row level security;
alter table public.whatsapp_dispatch_settings enable row level security;
alter table public.whatsapp_dispatch_usage enable row level security;
revoke all on public.whatsapp_outbox, public.whatsapp_dispatch_settings, public.whatsapp_dispatch_usage from public,anon,authenticated;
grant all on public.whatsapp_outbox, public.whatsapp_dispatch_settings, public.whatsapp_dispatch_usage to service_role;

-- Durable pre-send reservation prevents Meta redelivery from repeating commands.
-- Failures after reservation are acknowledged; recovery is manual, not blind replay.
create function public.reserve_whatsapp_inbound(p_id text,p_phone text,p_kind text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into public.whatsapp_contacts(phone_e164) values(p_phone) on conflict do nothing;
  perform 1 from public.whatsapp_contacts where phone_e164=p_phone for update;
  if exists(select 1 from public.whatsapp_message_log where provider_message_id=p_id) then return false; end if;
  if p_kind not in ('stop','start','logout') and
     (select count(*) from public.whatsapp_message_log where phone_e164=p_phone and direction='inbound'
      and created_at>now()-interval '24 hours' and message_kind not in ('stop','start','logout'))>=20 then return false; end if;
  insert into public.whatsapp_message_log(direction,provider_message_id,phone_e164,message_kind,provider_payload)
    values('inbound',p_id,p_phone,p_kind,'{"reserved":true}') on conflict do nothing;
  get diagnostics n=row_count; return n=1;
end $$;

create function public.queue_whatsapp_spend_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.whatsapp_contacts; b text; prog integer; tier record; payload jsonb; eid text; last_send timestamptz;
begin
  if tg_table_name='transactions' then
    if new.type::text<>'spend' or new.value<=0 then return new; end if;
    eid:='spend_progress';
  else
    if not exists(select 1 from public.reward_catalog where id=new.catalog_id and spend_threshold_pence is not null) then return new; end if;
    eid:='reward_ready';
  end if;
  select * into c from public.whatsapp_contacts where user_id=new.user_id and opted_out_at is null and logged_out_at is null for update;
  if not found then return new; end if;
  select name into b from public.businesses where id=new.business_id;
  if eid='spend_progress' then
    select reward_progress_pence into prog from public.memberships where user_id=new.user_id and business_id=new.business_id;
    select * into tier from public.spend_next_tier(new.business_id,prog);
    if tier.amount_pence is null then return new; end if;
    payload:=jsonb_build_array(b,'£'||to_char(greatest(prog,0)/100.0,'FM999999990.00'),tier.title,
      '£'||to_char(greatest(tier.amount_pence-prog,0)/100.0,'FM999999990.00'));
    update public.whatsapp_outbox set parameters=payload where user_id=new.user_id and business_id=new.business_id
      and event_type=eid and status='pending' and created_at>now()-interval '30 minutes';
    if found then return new; end if;
    select max(sent_at) into last_send from public.whatsapp_outbox where user_id=new.user_id and business_id=new.business_id and event_type=eid;
  else payload:=jsonb_build_array(new.title,b); end if;
  insert into public.whatsapp_outbox(user_id,phone_e164,business_id,event_type,parameters,available_at)
    values(new.user_id,c.phone_e164,new.business_id,eid,payload,greatest(now(),coalesce(last_send+interval '30 minutes',now())));
  begin
    perform net.http_post(url:='https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/whatsapp-dispatch',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
        (select decrypted_secret from vault.decrypted_secrets where name='WHATSAPP_DISPATCH_SECRET' limit 1)),body:='{}');
  exception when others then null; end;
  return new;
exception when others then
  -- A notification failure must never roll back financial activity; no PII in diagnostics.
  raise warning 'WhatsApp queue unavailable'; return new;
end $$;
-- zz runs after handle_spend_transaction so progress reflects the committed purchase.
create trigger zz_queue_whatsapp_spend after insert on public.transactions for each row execute function public.queue_whatsapp_spend_message();
create trigger zz_queue_whatsapp_reward after insert on public.rewards for each row execute function public.queue_whatsapp_spend_message();

create function public.claim_whatsapp_outbox() returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.whatsapp_outbox; used integer; cap integer; token uuid:=gen_random_uuid();
begin
  insert into public.whatsapp_dispatch_usage(day) values((now() at time zone 'UTC')::date) on conflict do nothing;
  select attempts into used from public.whatsapp_dispatch_usage where day=(now() at time zone 'UTC')::date for update;
  select daily_cap into cap from public.whatsapp_dispatch_settings;
  if used>=cap then return null; end if;
  -- An expired sending lease is ambiguous: never resend a possibly delivered message.
  update public.whatsapp_outbox set status='failed',error_message='delivery_unknown' where status='sending' and lease_until<now();
  update public.whatsapp_outbox o set status='suppressed' where status='pending' and not exists(
    select 1 from public.whatsapp_contacts c where c.phone_e164=o.phone_e164 and c.user_id=o.user_id and c.opted_out_at is null and c.logged_out_at is null);
  select * into item from public.whatsapp_outbox where status='pending' and available_at<=now() and attempts<3
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.whatsapp_dispatch_usage set attempts=attempts+1 where day=(now() at time zone 'UTC')::date;
  update public.whatsapp_outbox set status='sending',lease_id=token,lease_until=now()+interval '2 minutes',attempts=attempts+1
    where id=item.id returning * into item;
  return to_jsonb(item);
end $$;
create function public.finish_whatsapp_outbox(p_id uuid,p_lease uuid,p_outcome text,p_message text default null) returns void
language plpgsql security definer set search_path='' as $$
declare item public.whatsapp_outbox;
begin
  select * into item from public.whatsapp_outbox where id=p_id and lease_id=p_lease and status='sending' for update;
  if not found then return; end if;
  update public.whatsapp_outbox set status=case when p_outcome='sent' then 'sent' when p_outcome='retry' and attempts<3 then 'pending' else 'failed' end,
    provider_message_id=p_message,error_message=case when p_outcome='sent' then null else p_outcome end,
    sent_at=case when p_outcome='sent' then now() end,lease_until=null,
    available_at=now()+make_interval(secs=>60*power(2,attempts)::integer) where id=p_id;
  if p_outcome='sent' then
    insert into public.whatsapp_message_log(direction,provider_message_id,phone_e164,user_id,business_id,message_kind,provider_payload)
      values('outbound',p_message,item.phone_e164,item.user_id,item.business_id,item.event_type,jsonb_build_object('outbox_id',p_id)) on conflict do nothing;
  end if;
end $$;
revoke execute on function public.reserve_whatsapp_inbound(text,text,text),public.queue_whatsapp_spend_message(),public.claim_whatsapp_outbox(),public.finish_whatsapp_outbox(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_whatsapp_inbound(text,text,text),public.claim_whatsapp_outbox(),public.finish_whatsapp_outbox(uuid,uuid,text,text) to service_role;
-- Auth deletion must remove contacts, not leave detached phone records.
create function public.delete_whatsapp_contact() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from public.whatsapp_contacts where user_id=old.id; return old; end $$;
create trigger delete_whatsapp_contact before delete on auth.users for each row execute function public.delete_whatsapp_contact();
revoke execute on function public.delete_whatsapp_contact() from public,anon,authenticated;
