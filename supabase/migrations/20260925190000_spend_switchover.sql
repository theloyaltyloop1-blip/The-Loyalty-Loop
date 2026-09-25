-- Switchover: every shop earns by spend (ARCH_PLAN.md §4.11, decisions T1–T5).
-- Runs once, after the apps and website show £ rewards.
--   * Each existing reward gets a £ amount. A shop's lowest reward unlocks at
--     £20; higher stamp rewards scale from it in whole pounds. A shop already
--     on spend keeps its current amount.
--   * A shop with no rewards gets "Free reward" at £20.
--   * Customers at shops that were on stamps start again at £0. Rewards
--     already earned are left untouched and stay valid.
--   * New shops default to spend at £20.

-- The membership guard only lets the service role (or the spend trigger) change
-- £ progress, and a migration has no JWT, so act as the service role for this
-- transaction only.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table switchover_shops on commit drop as
select id, reward_model = 'spend_threshold' as already_spend, reward_threshold_pence
from public.businesses;

-- £ amounts for rewards that have none yet.
with ranked as (
  select c.id,
         c.business_id,
         s.already_spend,
         s.reward_threshold_pence,
         c.stamp_threshold,
         min(c.stamp_threshold) over (partition by c.business_id) as lowest,
         row_number() over (partition by c.business_id order by c.stamp_threshold, c.sort_order, c.id) as position
  from public.reward_catalog c
  join switchover_shops s on s.id = c.business_id
  where c.spend_threshold_pence is null
),
amounts as (
  select id,
         business_id,
         position,
         -- A shop already on spend keeps its amount as the base; others start at £20.
         case
           when already_spend and coalesce(reward_threshold_pence, 0) > 0 and position = 1
             then reward_threshold_pence
           else greatest(round(
             (case when already_spend and coalesce(reward_threshold_pence, 0) > 0 then reward_threshold_pence else 2000 end)
             * stamp_threshold::numeric / greatest(lowest, 1) / 100) * 100, 100)::integer
         end as pence
  from ranked
),
-- Two rewards that were at the same stamp count would get the same amount;
-- nudge later ones up by £1 each so every amount stays unique per shop.
deduped as (
  select id,
         pence + (row_number() over (partition by business_id, pence order by position) - 1)::integer * 100 as pence
  from amounts
)
update public.reward_catalog c
set spend_threshold_pence = least(d.pence, 100000000)
from deduped d
where c.id = d.id;

insert into public.reward_catalog (business_id, title, description, stamp_threshold, spend_threshold_pence, sort_order)
select s.id, 'Free reward', null, 10, coalesce(nullif(s.reward_threshold_pence, 0), 2000), 0
from switchover_shops s
where not exists (select 1 from public.reward_catalog c where c.business_id = s.id);

-- Every shop now earns by spend; its single threshold is its biggest reward.
update public.businesses b
set reward_model = 'spend_threshold',
    reward_threshold_pence = (
      select max(c.spend_threshold_pence) from public.reward_catalog c where c.business_id = b.id
    )
where b.reward_model is distinct from 'spend_threshold'
   or b.reward_threshold_pence is distinct from (
      select max(c.spend_threshold_pence) from public.reward_catalog c where c.business_id = b.id
    );

-- Customers at shops that were on stamps start at £0.
update public.memberships m
set reward_progress_pence = 0,
    redemption_blocked_reason = null
from switchover_shops s
where s.id = m.business_id
  and not s.already_spend
  and (m.reward_progress_pence <> 0 or m.redemption_blocked_reason is not null);

alter table public.businesses alter column reward_model set default 'spend_threshold';
alter table public.businesses alter column reward_threshold_pence set default 2000;
