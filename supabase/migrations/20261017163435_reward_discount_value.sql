-- Optional £ value on a catalogue reward ("£5 off"). When set, the scan screen
-- asks staff for the bill total and shows the reduced amount to type into the
-- card machine (manual "£ off" flow, owner decision 2026-10-17). Purely
-- additive: rewards without a value keep behaving exactly as today. Issued
-- rewards read the value through rewards.catalog_id, so no trigger changes.

alter table public.reward_catalog
  add column discount_pence integer,
  add constraint reward_catalog_discount_pence_check
    check (discount_pence is null or discount_pence between 1 and 1000000);
