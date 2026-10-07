create or replace function public.admin_respond_support_request(_id uuid, _response text, _resolve boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_assert();
  update public.support_requests set admin_response = nullif(trim(_response), ''),
    status = case when _resolve then 'resolved' else status end,
    resolved_at = case when _resolve then now() else resolved_at end,
    resolved_by = case when _resolve then auth.uid() else resolved_by end
  where id = _id;
  insert into public.platform_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'support_response', 'support_request', _id::text, jsonb_build_object('resolved', _resolve));
end; $$;
revoke all on function public.admin_respond_support_request(uuid, text, boolean) from public, anon;
grant execute on function public.admin_respond_support_request(uuid, text, boolean) to authenticated;
