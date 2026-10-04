-- Back to stamps while Fidel card linking is still being built (product owner,
-- 2026-10-04). Reverses 20260925190000_spend_switchover.sql's model change only:
--   * every shop returns to its stamp / points / visits card, except Pure Elegant
--     Dry Cleaners, which was already on £ spend before the switchover;
--   * new shops default to stamps again;
--   * stamp_count, points_balance, visit_count, stamp_threshold, earned rewards and
--     every £ column (reward_progress_pence, spend_threshold_pence) are untouched,
--     so a shop can move back to spend later by setting reward_model again;
--   * the stamp guard (refuse_stamps_at_spend_shops) stays: it only refuses stamps
--     at shops that are on spend, so the one spend shop keeps its protection.

update public.businesses
set reward_model = 'stamp_legacy'
where reward_model is distinct from 'stamp_legacy'
  and name <> 'Pure Elegant Dry Cleaners';

alter table public.businesses alter column reward_model set default 'stamp_legacy';
