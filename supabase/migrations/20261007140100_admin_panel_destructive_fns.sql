-- Functions containing DELETE statements, kept in their own migration.

create or replace function public.admin_delete_review(_review_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  delete from public.reviews where id = _review_id;
  if not found then raise exception 'review not found'; end if;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'review_deleted', 'review', _review_id::text, jsonb_build_object('reason', _reason));
end; $$;
revoke all on function public.admin_delete_review(uuid, text) from public, anon;
grant execute on function public.admin_delete_review(uuid, text) to authenticated;

-- Suspension is enforced: ban in auth (blocks sign-in/refresh) and revoke sessions.
-- Admins must have the admin role revoked first, so a rogue admin cannot be left
-- half-suspended with live admin access and nobody can lock out the last admin.
create or replace function public.admin_set_user_suspended(_user_id uuid, _suspended boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  if _user_id = auth.uid() then raise exception 'cannot suspend yourself'; end if;
  if _suspended then
    if public.has_role(_user_id, 'admin') then raise exception 'revoke the admin role before suspending this user'; end if;
    insert into public.user_suspensions(user_id, reason, suspended_by) values (_user_id, _reason, auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();
    update auth.users set banned_until = now() + interval '100 years' where id = _user_id;
    delete from auth.sessions where user_id = _user_id;
  else
    delete from public.user_suspensions where user_id = _user_id;
    update auth.users set banned_until = null where id = _user_id;
  end if;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), case when _suspended then 'user_suspended' else 'user_unsuspended' end, 'user', _user_id::text,
          jsonb_build_object('reason', _reason));
end; $$;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
