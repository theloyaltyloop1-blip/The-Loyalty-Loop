-- Create an inbox/push notification exactly once when a reward changes from
-- unredeemed to redeemed. The trigger is the source of truth for both web and
-- native redemption flows; their clients then ask send-user-push to deliver it.
create or replace function public.notify_reward_redeemed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.redeemed_at is null and new.redeemed_at is not null then
    insert into public.notifications (user_id, business_id, kind, title, body)
    values (
      new.user_id,
      new.business_id,
      'reward',
      'Reward redeemed',
      new.title || ' has been redeemed. We hope you enjoyed it!'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_reward_redeemed() from public;

drop trigger if exists reward_redeemed_notification on public.rewards;
create trigger reward_redeemed_notification
  after update of redeemed_at on public.rewards
  for each row execute function public.notify_reward_redeemed();
