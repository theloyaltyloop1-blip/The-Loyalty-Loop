-- Optional WhatsApp onboarding. A customer must explicitly send START before
-- we create a WhatsApp contact or begin collecting any onboarding details.
-- These tables contain contact data and are server-only: no browser role can
-- read them through the Data API.

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  user_id uuid unique references auth.users(id) on delete set null,
  opted_in_at timestamptz not null default now(),
  opted_out_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.update_updated_at_column();

create table public.whatsapp_conversations (
  phone_e164 text primary key references public.whatsapp_contacts(phone_e164) on delete cascade,
  state text not null default 'idle' check (state in ('idle', 'awaiting_name', 'awaiting_email', 'handoff_sent')),
  business_id uuid references public.businesses(id) on delete set null,
  pending_first_name text,
  pending_email text,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.update_updated_at_column();

create table public.whatsapp_handoff_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  link_type text not null check (link_type in ('signup', 'card')),
  phone_e164 text not null references public.whatsapp_contacts(phone_e164) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  expected_email text,
  first_name text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint whatsapp_handoff_signup_details check (
    (link_type = 'signup' and expected_email is not null)
    or (link_type = 'card' and user_id is not null)
  )
);

create index whatsapp_handoff_links_lookup_idx
  on public.whatsapp_handoff_links (token_hash, expires_at)
  where claimed_at is null;

-- Metadata-only audit log. We deliberately do not retain free-text WhatsApp
-- messages, names or email addresses in this long-lived table.
create table public.whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  provider_message_id text unique,
  phone_e164 text not null references public.whatsapp_contacts(phone_e164) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  message_kind text not null default 'text',
  provider_payload jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_message_log_contact_created_idx
  on public.whatsapp_message_log (phone_e164, created_at desc);

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_handoff_links enable row level security;
alter table public.whatsapp_message_log enable row level security;

revoke all on table public.whatsapp_contacts, public.whatsapp_conversations,
  public.whatsapp_handoff_links, public.whatsapp_message_log
  from anon, authenticated;

-- The webhook uses the service role. A match is accepted only when exactly
-- one existing Loyalty Loop profile has the same normalised E.164 number.
create or replace function public.find_whatsapp_user_by_phone(_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _matches uuid[];
  _digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
begin
  select array_agg(id) into _matches
  from (
    select id
    from public.profiles
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = _digits
    limit 2
  ) matches;

  if coalesce(cardinality(_matches), 0) = 1 then
    return _matches[1];
  end if;
  return null;
end;
$$;

revoke all on function public.find_whatsapp_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_whatsapp_user_by_phone(text) to service_role;

-- A short-lived WhatsApp link may be redeemed only by an authenticated user
-- whose confirmed Supabase email is the one supplied after START.
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
  where token_hash = encode(digest(_token, 'sha256'), 'hex')
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
