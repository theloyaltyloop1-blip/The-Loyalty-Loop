-- Admin-only controls and immutable audit trail for the Access Panel.
create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null,
  target_type text not null, target_id text, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.platform_audit_log enable row level security;
create policy "platform_audit_admin_read" on public.platform_audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));
grant select on public.platform_audit_log to authenticated;

create or replace function public.admin_set_role(_email text, _role app_role, _grant boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare _target uuid;
begin
 if not public.has_role(auth.uid(),'admin') then raise exception 'admin only'; end if;
 select id into _target from auth.users where lower(email)=lower(trim(_email)); if _target is null then raise exception 'user not found'; end if;
 if _grant then insert into public.user_roles(user_id,role) values(_target,_role) on conflict do nothing; else delete from public.user_roles where user_id=_target and role=_role; end if;
 insert into public.platform_audit_log(actor_id,action,target_type,target_id,detail) values(auth.uid(),case when _grant then 'role_granted' else 'role_revoked' end,'user',_target::text,jsonb_build_object('email',lower(trim(_email)),'role',_role));
 return true;
end; $$;
revoke all on function public.admin_set_role(text,app_role,boolean) from public; grant execute on function public.admin_set_role(text,app_role,boolean) to authenticated;

create or replace function public.admin_set_business_status(_business_id uuid,_status business_approval_status,_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin if not public.has_role(auth.uid(),'admin') then raise exception 'admin only'; end if;
 update public.businesses set approval_status=_status, rejection_reason=case when _status='rejected' then _reason else null end, approved_at=case when _status='approved' then now() else approved_at end, approved_by=auth.uid() where id=_business_id;
 insert into public.platform_audit_log(actor_id,action,target_type,target_id,detail) values(auth.uid(),'listing_status','business',_business_id::text,jsonb_build_object('status',_status,'reason',_reason));
end; $$;
revoke all on function public.admin_set_business_status(uuid,business_approval_status,text) from public; grant execute on function public.admin_set_business_status(uuid,business_approval_status,text) to authenticated;

create or replace function public.admin_override_loyalty_threshold(_business_id uuid,_threshold integer)
returns void language plpgsql security definer set search_path=public as $$
begin if not public.has_role(auth.uid(),'admin') then raise exception 'admin only'; end if; if _threshold<1 or _threshold>10000 then raise exception 'threshold must be 1-10000'; end if;
 update public.businesses set loyalty_config=jsonb_set(loyalty_config,'{stamps_required}',to_jsonb(_threshold),true) where id=_business_id;
 insert into public.platform_audit_log(actor_id,action,target_type,target_id,detail) values(auth.uid(),'loyalty_threshold_override','business',_business_id::text,jsonb_build_object('threshold',_threshold));
end; $$;
revoke all on function public.admin_override_loyalty_threshold(uuid,integer) from public; grant execute on function public.admin_override_loyalty_threshold(uuid,integer) to authenticated;
