-- Optional WhatsApp customer onboarding. These tables deliberately have no
-- client-side policies: only tightly scoped RPCs and Edge Functions may read
-- phone numbers, conversation state or the one-time handoff links.

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  user_id uuid unique references auth.users(id) on delete set null,
  opted_in_at timestamptz not null default now(),
  opted_out_at timestamptz,
  phase_out_started_at timestamptz,
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

create table public.whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  provider_message_id text unique,
  phone_e164 text not null references public.whatsapp_contacts(phone_e164) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  message_kind text not null default 'text',
  body text,
  provider_payload jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_message_log_contact_created_idx on public.whatsapp_message_log (phone_e164, created_at desc);

create table public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null references public.whatsapp_contacts(phone_e164) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  event_type text not null check (event_type in ('visit_update', 'reward_redeemed', 'move_to_app')),
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'suppressed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index whatsapp_outbox_pending_idx on public.whatsapp_outbox (created_at)
  where status = 'pending';

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_handoff_links enable row level security;
alter table public.whatsapp_message_log enable row level security;
alter table public.whatsapp_outbox enable row level security;

revoke all on table public.whatsapp_contacts, public.whatsapp_conversations,
  public.whatsapp_handoff_links, public.whatsapp_message_log, public.whatsapp_outbox
  from anon, authenticated;

-- Redeems a short-lived signup link after the person has authenticated. The
-- link is bound to both the verified account email and its WhatsApp number,
-- so somebody who merely obtains a URL cannot take over another account.
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

  select user_id into _existing_user from public.whatsapp_contacts
    where phone_e164 = _link.phone_e164 for update;
  if _existing_user is not null and _existing_user <> _uid then
    raise exception 'This WhatsApp number is already linked to another Loyalty Loop account.';
  end if;

  insert into public.whatsapp_contacts (phone_e164, user_id, opted_in_at, opted_out_at)
  values (_link.phone_e164, _uid, now(), null)
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

  update public.whatsapp_handoff_links set claimed_at = now(), user_id = _uid where id = _link.id;
  update public.whatsapp_conversations set state = 'idle', pending_email = null where phone_e164 = _link.phone_e164;
  select slug into _slug from public.businesses where id = _link.business_id;
  return jsonb_build_object('business_slug', _slug);
end;
$$;

revoke all on function public.complete_whatsapp_signup(text) from public, anon;
grant execute on function public.complete_whatsapp_signup(text) to authenticated;

-- Queue an optional WhatsApp update after a successful counter transaction.
-- Delivery is handled by a server-side worker so no Meta credential is ever
-- placed in SQL or in a browser. After 30 days the customer receives one
-- migration notice instead of more WhatsApp updates.
create or replace function public.queue_whatsapp_transaction_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _contact public.whatsapp_contacts%rowtype;
  _business record;
  _membership record;
  _unit text;
  _body text;
begin
  select * into _contact from public.whatsapp_contacts
    where user_id = new.user_id and opted_out_at is null
    for update;
  if not found then return new; end if;

  if _contact.phase_out_started_at is not null then return new; end if;
  if _contact.opted_in_at <= now() - interval '30 days' then
    insert into public.whatsapp_outbox (user_id, phone_e164, business_id, event_type, body)
    values (new.user_id, _contact.phone_e164, new.business_id, 'move_to_app',
      'Your stamps, rewards and history are safely synced in The Loyalty Loop app. From now on, the app is the best place to keep up with your rewards.');
    update public.whatsapp_contacts set phase_out_started_at = now() where id = _contact.id;
    return new;
  end if;

  select name, loyalty_type, loyalty_config into _business from public.businesses where id = new.business_id;
  select stamp_count, points_balance, visit_count into _membership from public.memberships
    where user_id = new.user_id and business_id = new.business_id;
  _unit := case when _business.loyalty_type = 'points' then 'points' when _business.loyalty_type = 'tiered' then 'visits' else 'stamps' end;
  if new.type = 'redeem' then
    _body := 'Your reward at ' || coalesce(_business.name, 'this shop') || ' has been redeemed. Enjoy!';
    insert into public.whatsapp_outbox (user_id, phone_e164, business_id, event_type, body)
    values (new.user_id, _contact.phone_e164, new.business_id, 'reward_redeemed', _body);
  elsif new.type in ('stamp', 'points_earn') then
    _body := 'Thanks for visiting ' || coalesce(_business.name, 'your local shop') || '! You now have '
      || case when _unit = 'points' then coalesce(_membership.points_balance, 0)::text
              when _unit = 'visits' then coalesce(_membership.visit_count, 0)::text
              else coalesce(_membership.stamp_count, 0)::text end
      || ' ' || _unit || '.';
    insert into public.whatsapp_outbox (user_id, phone_e164, business_id, event_type, body)
    values (new.user_id, _contact.phone_e164, new.business_id, 'visit_update', _body);
  end if;
  return new;
end;
$$;

create trigger zz_queue_whatsapp_transaction_update
  after insert on public.transactions
  for each row execute function public.queue_whatsapp_transaction_update();

-- This function is invoked only by the transaction trigger. It must never be
-- callable through the public Data API.
revoke all on function public.queue_whatsapp_transaction_update() from public, anon, authenticated;
