-- Targeted promotions ("Gone quiet", "Regulars", ...) were saved but never
-- delivered. A promotion inserted with status 'sent' now writes one inbox
-- notification per member in the chosen audience and asks
-- send-announcement-push to deliver it (that function takes any message id
-- and only pushes rows already written here). Drafts (status 'draft', the
-- default, used by the web Grow page) are still never sent.
--
-- Audiences, all excluding members who opted out of this shop's offers:
--   all          every member
--   inactive_30  no visit in 30 days (last_activity_at, else joined_at)
--   new_members  joined in the last 30 days
--   regulars     3+ visits and seen in the last 30 days
--
-- An owner can send at most 3 promotions per shop per 24 hours.

create or replace function public.prepare_business_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'sent' then
    if (
      select count(*) from public.business_promotions p
      where p.business_id = new.business_id
        and p.status = 'sent'
        and p.sent_at > now() - interval '24 hours'
    ) >= 3 then
      raise exception 'You can send 3 messages a day. Try again tomorrow.'
        using errcode = 'P0001';
    end if;
    new.sent_at := now();
  else
    new.sent_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.deliver_business_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'sent' then
    return new;
  end if;
  insert into public.notifications (user_id, business_id, kind, title, body, link, announcement_id)
    select m.user_id, new.business_id, 'promo', new.title, new.body, '/dashboard/inbox', new.id
    from public.memberships m
    where m.business_id = new.business_id
      and coalesce(m.promos_opted_out, false) = false
      and case new.audience
        when 'inactive_30' then coalesce(m.last_activity_at, m.joined_at) < now() - interval '30 days'
        when 'new_members' then m.joined_at >= now() - interval '30 days'
        when 'regulars' then m.visit_count >= 3 and m.last_activity_at >= now() - interval '30 days'
        else true
      end;
  perform public.request_announcement_push(new.id);
  return new;
end;
$$;

revoke execute on function public.prepare_business_promotion() from public, anon, authenticated;
revoke execute on function public.deliver_business_promotion() from public, anon, authenticated;

drop trigger if exists before_business_promotion_insert on public.business_promotions;
create trigger before_business_promotion_insert
  before insert on public.business_promotions
  for each row execute function public.prepare_business_promotion();

drop trigger if exists on_business_promotion_sent on public.business_promotions;
create trigger on_business_promotion_sent
  after insert on public.business_promotions
  for each row execute function public.deliver_business_promotion();

-- Sent promotions are a record of what went out: no edits after insert.
drop trigger if exists business_promotion_no_resend on public.business_promotions;
create or replace function public.block_business_promotion_resend()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'sent' or new.status = 'sent' then
    raise exception 'Sent messages cannot be changed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.block_business_promotion_resend() from public, anon, authenticated;
create trigger business_promotion_no_resend
  before update on public.business_promotions
  for each row execute function public.block_business_promotion_resend();
