-- Push notifications for announcements (2026-09-12).
--
-- * Shop announcements (public.announcements) now create an inbox notification
--   for every member of that shop who has not opted out of its promotions
--   (memberships.promos_opted_out), then ask the send-announcement-push edge
--   function to deliver Expo pushes for them.
-- * Team announcements (public.platform_announcements) already created inbox
--   notifications for everyone; they now trigger pushes too.
--
-- notifications.announcement_id links each inbox row to its source so the edge
-- function can claim "everything unsent for this announcement" atomically and
-- is safe to re-run.

alter table public.notifications add column if not exists announcement_id uuid;
create index if not exists notifications_announcement_pending_idx
  on public.notifications (announcement_id) where push_sent_at is null;

-- Fire-and-forget HTTP call through pg_net. The request is queued inside the
-- publishing transaction and only sent once it commits; any failure to queue is
-- logged rather than blocking the publish.
create or replace function public.request_announcement_push(_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/send-announcement-push',
    body := jsonb_build_object('announcement_id', _announcement_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  );
exception when others then
  raise warning 'announcement push request failed: %', sqlerrm;
end;
$$;

create or replace function public.deliver_shop_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_active then
    return new;
  end if;
  insert into public.notifications (user_id, business_id, kind, title, body, link, announcement_id)
    select m.user_id, new.business_id, 'promo', new.title, new.body, '/dashboard/inbox', new.id
    from public.memberships m
    where m.business_id = new.business_id
      and coalesce(m.promos_opted_out, false) = false;
  perform public.request_announcement_push(new.id);
  return new;
end;
$$;

drop trigger if exists on_shop_announcement_published on public.announcements;
create trigger on_shop_announcement_published
  after insert on public.announcements
  for each row execute function public.deliver_shop_announcement();

create or replace function public.deliver_platform_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    insert into public.notifications (user_id, kind, title, body, link, announcement_id)
      select p.id, 'system', new.title, new.body, '/dashboard/inbox', new.id
      from public.profiles p;
    perform public.request_announcement_push(new.id);
  end if;
  return new;
end;
$$;
