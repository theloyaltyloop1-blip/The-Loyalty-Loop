-- Let an admin choose exactly which surfaces a platform announcement shows
-- on (website, and/or the shopper/retailer apps per platform) instead of it
-- always reaching every single account regardless of which app they use.
alter table public.platform_announcements
  add column if not exists target_website boolean not null default false,
  add column if not exists target_shopper_ios boolean not null default false,
  add column if not exists target_shopper_android boolean not null default false,
  add column if not exists target_retailer_ios boolean not null default false,
  add column if not exists target_retailer_android boolean not null default false;

-- Existing rows (published before targeting existed) reached everyone —
-- keep that behaviour for them by backfilling all targets to true.
update public.platform_announcements
set target_website = true, target_shopper_ios = true, target_shopper_android = true,
    target_retailer_ios = true, target_retailer_android = true
where not (target_website or target_shopper_ios or target_shopper_android or target_retailer_ios or target_retailer_android);

alter table public.platform_announcements
  add constraint platform_announcements_has_target check (
    target_website or target_shopper_ios or target_shopper_android or target_retailer_ios or target_retailer_android
  );

-- Route inbox+push delivery by role so a retailer-only announcement doesn't
-- notify shoppers and vice versa; website-only announcements notify no one
-- via inbox/push (the banner handles that surface instead).
create or replace function public.deliver_platform_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    if new.target_shopper_ios or new.target_shopper_android then
      insert into public.notifications (user_id, kind, title, body, link, announcement_id)
        select distinct ur.user_id, 'system', new.title, new.body, '/dashboard/inbox', new.id
        from public.user_roles ur
        where ur.role = 'consumer';
    end if;
    if new.target_retailer_ios or new.target_retailer_android then
      insert into public.notifications (user_id, kind, title, body, link, announcement_id)
        select distinct ur.user_id, 'system', new.title, new.body, '/owner/notifications', new.id
        from public.user_roles ur
        where ur.role in ('business_owner', 'staff');
    end if;
    perform public.request_announcement_push(new.id);
  end if;
  return new;
end;
$$;
;
