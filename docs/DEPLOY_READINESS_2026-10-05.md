# Deployment readiness checklist — 2026-10-05 (updated 2026-10-06, owner decisions applied)

> **Superseded 2026-10-10.** Read hosted state on that date: the four migrations listed as pending below, the admin API migrations and the `send-visit-thank-you` and AI function deployments were **already applied or deployed**. Today's additions (WhatsApp stage 2, the 3-hour thank-you limit, an outbox foreign-key fix) are recorded in `CLAUDE_HANDOFF.md` under 'Go-live preparation (2026-10-10)'. Treat the checklist below as history, not as work to do.


This is a release-planning checklist, not authorization to deploy. It was corrected against the recorded production releases and read-only Git history. No hosted migration list was queried and nothing was deployed. Claude's review findings 1-9 (handoff, "Claude review of Codex corrected deployment checklist and baseline plan") are folded in below.

## Owner decisions (2026-10-06)

- **Admin takedown state:** not needed. `is_active` stays the single flag; an owner can reactivate a shop an admin deactivated. No work.
- **Thank-you email limit:** at most one per **customer per shop** every 6 hours (read as per customer-per-shop, because a limit of one email per shop in total would stop a busy shop thanking anyone). Built as `20261006100500_visit_thank_you_rate_limit.sql` plus a change to `send-visit-thank-you`. If a different reading was meant, only the key of `visit_thank_you_log` and the claim function change.
- **WhatsApp STOP edit:** ship. Included in the release candidate (group 5). It is part of the unapplied WhatsApp stage-2 migration, so shipping it means shipping that migration; see the Edge functions section.
- **Card payments received while a shop is inactive:** held and credited when the shop is reactivated. Built as `20261006100000_fidel_replay_deferred_awards.sql`.

## Hosted facts read on 2026-10-06 (read-only, Supabase MCP)

- `[x]` `list_migrations` returned 69 migrations. Head is `20261005203031_lock_staff_members_identity_columns` (applied 5 October ~20:30, **not in `origin/main`, any branch, or the handoff**: a security fix that revokes direct client writes to `staff_members.user_id` / `pin_hash`; its SQL is now saved locally as `supabase/migrations/20261005203031_lock_staff_members_identity_columns.sql` in the release candidate). It does not affect the thank-you check, which reads `staff_members` through the service role.
- `[x]` Hosted already has `20261003004334_admin_trending_shops` and `20261004001549_back_to_stamps`. Hosted has **no** `whatsapp_spend_dispatch` (`20261002133050`), so editing that file in place for the STOP change is safe.
- `[x]` Live trigger names: `businesses` BEFORE UPDATE = `enforce_businesses_update_scope`, `protect_business_google_place`, `set_updated_at` (guard sorts first, as the activation bypass requires); `transactions` BEFORE INSERT = `enforce_linked_customer_manual_entry`, `refuse_stamps_at_spend_shops` (the new `a_...` trigger sorts before both); `rewards` BEFORE UPDATE = `enforce_rewards_update_scope` only.
- `[x]` No shop is inactive right now, so the gating migration changes nothing for any existing shop on day one. None of the new RPC names exist yet (no stale overloads).
- `[ ]` **Not done: live function-body comparison.** A second read (md5 of the live bodies of `process_fidel_webhook_event`, `fidel_location_accepts_new_awards`, `enforce_businesses_update_scope`, plus the live `transactions` insert policy) was refused by the permission classifier as a production read. Before applying anything, run it with the owner's approval and compare with the repo bodies (query below). The new replay migration replaces `process_fidel_webhook_event` wholesale, so drift there matters most.

## Evidence labels

- `[x]` — a named local check passed in the current work, without making a claim about production.
- `[~]` — confirmed by source, Git history, or the handoff only.
- `[ ]` — needs a hosted inspection, migration replay, deployment, or smoke test.

## Release baseline — reconcile before assembling another release

- `[x]` The dirty local `main` (`20252e4`) is **3 commits ahead and 11 commits behind** `origin/main` (`59bfc84`); re-checked with `git rev-list --left-right --count HEAD...origin/main` and `git log --left-right`. Do not build a release from it.
- `[x]` Local-only commits (`<`) are duplicates of commits already on `origin/main`, so they drop out:
  - `20252e4` = `47ac3a1` (shop-review migration alignment).
  - `bc1f129` = `bc88a1e` (admin-selected Trending).
  - `a7339e2` = `6c0fdf8` (phone Trending).
- `[x]` `origin/main`-only commits (`>`):
  - `47ac3a1`, `bc88a1e`, `6c0fdf8`, `34017f7` — shop-review alignment, Trending, and the hosted-version rename.
  - `fe3c603` — back to stamps.
  - `40d56c2`, `f6feb20`, `53f5b19` — redesign, website refresh, business video.
  - `e0f15b9`, `197c6c7`, `59bfc84` — shopper-home work, including `expo-location`.
- `[x]` **The unreleased delta is `git diff origin/main` plus untracked files, not `git diff HEAD`.** Most redesign, stamp-restore and font work in the dirty checkout is already committed on `origin/main`: `Scan.tsx`, `apps/retailer/App.tsx` and `businesses.ts` differ from `origin/main` by only 15, 14 and 3 lines, but from local HEAD by hundreds. Tracked files in the dirty tree are also *behind* `origin/main` in places (`Home.tsx`, `use-user-location.ts`, `home-collection.tsx`, `apps/shopper/src/trending.ts`, `apps/web/src/lib/trending.ts` carrying the old migration filename, videos and badges).
- `[~]` Remaining uncommitted groups that are not in the release candidate: WhatsApp migration/functions/tests, AI functions, fonts/package changes, admin app, graphify/`.claude`/`.agents` material, handoff and docs edits.

### Assembly method (hunk-level patches, not file copies)

1. Leave the dirty checkout untouched as the source.
2. Work in a separate worktree from `origin/main`. Never rebase, checkout, merge or reset the dirty checkout.
3. For each feature group build a patch from `git diff origin/main -- <paths>`, keep only the intended hunks, and apply with `git apply --3way --ignore-whitespace`. Copy a whole file only when it is brand new. Never copy a tracked file whole: it would revert released work.
4. Cherry-pick `3ce72dd` (back-to-stamps rename, on `stamps-while-fidel`, also edits `apps/api/test/integration/back-to-stamps.test.mjs`).
5. Update the two test imports (`owner-business-activation.test.mjs:26`, `admin-trending.test.mjs:26`) to `20261003004334_admin_trending_shops.sql`. `origin/main` already has the correct `admin-trending.test.mjs`, so do not patch it from the dirty tree.
6. Run the focused tests and type checks, then a Supabase-capable history replay, then seek release approval.

### Release-candidate worktree (built 2026-10-06, local only, uncommitted)

- Path: `.claude/worktrees/release-candidate-2026-10-05`, branch `release-candidate-2026-10-05`, based on `origin/main` `59bfc84` plus cherry-picked `ee077c5` (the `3ce72dd` rename).
- Group 1, reward QR: `reward-qr.ts` x3 and `apps/api/test/reward-qr.test.mjs` (new files); `Rewards.tsx` (2 hunks), shopper `App.tsx` (hunks 1 and 4 of 5: import and QR value; the stale `useUserLocation` removal hunks were left out), retailer `App.tsx` (3 hunks), web `Scan.tsx` (4 hunks). No conflicts.
- Group 2, thank-you: `send-visit-thank-you/index.ts` (3 hunks); `_shared/visit-thank-you-auth.ts` and `staff-check.test.mjs` (new). No conflicts.
- Group 3, owner activation: `20261005120000_owner_business_activation.sql` and `owner-business-activation.test.mjs` (new; test import changed to the hosted Trending filename); `Settings.tsx` hunks 0, 3, 4, 5 (the two `rounded-xl` redesign hunks were left out). No conflicts.
- Group 4, inactive gating: `20261005130000_fidel_inactive_business_write_gating.sql` (new); `fidel-fixture.mjs`, `delivery-recovery`, `shop-requests`, `shop-request-fixes` and `fidel-supabase-spend` test edits; inactive copy hunks in retailer `App.tsx` (2), web `Scan.tsx` (2) and `businesses.ts` (hunk 1 of 2; the `visit_count` removal hunk is a stale difference and was left out). No conflicts.
- Group 5, WhatsApp STOP (owner decision 2026-10-06): `whatsapp-webhook/index.ts` (all hunks: atomic STOP error handling and the stamp-progress lines for back-to-stamps), `20261002133050_whatsapp_spend_dispatch.sql` edited in place (STOP now commits the opt-out and suppresses pending sends inside `reserve_whatsapp_inbound`; outbox `suppressed` outcome), and the `whatsapp-stage2.test.mjs` hunk. The test's added "handler crashed" line is a no-op (`try{throw}catch{}`) and proves nothing by itself; the real coverage is the opt-out being committed at reservation.
- Group 6, replay of payments received while inactive: `20261006100000_fidel_replay_deferred_awards.sql` (new table `fidel_deferred_awards`, `process_fidel_webhook_event` re-issued with three marked branches, `replay_deferred_fidel_awards`, and an AFTER UPDATE OF is_active trigger on `businesses`), with assertions added to `fidel-supabase-spend.test.mjs`. Behaviour: an auth for an inactive shop is held (`deferred_inactive`); a clearing or refund for a held payment is recorded on it; on reactivation each held payment is credited once, net of refunds; a payment whose card is unlinked, whose customer left, or whose location is no longer active is `dropped`; a payment the spend trigger refuses is `failed` and never blocks reactivation. Tested: held, deduplicated, partly refunded and cleared, fully refunded (credits nothing), unlinked card (dropped), replay credits 400 + 200 and crosses the 500 threshold into one reward, a second reactivation credits nothing, an over-large payment is marked failed and reactivation still succeeds. A replayed payment does not send the post-processing push (that hook only fires on `processed`) but the WhatsApp spend-message trigger does fire, so a late message may arrive. Fidel card linking is not live yet, so this is dormant until then.
- Group 7, thank-you limit: `20261006100500_visit_thank_you_rate_limit.sql` (`visit_thank_you_log`, `claim_visit_thank_you`, `release_visit_thank_you`, service-role only) and `send-visit-thank-you/index.ts` (claims before the provider call, releases on a network error or rejection, returns `recently_thanked`); `visit-thank-you-rate-limit.test.mjs` (7 tests). The function itself was not run under Deno; its ordering is asserted from source.
- Also saved the hosted-only `20261005203031_lock_staff_members_identity_columns.sql` so the local history matches hosted.
- Result: tracked files patched plus new files; nothing from AI functions, fonts, admin, graphify or `.claude`.
- `[x]` `node --test` per file, all pass (re-run 2026-10-06 after groups 5-7): reward-qr 11, staff-check 6, visit-thank-you-rate-limit 7, owner-business-activation 8, admin-trending 5, fidel-supabase-spend 1 (now includes replay), fidel-card-lifecycle 16, fidel-manual-spend 1, fidel-spend-tiers 1, fidel-card-linking 1, spend-switchover 1, delivery-recovery 3, shop-requests 13, shop-request-fixes 6, back-to-stamps 1, whatsapp-stage2 12 (94 tests).
- `[x]` `tsc` clean for web (`tsc -b`) and retailer. Shopper `tsc --noEmit` is clean only when the root `node_modules` comes from a checkout that has `expo-location` (it failed with "Cannot find module 'expo-location'" against the stale dirty-tree `node_modules`; the worktree's root `node_modules` is a junction to the `redesign` worktree's). Run `npm install` in the real release tree before relying on shopper checks.

## Migration-history reconciliation — already hosted, do not list as pending

| Semantic migration | `origin/main` file | `stamps-while-fidel` file | Dirty working-tree file | Evidence and action |
| --- | --- | --- | --- | --- |
| Admin Trending | `20261003004334_admin_trending_shops.sql` | `20261003004334_admin_trending_shops.sql` | `20261002233000_admin_trending_shops.sql` | `[x]` re-verified with `git ls-tree`; `git show 34017f7` shows the rename (also editing `admin-trending.test.mjs`, `apps/shopper/src/trending.ts`, `apps/web/src/lib/trending.ts`). Handoff records the live apply as `20261003004334`. Never apply the stale version. |
| Back to stamps | `20261004120000_back_to_stamps.sql` | `20261004001549_back_to_stamps.sql` | `20261004120000_back_to_stamps.sql` | `[x]` re-verified; `origin/main..stamps-while-fidel` is only `3ce72dd`, which also edits `back-to-stamps.test.mjs`. Handoff records the live apply as `20261004001549`. Align the release tree to `20261004001549`; do not reapply its contents. |

### Earlier shop and WhatsApp migrations

- `[~]` `20261002211052_shop_requests_phase_a.sql` and `20261002211306_scheduled_delivery_recovery.sql` are on `origin/main` and `stamps-while-fidel`. Handoff line 1187 records the rename to the hosted versions. Not pending; live presence not freshly queried.
- `[~]` `20261002231854_shop_request_review_fixes.sql` is on both; handoff records hosted alignment. Not pending; not freshly queried.
- `[ ]` `20261002133050_whatsapp_spend_dispatch.sql` is on both trees, but handoff line 1187 says it remained unapplied. It is older than the hosted head, so a CLI `supabase db push` would refuse it without `--include-all`. Keep it out of this release until a hosted migration-list check confirms its status; apply migrations through the MCP (as for earlier releases) rather than the CLI to avoid out-of-order handling.

## Pending migrations after reconciliation

- `[~]` `20261005120000_owner_business_activation.sql` — owner-only deactivate/reactivate RPCs and the scoped businesses update guard. Disposable-PostgreSQL tests pass (also in the release-candidate worktree); hosted application and full-history replay are unverified.
- `[~]` `20261005130000_fidel_inactive_business_write_gating.sql` — inactive-shop transaction, reward-redemption, manual-spend and Fidel-award gating. Disposable-PostgreSQL tests pass; hosted application and full-history replay are unverified.

- `[~]` `20261006100000_fidel_replay_deferred_awards.sql` — holds and replays card payments received while a shop is inactive. Tested on disposable PostgreSQL; replaces `process_fidel_webhook_event`, so the live-body comparison is required first. Hosted application unverified.
- `[~]` `20261006100500_visit_thank_you_rate_limit.sql` — 6-hour thank-you limit tables and RPCs. Must be applied **before** the redeployed `send-visit-thank-you`, which calls them. Hosted application unverified.
- `[ ]` `20261002133050_whatsapp_spend_dispatch.sql` (edited in place for STOP; confirmed unapplied hosted) — see Edge functions: applying it ships WhatsApp stage 2 (outbox, transaction trigger, pg_net call to the dispatch function), not just the STOP fix.

Apply order after reconciliation: `20261005120000`, `20261005130000`, `20261006100000`, `20261006100500`, then (separately, after the owner confirms stage 2) `20261002133050`. The hosted-only `20261005203031` needs no apply. After each MCP apply, rename the local file to the hosted version (which will sort after `20261005203031`).

Do not put `20261002233000_admin_trending_shops.sql` or `20261004120000_back_to_stamps.sql` in an apply list.

**After applying each migration through the MCP, rename the local file to the hosted version number** and update any test that reads it by name (as was done for Trending and back-to-stamps), so a later CLI run does not try to apply it again.

## Pre-apply hosted-definition and data checks

Before applying either pending migration, run the following **read-only** SQL through the Supabase MCP against the intended project. Save the output with the release review and compare it to what the local migrations replace.

```sql
-- Current businesses update guard replaced by 20261005120000.
select pg_get_functiondef('public.enforce_businesses_update_scope()'::regprocedure);

-- Current transactions INSERT policy replaced by 20261005130000.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'transactions'
  and policyname = 'transactions_insert_owner_or_staff_or_admin';

-- Current Fidel eligibility predicate replaced by 20261005130000.
select pg_get_functiondef(
  'public.fidel_location_accepts_new_awards(public.business_fidel_locations)'::regprocedure
);

-- Existing transactions BEFORE INSERT triggers (name and order matter: the new trigger is named a_...).
select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.transactions'::regclass
  and not t.tgisinternal
  and (t.tgtype & 2) = 2  -- BEFORE
  and (t.tgtype & 4) = 4  -- INSERT
order by t.tgname;

-- businesses BEFORE UPDATE triggers: the activation bypass requires
-- enforce_businesses_update_scope to sort before any trigger that edits columns (set_updated_at).
select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.businesses'::regclass
  and not t.tgisinternal
  and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16  -- BEFORE UPDATE
order by t.tgname;

-- rewards BEFORE UPDATE triggers: the gating migration adds a_reject_inactive_business_reward_redemption.
select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.rewards'::regclass
  and not t.tgisinternal
  and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16
order by t.tgname;

-- Shops that are inactive right now. 20261005130000 blocks their stamps, redemptions and Fidel awards
-- the moment it is applied, so confirm none are in active use.
select b.id, b.name,
  (select count(*) from public.memberships m where m.business_id = b.id) as memberships,
  (select count(*) from public.business_fidel_locations l where l.business_id = b.id) as fidel_locations
from public.businesses b
where not b.is_active;

-- Old no-argument activation RPC overloads that the gating migration drops, if present.
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('deactivate_my_business', 'reactivate_my_business');
```

```sql
-- Live-body drift check (needs owner approval to run; refused once as a production read).
-- Compare each md5 with the md5 of the body text in the repo migration named on the right.
select proname, md5(prosrc) as src_md5, length(prosrc) as len
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('process_fidel_webhook_event',          -- repo: 20260929071345_fidel_card_lifecycle_repair.sql
                  'fidel_location_accepts_new_awards',    -- repo: same file
                  'enforce_businesses_update_scope')      -- repo: 20261002233000 / hosted 20261003004334 admin_trending_shops
order by proname;
```

Also confirm in the Supabase dashboard (API settings) that the `business_activation_private` schema is **not** in the exposed schemas list.

**Release order:** migrations first, then changed Edge Functions, then the web deployment, then shopper and retailer OTAs/native builds. The web Deactivate control calls an RPC that the migration introduces, so releasing web first would fail. Do not ship an OTA containing the native `expo-location` work; it needs a native build.

## Rollback outlines — prepare from captured live definitions

Outlines only. Generate a reviewed rollback migration from the pre-apply output; do not copy an old local definition over a newer live one. **Roll back in reverse order: gating first, then activation.**

### `20261005130000_fidel_inactive_business_write_gating.sql`

```sql
begin;
drop trigger if exists a_reject_inactive_business_transaction_write on public.transactions;
drop trigger if exists a_reject_inactive_business_reward_redemption on public.rewards;
drop function if exists public.reject_inactive_business_transaction_write();
drop function if exists public.reject_inactive_business_reward_redemption();
-- Restore the exact pre-apply transactions INSERT policy and
-- fidel_location_accepts_new_awards(...) definition captured above.
commit;
```

### `20261005120000_owner_business_activation.sql`

**Before dropping the RPCs, reactivate every shop an owner deactivated through them.** After rollback the restored guard blocks direct updates, so owners could no longer reactivate and an admin would have to.

```sql
begin;
-- 1. As an admin, set is_active = true for any shop that should be live again.
revoke execute on function public.deactivate_my_business(uuid) from authenticated;
revoke execute on function public.reactivate_my_business(uuid) from authenticated;
drop function public.deactivate_my_business(uuid);
drop function public.reactivate_my_business(uuid);
-- 2. Restore the exact pre-apply enforce_businesses_update_scope() definition captured above.
-- 3. Drop business_activation_private.capabilities and the schema only after confirming nothing else uses them.
commit;
```

## Edge functions and configuration

- `[~]` `send-visit-thank-you` and `_shared/visit-thank-you-auth.ts` need redeployment with the staff authorization fix and the 6-hour limit (apply `20261006100500` first, or every send fails with a limit-check error) (tests: `staff-check.test.mjs` passes against a mock; no Deno run or hosted call). Before deploying, verify the **presence only** of `RESEND_API_KEY` and `RESEND_FROM_EMAIL` with `supabase secrets list` (names and digests only; never paste values here). **If `RESEND_FROM_EMAIL` is unset the function falls back to `onboarding@resend.dev` (`supabase/functions/send-visit-thank-you/index.ts:47`), which Resend restricts to the account holder's own address, so customers would silently not receive the email** (the apps ignore the failure). The sender must be on a domain verified in Resend. Smoke-test a staff award after deploying.
- `[~]` AI functions (`ai-review-reply`, `analytics-summary`, `business-coach-chat`, `deep-business-report`, shared helpers) have working-tree changes that are not in the release candidate; decide separately and verify deployed source/config.
- `[ ]` `whatsapp-webhook` STOP edit: **decided to ship (2026-10-06)** and included in the release candidate (group 5; whatsapp-stage2 12/12 and the shared WhatsApp unit tests pass; not run under Deno). Caveat found while preparing it: the STOP fix lives inside `20261002133050_whatsapp_spend_dispatch.sql`, which is **not applied hosted**, so shipping it ships WhatsApp stage 2: the outbox, a trigger on `transactions` that calls the dispatch function through pg_net, and the new webhook. That needs the `whatsapp-dispatch` function deployed and its provider secrets and Meta webhook configuration checked, none of which I verified. The `zz_queue_whatsapp_spend` trigger sorts after the new `a_` gating trigger, so a blocked inactive-shop write never queues a message. Treat stage 2 as its own release step after the four migrations above; `whatsapp-handoff` was already released with back-to-stamps.

## Web and mobile delivery

- `[~]` The release-candidate web tree type-checks (`tsc -b`) but no production build (`npm run build:web`) was run in it; a type check alone does not verify a production web release. Deploy only after migrations and Edge Functions are ready.
- `[~]` Reward-QR and thank-you changes are separate groups with local tests (see the worktree results above); no runtime verification on a device or deployed function.
- `[~]` Shopper and retailer JavaScript changes in the release candidate are OTA-eligible under the project rule (no native config or module change in the four groups). The shopper `expo-location` commits already on `origin/main` need a native build if included. Device checks are unverified.

## Post-release smoke checks

- `[ ]` Run deactivation on the **Developer Test Shop only** (deactivation hides a shop from customers): deactivate and reactivate as its owner; confirm the Settings control reports success and the correct shop changes.
- `[ ]` While that shop is inactive, confirm the website scan/manual award flow and reward redemption refuse with the friendly inactive-shop copy; after reactivation confirm the same paths work.
- `[ ]` Generate a reward QR on the website and scan it in the retailer app. Also scan a **legacy raw-token reward QR** (one generated before the fix) in both the retailer app and the website scanner.
- `[ ]` Have active same-shop staff award a visit and confirm the intended thank-you email arrives; confirm non-staff, revoked and other-shop staff cannot trigger it.
- `[ ]` Create or identify a pre-deactivation Fidel purchase, process its refund while the shop is inactive, and confirm progress is reduced without a new award.
- `[ ]` Complete the previously unverified stamp-shop device/browser smoke from the 2026-10-04 release.
- `[ ]` Thank-you limit: award the same customer twice within 6 hours at one shop and confirm one email only; confirm a different customer or shop is unaffected.
- `[ ]` Held payments (after Fidel is live): send a test card payment to the inactive Developer Test Shop, confirm it is held, reactivate, and confirm exactly one credit.
- `[ ]` WhatsApp STOP (after stage 2 is live): send STOP and confirm no further message arrives, including a purchase made immediately afterwards.

## Product-owner decisions

- `[x]` Card payments received while a shop is inactive: **replayed on reactivation** (built, group 6).
- `[x]` Admin takedown state: **not needed**.
- `[x]` Thank-you frequency: **max one per customer per shop per 6 hours** (built, group 7). Staff awards will also begin sending emails once the function is redeployed (already understood).
- `[x]` WhatsApp STOP edit: **ship** (included; stage-2 caveat above).
- `[ ]` New questions raised by the build: (a) is "per customer per shop" the intended reading of the thank-you limit; (b) held card payments have no expiry, so a payment held for months is still credited if the card is still linked, which may surprise; (c) confirm WhatsApp stage 2 should go live now.
- `[ ]` Back-to-stamps follow-ups: handle the £ progress earned 25 September–4 October that is now hidden, and update landing/help/store copy that still describes spend rewards.

## Full-history replay limit

- `[ ]` `apps/api/test/integration/supabase-history-replay.test.mjs` has a hard-coded `skip:` (line 15) because embedded PostgreSQL has no Supabase `pg_net`. The migrations run `create extension pg_net` (`20260806112723_foundations_auth.sql:6`) and call `net.http_post`, so a fixture stub would need to fake an extension; stripping SQL or turning the skip into a pass would weaken the test. No capability probe was added.
- `[~]` Build a dedicated Supabase-capable runner (for example a local Supabase CLI stack, which needs Docker, unconfirmed here) that applies the same SQL unchanged, fails loudly at the first broken migration, and passes only after every migration applies.
