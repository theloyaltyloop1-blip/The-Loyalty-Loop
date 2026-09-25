-- The WhatsApp handoff token is hashed by the Edge Function with SHA-256.
-- Qualify pgcrypto and convert the text to bytes so the matching database
-- function works regardless of the function's restricted search path.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.complete_whatsapp_signup(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _uid uuid := auth.uid();
  _link public.whatsapp_handoff_links%rowtype;
  _email text;
  _existing_user uuid;
  _slug text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(length(_token), 0) < 32 then
    raise exception 'invalid handoff link';
  end if;

  select * into _link
  from public.whatsapp_handoff_links
  where token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex')
    and link_type = 'signup'
    and claimed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'This WhatsApp sign-up link has expired. Return to WhatsApp and send START again.';
  end if;

  select lower(email) into _email from auth.users where id = _uid;
  if _email is null or _email <> lower(_link.expected_email) then
    raise exception 'Sign in with the email address you gave in WhatsApp.';
  end if;

  select user_id into _existing_user
  from public.whatsapp_contacts
  where phone_e164 = _link.phone_e164
  for update;
  if _existing_user is not null and _existing_user <> _uid then
    raise exception 'This WhatsApp number is already linked to another Loyalty Loop account.';
  end if;

  insert into public.whatsapp_contacts (phone_e164, user_id, opted_in_at, opted_out_at, last_inbound_at)
  values (_link.phone_e164, _uid, now(), null, now())
  on conflict (phone_e164) do update
    set user_id = excluded.user_id,
        opted_out_at = null,
        last_inbound_at = now();

  update public.profiles
  set phone = _link.phone_e164,
      first_name = coalesce(nullif(first_name, ''), nullif(_link.first_name, ''))
  where id = _uid;

  if _link.business_id is not null then
    insert into public.memberships (user_id, business_id)
    values (_uid, _link.business_id)
    on conflict (user_id, business_id) do nothing;
  end if;

  update public.whatsapp_handoff_links
  set claimed_at = now(), user_id = _uid
  where id = _link.id;
  update public.whatsapp_conversations
  set state = 'idle', pending_email = null
  where phone_e164 = _link.phone_e164;
  select slug into _slug from public.businesses where id = _link.business_id;
  return jsonb_build_object('business_slug', _slug);
end;
$$;

revoke all on function public.complete_whatsapp_signup(text) from public, anon;
grant execute on function public.complete_whatsapp_signup(text) to authenticated;
