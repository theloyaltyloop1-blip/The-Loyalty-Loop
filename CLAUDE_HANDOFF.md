# CLAUDE_HANDOFF.md — Fidel Card-Linked Reward Engine

Living status log between Claude (architect/reviewer) and Codex (builder), for the
Fidel card-linked cumulative-spend engine. Spec: [ARCH_PLAN.md](ARCH_PLAN.md).
Both agents edit this file after every completed step; Codex reads "Next
action" before starting and records test evidence here.

Do not treat anything in "Done" as a request to redo it. Do not build ahead of "Next
action" without checking in — some steps are review checkpoints (ARCH_PLAN.md §7) that
need Claude's sign-off before the next one starts.

---

## Current status (2026-09-29): R1–R4 approved; deployment runbook awaits Claude check

One additive migration, lifecycle/account/orphan Edge changes and 15 desired-behaviour scenarios are complete locally. Final checks: 35/35 pure tests; 15/15 new scenarios plus all three required existing integration suites and the existing spend-tier suite; both app TypeScript checks; strict shared-helper TypeScript. Claude's subsequent implementation review approved staged deployment and completed Deno checking successfully. The deployment runbook is now written in docs/DEPLOY_R1-R4_RUNBOOK.md and awaits Claude's document review, then product-owner deployment authorization. Nothing deployed and no live data/provider API accessed. Unknown-metadata age-based orphan deletion is deferred because the created timestamp was not confirmed. See the final entries and copy-ready prompt for files, deviations and exact commands.

## Historical status (2026-09-25): Independent implementation review complete — changes requested

Card linking, manual spend/undo and Test-mode automatic credit are implemented, deployed and partly device-tested. The original signed auth/clearing verification is retained below. Current read-only metadata reports `fidel-webhook` **version 6**, ACTIVE, `verify_jwt: false`, with source matching the reviewed selector implementation. Refund delivery/signature/correlation remain unverified; the missing Test-mode delivery has no established cause. Do not call it a proven Test-mode limitation.

Existing tests pass: **33/33** pure helper/webhook tests, **3/3** focused disposable database suites, and shopper/retailer TypeScript. Additional tests reproduce lifecycle, refund correlation, activation and manual-entry defects. See `docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md` (R1–R9). Next: Claude reviews the repair contracts, then Codex makes additive local fixes before another payment test. No product-owner input is needed for that review. The old zero-balance fixture prompts are historical: the test shop now has purchases and manual/undo activity. Checkpoint 6 notification dispatch, refund/reconciliation evidence and other release gates remain open.

The completed provider research is in `docs/PAYMENT_PROVIDER_RESEARCH_2026-09-25.md`. Square is the leading additional technical pilot candidate, conditional on contract permission and device evidence. SumUp/Solo and Zettle transaction feeds do not establish safe repeat-shopper identity. Keep spend-based rewards with manual spend where automatic coverage is unavailable; no provider-wide Fidel exclusion or new integration has been approved.

See [IMPLEMENTATION_TIMELINE.md](IMPLEMENTATION_TIMELINE.md) for responsibilities, milestone order and the next messages for each agent. Read the latest project files directly from disk; the user should not need to attach them to chat. Both agents update this handoff after every completed item. Preserve the history below while reconciling conflicting assumptions.

## Done
- 2026-09-22 — Codex: final local verification for this pass found no whitespace
  errors across the 11 touched implementation/documentation files, and the
  no-emit TypeScript check passed for all Fidel helper modules. The embedded
  PostgreSQL integration test and four helper tests passed earlier in this pass.
  No full Supabase stack test, genuine signed Fidel delivery, production migration
  or Edge Function deployment has been run.
- 2026-09-22 — Codex: checked the Fidel test dashboard's delivery history
  read-only. It currently shows zero deliveries, so there is no provider-signed
  request available to use as the checkpoint-3 test vector. No dashboard state
  was changed.
- 2026-09-22 — Codex: inspected the signed-in Fidel dashboard in Brave read-only.
  The Loyalty Loop test program has no location yet and currently has one
  transaction.auth subscription pointing to an external test collector, with no
  clearing or refund subscription shown. The separate Demo Program has test
  locations/cards and an existing authorization transaction; its actual transaction
  object is a bare JSON object with distinct accountId/card.id values, GBP amount
  10 (major units), nested card.id/location.id and no event field. This confirms
  the parser's core auth shape but is not a signed delivery for the Loyalty Loop
  subscription. No dashboard settings, keys or transactions were changed.
- 2026-09-22 — Codex: marked ARCH_PLAN.md §0's former stamp proposal as historical
  and superseded by §0a, so readers do not mistake it for the active Fidel path.
- 2026-09-22 — Codex: caught and fixed a TypeScript narrowing error in the
  transaction validator's optional originalTransactionId. A direct TypeScript
  no-emit check now passes for all three Fidel helper modules; four helper tests
  still pass.
- 2026-09-22 — Codex: added an isolated bare-transaction validator in
  supabase/functions/fidel-webhook/transaction.ts. It requires GBP, provider IDs,
  card/location IDs, booleans and event-specific amount signs, and extracts the
  signed top-level amount token before pence conversion. Four helper tests pass,
  including refund payload shape and invalid auth/currency/card cases. Event type
  must still be bound to a registered signed URL and subscription secret by the
  eventual Edge Function; this helper does not mutate data.
- 2026-09-22 — Codex: reconciled IMPLEMENTATION_TIMELINE.md with the approved
  spend-threshold pivot and current implementation status. It now identifies the
  dedicated notification function and the pending database review. The hosted
  timeline site is still a published snapshot and was not republished in this
  backend implementation pass.
- 2026-09-22 — Codex: rechecked Fidel's current official Select Transactions
  Webhooks and Transactions documentation before wiring the handler. It explicitly
  describes refunds as separate negative-amount transactions with
  originalTransactionId when Fidel can match the purchase, and says a refund also
  emits a negative transaction.clearing event. The published transaction webhook
  examples show a bare transaction object, without an event field. Updated ARCH_PLAN.md
  §2/§4.1/§4.1a/§4.3 to reflect these facts and the required signed-URL event routing.
  The exact sandbox subscription configuration and signed delivery remain to verify.
- 2026-09-22 — Codex: corrected the decimal helper for documented negative refund
  amounts and added a raw-JSON top-level number-token reader that ignores nested
  amount fields and rejects duplicate amount keys. Three security/amount tests pass,
  including negative bounds and malformed values. This work is isolated; no webhook
  has been deployed or connected to the database.
- 2026-09-22 — Codex: implemented isolated checkpoint 3 signature code in
  supabase/functions/fidel-webhook/signature.ts. It signs the exact raw body,
  configured registered URL and millisecond timestamp with Fidel's documented
  double HMAC-SHA256/Base64 scheme, checks a five-minute timestamp window and
  compares signatures without content-dependent early exit. The independent
  Node crypto reference test passed, including tampering, URL mismatch and stale/
  future timestamps. Fidel's current official Select webhook documentation was
  checked. A real signed sandbox delivery is still required before this checkpoint
  can be considered provider-verified.
- 2026-09-22 — Codex: implemented isolated checkpoint 4 decimal conversion in
  supabase/functions/fidel-webhook/amount.ts. It accepts nonnegative decimal strings
  with at most two fractional digits, converts through BigInt, and rejects
  malformed precision and PostgreSQL integer overflow. Its boundary tests passed
  in supabase/functions/fidel-webhook/security.test.mjs. The full webhook parser
  must feed it the original numeric token from the signed raw JSON body.
- 2026-09-22 — Codex: extended the isolated PostgreSQL test to exercise authenticated
  RLS as well as the spend logic. It confirms a shopper sees only their own linked
  card, cannot see merchant Fidel locations or insert a card directly, while the
  business owner can read their mapped location. The test still passes. Node syntax
  and whitespace checks pass. This fixture is local PostgreSQL with Supabase-style
  roles and helper functions; the full hosted Supabase behavior remains to be tested
  once sandbox integration is available.
- 2026-09-22 — Codex: completed revised checkpoint 2 in
  supabase/migrations/20260922194307_fidel_spend_processing.sql. The new
  handle_spend_transaction trigger locks the membership, rejects missing thresholds
  and mismatched membership IDs, carries spend in pence, issues one reward for each
  crossed threshold, increments visit activity, and clears a refund hold once progress
  recovers. The service-role-only apply_spend_clawback function accepts a negative
  delta, updates the balance atomically and sets or clears the redemption hold. A
  1000-reward-per-transaction guard prevents a misconfigured 1p threshold from
  creating millions of rows; Claude should review that limit. Legacy stamp machinery
  remains untouched. No production deployment occurred.
- 2026-09-22 — Codex: added and ran
  apps/api/test/integration/fidel-supabase-spend.test.mjs against an isolated embedded
  PostgreSQL 18 instance. It applied all three new migrations in order and passed
  purchase threshold crossing, remainder carry, negative refund clawback, blocked
  staff redemption, rejection of direct progress tampering, hold recovery and the
  legacy 50-value constraint. One test passed. The sandboxed first attempt failed
  because Node could not read Windows user information; the same test passed with
  the isolated process allowed outside the filesystem sandbox. This is a local
  database fixture, not the full Supabase stack, so RLS against real Supabase roles
  and provider payloads remain unverified.
- 2026-09-22 — Codex: rebuilt checkpoint 1 for the approved cumulative-spend model.
  The original unapplied migration now commits the new transaction_type enum value;
  the CLI-generated 20260922194020_fidel_spend_schema.sql follows with the four Fidel
  tables, businesses.reward_model/reward_threshold_pence,
  memberships.reward_progress_pence/redemption_blocked_reason, and a spend-aware
  transactions.value constraint. Removed the superseded stamp/carry pool fields from
  Fidel transaction state. Extended enforce_membership_update_scope to protect the
  new monetary fields from direct customer/owner/staff updates while allowing the
  trusted service role and nested spend trigger; retained the existing redemption
  guard. Static checks found four tables, four RLS enables, the required spend
  columns and constraint, and no old pool/stamp columns. Database execution is the
  next verification item; no production change was made.
- 2026-09-22 — Claude: re-reviewed the checkpoint-1 fix in
  `supabase/migrations/20260922171734_fidel_stamp_foundation.sql`. **Approved.** The
  immutable-fields check now compares the real `rewards` columns (`qr_token`,
  `short_code`, `catalog_id`) exactly as specified in the required fix, exception text
  matches the original function, and the redemption-block logic (checking
  `redemption_blocked_reason`, lines ~177–201) is unchanged from the version already
  reviewed as correct. No further changes needed to this migration. Checkpoint 2 is
  unblocked.
- 2026-09-22 — Codex: fixed the checkpoint-1 blocking defect in
  supabase/migrations/20260922171734_fidel_stamp_foundation.sql before it was applied
  anywhere. The replacement rewards trigger now compares only real rewards columns:
  user_id, business_id, title, qr_token, short_code, catalog_id, expires_at and
  created_at. It restores the original exception text and retains the reviewed
  redemption-block branch unchanged. Static verification passed: four provider tables,
  four RLS enables, two policies, all eight expected immutable fields, no obsolete
  fields and no whitespace errors. Local database lint remains unavailable because no
  local Supabase/Postgres database is running. **Claude re-review is required before
  checkpoint 2; no production deployment occurred.**
- 2026-09-22 — Codex: implemented milestone 4 / checkpoint 1 in
  supabase/migrations/20260922171734_fidel_stamp_foundation.sql. The migration adds
  the four planned provider-state tables (linked_cards, business_fidel_locations,
  fidel_transactions, fidel_webhook_events), maps the external card identifier to
  fidel_card_id, adds membership carry/block fields, enables RLS on each new table,
  denies direct browser writes, and adds the required enforce_rewards_update_scope
  extension. The trigger blocks staff redemption while a membership has a non-null
  block reason, while preserving the established business-owner/admin path. Static
  checks passed: four tables, four RLS enables, the redemption guard and no direct
  client write grants were all found; git diff --check found no whitespace errors.
  supabase db lint --local could not run because no local Postgres is listening on
  127.0.0.1:54322 (the CLI reported ECONNREFUSED). No database was changed and no
  production deployment was attempted. **Claude review required before checkpoint 2.**
- 2026-09-22 — Codex: published the owner-private timeline website at https://loyalty-loop-roadmap.zahih.chatgpt.site using Sites. Deployment `appgdep_6ab2b73673fc81918ed9e5a86c4b4d9f` succeeded; source commit `a0b842e0e64592875779fb7ce1df31934c1f0867` in the separate `timeline-site` checkout. Content checks verified all ten milestones, prompt targets and inline JavaScript syntax; local preview returned HTTP 200. This is a snapshot, not automatic live sync: after timeline changes, run `node timeline-site/render.mjs`, run `node timeline-site/check.mjs`, and republish the same Site using `.openai/hosting.json`. Portable source snapshot and maintenance steps are in `timeline-site/README.md`. Next backend action remains Claude's architecture review. Publishing issues were resolved without creating a second Site.
- 2026-09-22 — Codex: built the timeline website in `timeline-site/`, generated from `IMPLEMENTATION_TIMELINE.md`. Includes ten expandable milestones, role responsibilities, completion criteria and copyable handoff prompts; responsive layout and keyboard-accessible native controls. Local preview returned HTTP 200; render/preview scripts passed syntax checks. Hosting registration returned a transport error; checking the existing Site state before any further registration attempt. No backend implementation changed.
- 2026-09-22 — Codex: created `IMPLEMENTATION_TIMELINE.md` with product-owner, Claude Code and Codex responsibilities through architecture review, local implementation, sandbox testing and live pilot. Updated root agent instructions to use the shared files directly, without an extra changelog. Verification: reviewed the timeline and file references; no application code changed or tests rerun for this documentation task.
- 2026-09-22 — Codex (prior work, recorded here for shared context): built the standalone `apps/api` Express/Prisma prototype. Its 10 request tests and 10 disposable PostgreSQL integration tests passed, as did lint, type checking, build and Prisma validation during that implementation. It is not deployed or integrated with Supabase. It grants provisional whole stamps per purchase without carry; it does not implement the final refund, linking or notification workflows. Reuse verified security/tests where appropriate, not its separate production architecture.
- 2026-09-22 — Claude: planning discussion with product owner, six design decisions
  confirmed (stamp-on-auth + refund clawback, proportional partial refunds,
  `(transaction_id, event_type)` idempotency, merchant resolution by `location.id` not
  MID, Fidel SDK card linking, GBP-only), plus stack decision (Supabase, not
  Express/Prisma) and notification approach (reuse `send-user-push`, synchronous).
- 2026-09-22 — Claude: inspected existing repo schema (`0001_foundations_auth.sql`,
  `0004_core_loop.sql`) and existing Edge Function conventions
  (`whatsapp-webhook`, `send-user-push`) to ground the plan in what's actually here,
  not invented from scratch.
- 2026-09-22 — Claude: fetched Fidel's actual webhook docs (signature construction,
  headers, retry behavior, event types, transaction object fields) — see ARCH_PLAN.md §2
  and its sources.
- 2026-09-22 — Claude: wrote [ARCH_PLAN.md](ARCH_PLAN.md) — full schema (§3), webhook
  lifecycle (§4), points math (§5), assumptions/unresolved items (§6), review-checkpoint
  order (§7).
- 2026-09-22 — Claude: resolved the pence-carry-pool open question (customer×merchant
  level pool via `memberships.pending_pence`, not per-transaction) and updated
  ARCH_PLAN.md §3.3/§3.5/§4.3 accordingly, including the accepted precision tradeoff on
  refunds against pooled pence.
- 2026-09-22 — Claude: **completed milestone 1 (architecture correction)**, per Codex's
  review in `IMPLEMENTATION_TIMELINE.md`. Re-verified every flagged claim against
  Fidel's docs directly rather than accepting either the original draft or Codex's
  correction on trust. Confirmed and fixed: (1) signature is **double** HMAC-SHA256,
  base64 at each pass — original plan had single-pass, would have rejected every real
  webhook; (2) `amount` is a **decimal major-unit number** (e.g. `5.44`), not integer
  pence — original plan would have under-credited ~100x; added a float-avoiding
  conversion (§4.1a). Corrected on the strength of available evidence, flagged for
  sandbox spot-check: (3) resolve linked cards by `card.id`, not `accountId` (evidence
  suggests `accountId` identifies our platform account, not the customer) — renamed
  `linked_cards.fidel_account_id` → `fidel_card_id`, kept `fidel_account_id` as an
  audit-only column. Could not confirm either way, designed to fail safely regardless:
  (4) whether a refund shares the original transaction's `id` or has its own
  correlation field — §4.3 now tries both shapes and refuses to guess if neither
  resolves, rather than risking a silent mismatch. Also closed two real gaps: redemption
  is now enforced server-side (§4.4a, extends `enforce_rewards_update_scope`) rather
  than left as a UI-only "out of scope" item; and notification dispatch is redesigned
  (§4.6) around a new service-role `send-stamp-notification` function + a `pg_cron`
  recovery sweep, since `send-user-push` as it actually exists requires an end-user JWT
  and can't be called by a webhook at all. Also added: >50-stamp chunked insert
  handling (a large single transaction could exceed the `transactions.value <= 50`
  check and silently drop a stamp grant). Full detail in ARCH_PLAN.md §2, §2.1, §4.1,
  §4.1a, §4.2, §4.3, §4.4a, §4.6, §6, §7. No new product questions were needed from you
  for this pass — capacity/throughput stays correctly deferred to milestone 2 per the
  timeline; everything else was resolvable from docs or was already a confirmed
  decision, preserved unchanged (§1 decisions #1–#6, #8–#10 untouched).

## Milestone 4 checkpoint 1 review (2026-09-22) — NOT approved, one blocking defect

Reviewed `supabase/migrations/20260922171734_fidel_stamp_foundation.sql` against
ARCH_PLAN.md §3/§4.4a and the actual `rewards` table schema (`0004_core_loop.sql`,
already inspected earlier this session). Did not edit the migration myself — that's
Codex's fix to make, I only fixed my own document (see below).

**Blocking defect:** the rewritten `enforce_rewards_update_scope()`'s immutable-fields
check (around line 156) compares `new.description`, `new.image_url`,
`new.points_cost`, `new.required_stamps`, `new.is_active` — **none of these columns
exist on `rewards`.** The real columns (per `0004_core_loop.sql`) are `qr_token`,
`short_code`, `catalog_id`, none of which are checked in the new version. Postgres
resolves `NEW`/`OLD` field access on trigger functions at *runtime*, not at
`CREATE FUNCTION` time, so this migration applies without error — then the very next
reward redemption (existing, already-shipped functionality, not new code) throws
`record "new" has no field "description"` and fails outright. This also silently
dropped the original tamper-protection on `qr_token`/`short_code`/`catalog_id`. The new
redemption-block logic (the part checking `redemption_blocked_reason`, lines ~179–202)
is correctly designed per §4.4a and should be kept exactly as-is — only the
immutable-fields check needs fixing.

**Exact required fix** — replace the field-comparison block (~lines 156–177) with:
```sql
  if new.user_id != old.user_id
    or new.business_id != old.business_id
    or new.title != old.title
    or new.qr_token != old.qr_token
    or new.short_code != old.short_code
    or new.catalog_id is distinct from old.catalog_id
    or new.expires_at is distinct from old.expires_at
    or new.created_at != old.created_at then
    raise exception 'only redeemed_at may be changed';
  end if;

  if old.redeemed_at is not null then
    raise exception 'reward already redeemed';
  end if;

  if new.redeemed_at is not null
    and new.expires_at is not null
    and new.redeemed_at > new.expires_at then
    raise exception 'reward has expired';
  end if;
```
(Exception message text matches the original function for consistency — cosmetic, but
worth keeping.) Leave everything from `if new.redeemed_at is not null and old.redeemed_at is null then` onward unchanged.

**My own doc bug, fixed (no migration change needed for this one):** ARCH_PLAN.md §3.3
still had a leftover `pence_carry` column on `fidel_transactions` from before the pool
design was resolved, and §5 referenced it as an unresolved open question that no longer
exists. Codex's migration correctly built the table *without* `pence_carry` — the pool
design (`memberships.pending_pence` + `pool_pence_in`/`pool_pence_out`, both present in
the migration) supersedes it. Codex built it right; my document just never got cleaned
up after I resolved the pool design earlier this session. Fixed in ARCH_PLAN.md now.

**Answers to the review questions left in this file previously:**
1. Table constraints, indexes, RLS and the browser/service-role privilege boundary all
   fit — no changes needed. `on delete restrict` on the `fidel_transactions` FK chain is
   a sound choice for audit-trail integrity that ARCH_PLAN itself left unspecified.
2. Immutable fields: **broken, see blocking defect above.** Redemption-block logic
   (staff blocked, owner/admin unblocked): correct, no changes needed.
3. `unique (fidel_transaction_id, event_type)` does not need to change now — it's
   correct for the "same id across the lifecycle" case and ARCH_PLAN §4.3 already
   specifies fail-safe handling (log/alert/ack, don't guess) if a refund turns out to
   use a different correlation shape. No schema change should be made speculatively
   before the sandbox payload is confirmed.
4. Missing-membership handling is fine as implemented: it's a safe defensive check that
   should be unreachable in normal operation, since a `rewards` row can only be created
   by `handle_stamp_transaction`, which itself requires an existing membership. No
   explicit recovery policy needed beyond the exception it already raises.

**Minor, non-blocking, noted for later — not required before checkpoint 2:**
`original_amount_pence` uses `check (... > 0)` vs. ARCH_PLAN's `>= 0`; if Fidel ever
sends a genuine £0.00 auth (some networks do zero-value verification auths), this
throws inside the future atomic RPC rather than being handled as a graceful no-op —
decide when building checkpoint 5, not now. Also: `linked_cards.fidel_card_id` is
globally unique with no upsert path for re-linking a previously-unlinked card — relevant
to the card-linking flow, which is explicitly out of scope for this plan (§6 item 6);
flagging so it isn't forgotten when that flow is designed.

- 2026-09-22 — Claude: **milestone 2 progress** — product owner supplied a capacity
  estimate (~100 payments/day platform-wide, explicitly provisional/revisable). Turned
  into a worked burst example and a concrete test target in ARCH_PLAN.md §8: 10
  concurrent distinct-transaction webhooks within 1 second must process correctly, p95
  end-to-end latency under 3 seconds. Codex should write the concurrency test
  parametrized on transaction count so raising this number later is cheap. Milestone 2
  is not fully closed — "refunds after redemption" and "merchant thresholds" policy
  were already confirmed in the original planning pass (§1 decisions #3, and
  per-merchant `pence_per_stamp` config in §3.2/§6), so the only missing piece was this
  capacity number, now supplied.

- 2026-09-22 — Claude: **milestone 3 progress** — product owner created the Fidel
  sandbox account and "Loyalty Loop" Program. Program ID:
  `0c0b69e5-b7b0-4872-9ab0-09aeba720b95` (confirmed test-mode; not treated as a secret —
  Program IDs appear in Fidel's own transaction payloads, unlike the webhook
  `secretKey`/API keys, which must go in Supabase secrets, never here). This is the
  value for `business_fidel_locations.fidel_program_id` once a test location is
  enrolled under it. Still needed before checkpoint 5 (webhook) can be finished: a test
  location's `location.id`, the webhook's `secretKey`, and a real sandbox transaction
  (esp. a refund) to resolve the still-open correlation question (§6 item 1).

- 2026-09-22 — Claude: added **§6a merchant location enrollment** to ARCH_PLAN.md, per
  product discussion — merchants don't get their own Fidel account; our backend
  auto-creates their Fidel Location via API when their business is approved, reusing
  onboarding data already collected. Introduces a new secret (`FIDEL_API_KEY`,
  distinct from the webhook `secretKey`), a new `enroll-fidel-location` Edge Function,
  and a `pg_net`-triggered `AFTER UPDATE` on `businesses.approval_status`. Explicitly
  **not** part of the current §7 checkpoint sequence — flagged one real open question
  (how the existing `brand_id` franchise grouping maps to Fidel's own Brand hierarchy)
  that needs resolving before Codex builds this, not guessed. Also confirmed in this
  session: the manual staff-scan stamp flow stays a **permanent fallback**, not a
  stopgap — Fidel enrollment failing must never block a business from being approved
  or usable.

- 2026-09-22 — Claude: added **§4.8 dual-earning prevention** to ARCH_PLAN.md — a real
  gap surfaced in product discussion: nothing currently stops a customer earning a
  stamp both automatically (linked card used) and manually (staff also taps "add
  stamp" for the same visit), since those are two independent paths into
  `transactions`. Fix: extend `transactions_insert_owner_or_admin` RLS (in
  `0004_core_loop.sql`) to reject a manual stamp insert when the customer has an
  active `linked_cards` row and the business has a `business_fidel_locations` row —
  blocked at the database, not just hidden in the retailer app's UI. Admin keeps an
  override for genuine Fidel misses; owner/staff do not. Buildable any time (schema
  already exists from checkpoint 1) but only matters once customers can link cards —
  **must ship before or alongside the card-linking flow**, not before now. Not part of
  the current §7 checkpoint sequence.

- 2026-09-22 — Claude: added **§6z analytics follow-up** to ARCH_PLAN.md — checked the
  existing `analytics-summary`/`deep-business-report` functions directly (no
  amount/revenue field anywhere in the current schema, only stamp counts and
  timestamps). `fidel_transactions.original_amount_pence` (already in the approved
  checkpoint-1 migration) is the platform's first real monetary data, but nothing
  currently queries it — flagged as unscoped follow-up work (revenue/CLV query layer,
  RLS-scoped to the owner; a blended view honest about partial Fidel-only coverage; AI
  summary integration TBD). Not part of the current §7 checkpoint sequence.

- 2026-09-22 — Claude: added **§4.9 unified earning rule** to ARCH_PLAN.md —
  **this one affects checkpoint 5, not just a later follow-up.** Real gap: manual
  staff-tap stamping is "1 tap = 1 stamp" regardless of amount, but Fidel as originally
  specified is spend-based (`pence_per_stamp`) — unreconciled, a customer could earn a
  stamp for a £2 coffee manually but not via their linked card for the identical
  purchase. Fix: new `businesses.loyalty_config.earning_mode` (`'per_visit'` default,
  or `'per_amount'`), both channels obey whichever is set. Business default stays
  `per_visit` (matches today, no new config burden). **When Codex builds checkpoint 5
  (full webhook body), the auth-event stamp calculation in §4.3 needs to branch on
  `earning_mode` first** — `per_visit` grants exactly 1 stamp per qualifying auth
  (ignoring amount beyond a £0 floor, no carry-pool interaction), `per_amount` uses the
  math already specified. The `per_amount` manual-entry UI change is separate app-layer
  follow-up work, not blocking checkpoint 5.

## Reward model pivot — resolved, ARCH_PLAN.md fully updated (2026-09-22)

Product owner confirmed: **spend-threshold replaces stamps for every business**
("choose how much a customer must spend to earn a reward, keep adding what they spend
until they cross it — no stamp units at all"), and **hide, don't delete** the existing
stamp system — `memberships.stamp_count`, `reward_catalog.stamp_threshold`, and
`handle_stamp_transaction` stay in the schema untouched and dormant, reactivatable
per-business later via a new `businesses.reward_model` flag, not removed. Full design
in ARCH_PLAN.md §0a (new), with §3, §4.3, §4.4, §5, §4.8, §4.9 (retired), and §7 all
updated to match — read §0a first, it explains what superseded what and why.

**Net effect on what Codex previously built**: the checkpoint-1 migration
(`20260922171734_fidel_stamp_foundation.sql`) that was approved is **superseded, not
just amended** — `fidel_transactions.stamps_granted` and the pool columns
(`pool_pence_in`/`pool_pence_out`) are gone, `memberships.pending_pence` is replaced by
`reward_progress_pence`, and there's new machinery this migration didn't have at all
(`businesses.reward_model`/`reward_threshold_pence`, the `transaction_type` enum
addition, the relaxed `transactions.value` check, the new `handle_spend_transaction`
trigger). It was never applied to any database, so revising it in place is correct.

## Checkpoints 1–4 review (2026-09-22) — Claude, APPROVED, no blocking defects

Reviewed all three migrations (`20260922171734_fidel_stamp_foundation.sql`,
`20260922194020_fidel_spend_schema.sql`, `20260922194307_fidel_spend_processing.sql`),
the disposable PostgreSQL integration test
(`apps/api/test/integration/fidel-supabase-spend.test.mjs`), and the isolated webhook
helpers (`signature.ts`, `amount.ts`, `transaction.ts`, `security.test.mjs`) against
ARCH_PLAN.md and every item requested for this pass:

1. **Enum ordering** — correct. `alter type ... add value 'spend'` sits alone in the
   first migration (timestamp `171734`); every reference to `'spend'` (the CHECK
   constraint, the RLS policy) is in the later migration (`194020`). Each migration
   file is its own transaction, so this respects Postgres's rule against using a
   newly added enum value in the same transaction that added it.
2. **RLS / service-only `spend` inserts** — correct, stricter than the sketch: the
   replaced `transactions_insert_owner_or_staff_or_admin` policy is `type <> 'spend'
   and (...)`, blocking every authenticated actor — including admin — from inserting
   `type='spend'`, matching §4.3 exactly. Verified *executed*, not just inspected: the
   integration test's final block attempts a spend insert as the business owner and is
   rejected by "row-level security policy."
3. **Membership tamper guard** (`enforce_membership_update_scope`) — correct. The
   `reward_progress_pence`/`redemption_blocked_reason` check runs unconditionally,
   before the general privilege early-return, so owner/staff can't write either field
   directly even though they're otherwise privileged for other membership columns.
   Verified executed: the test's staff-role direct UPDATE is rejected with "reward
   progress requires a trusted transaction." The `pg_trigger_depth() > 1` exemption
   (letting `handle_spend_transaction`'s own nested UPDATE through) is technically
   redundant with the `_is_service_role` exemption today, since RLS already guarantees
   only a service-role request can ever make that trigger fire — harmless
   defense-in-depth, not a defect, no change needed.
4. **Refund/redemption row-lock order** — correct, verified with a genuine
   two-connection concurrency test, not inspection alone. `enforce_rewards_update_scope`
   locks the membership row `FOR UPDATE` while checking the block reason;
   `apply_spend_clawback`'s UPDATE takes the same row's lock. The test opens a second
   connection, starts a clawback inside an uncommitted transaction, and confirms a
   concurrent redemption attempt blocks until commit, then correctly sees the
   just-committed hold rather than stale data. No deadlock risk: redemption always
   locks rewards→memberships; clawback only ever locks memberships — never the reverse
   order.
5. **Multiple threshold crossings** — correct, and actually **fixes a real bug in
   ARCH_PLAN §4.3's own sketch**, which only granted one reward per crossing via a
   single `if`/modulo (marked "sketch, not final code" at the time). Codex's
   `handle_spend_transaction` instead does integer division
   (`_reward_count := _total / _threshold`) and loops that many times. Verified
   executed: the test's £12.50 transaction against a £5 threshold correctly produces
   exactly 2 rewards and £0.50 remaining progress. The 1000-reward cap (rolling back
   the whole transaction) is a reasonable backstop for a misconfigured near-zero
   threshold.
6. **Negative refund clawback + hold recovery** — correct. `apply_spend_clawback`
   requires a strictly negative delta and non-empty reason (stricter than §4.4's
   sketch), sets `redemption_blocked_reason` only when the resulting balance is
   negative. `handle_spend_transaction`'s own UPDATE clears the reason to null the
   moment a later purchase brings the balance back to ≥ 0, matching §4.4's inline
   recovery requirement exactly. Verified executed by the test (clawback goes
   negative → reason set; next purchase recovers → reason cleared).
7. **Double-HMAC raw-body verification** — correct against §2/§4.1's exact
   construction: `base64(HMAC(base64(HMAC(rawBody+url+timestamp))))`, both passes
   keyed by `secretKey`. `security.test.mjs`'s independent Node `crypto.createHmac`
   reference test confirms the exact byte sequence, plus tampered body/URL/signature
   and stale/future/malformed timestamp cases. Constant-time comparison is correctly
   length-gated then XOR-accumulated. Still not *provider*-verified — no genuine
   signed Fidel sandbox delivery exists yet — not a code defect, a test-vector gap
   already flagged.
8. **Exact pence conversion** — correct. `amountStringToPence` uses BigInt
   throughout, accepts a leading minus for refunds, rejects >2 decimal places, and
   enforces the Postgres int4 range exactly (boundary-tested at
   `21474836.47`/`-21474836.48`). `topLevelAmountToken`'s manual raw-JSON scan
   correctly ignores nested `amount` fields (depth-gated) and rejects duplicate
   top-level keys, avoiding a float round-trip through `JSON.parse`;
   `transaction.ts` cross-checks the raw token against the standard-parsed value as
   a consistency check.
9. **Event routing from subscription URL/secret** — not yet applicable to review as
   code, and that's correct sequencing, not a gap: the actual routing entrypoint
   (`index.ts`) is checkpoint 5, not built yet. What exists (`signature.ts`) is
   correctly shaped for it — `webhookUrl`/`secretKey` are caller-supplied parameters,
   not hardcoded. §2's open question (confirming Fidel's actual URL/secret-per-
   subscription behavior in the sandbox) remains unresolved and blocks checkpoint 5,
   not checkpoints 1–4.

**No blocking defects found in checkpoints 1–4.** Checked off in §7's list below.

### Pre-launch gap restated (not new, not part of checkpoints 1–4 — do not lose this)

`businesses.reward_model` defaults to `'spend_threshold'` for every business,
including ones with no Fidel integration at all. The existing manual staff-scan flow
still inserts `type='stamp'` transactions, firing the *old* `handle_stamp_transaction`
trigger — completely disconnected from `reward_progress_pence`/`reward_threshold_pence`.
A business with no Fidel card-linking activity, on the new default model, would
accumulate `stamp_count` under a reward model that no longer reads `stamp_count` for
anything — those customers would never earn a reward via staff scanning, silently,
until this is fixed. Already flagged before this review; restating it as confirmed,
still open, and must-fix-**before-launch** (not just before card-linking, per §4.8 —
any business going live today on the new default is already affected). This needs a
product-owner decision (see below), not a guess.

### Remaining sandbox evidence / product-owner input required before checkpoint 5 can be *connected* (not before it can be built)

- A genuine signed Fidel sandbox delivery (any event type), to confirm the
  double-HMAC construction against Fidel's real server, not just its docs — none
  exists yet (checkpoint-3's dashboard inspection found zero deliveries).
- A real signed `transaction.refund` sandbox payload, to confirm whether
  `originalTransactionId` points to the auth id or a distinct clearing id (§6 item 1)
  — still the single highest-priority open item.
- Confirmation, directly from the Fidel dashboard's subscription configuration UI,
  of whether registering one URL+secret per event type
  (`?event=transaction.auth` etc., as §4.1 assumes) is actually how Fidel's sandbox
  works, or some other provider-confirmed field carries the event type.
- A test Fidel Location under the Loyalty Loop Program (still zero locations per
  Codex's last sandbox inspection), so a real transaction can be generated at all.
- **Product owner**: a decision on the pre-launch gap above — should `stamp_legacy`
  become the default for businesses without Fidel enrollment, or should new
  businesses be required to set `reward_threshold_pence` at onboarding regardless of
  Fidel status? This determines what Codex builds for the manual-scan fix, not
  guessed here.

## Next action

**Current, 2026-09-25:** Claude reviews R1–R9 in `docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md`, corrects lifecycle/eligibility assumptions in the plans and defines additive local repairs, beginning with R1–R3. Use the single copy-ready Claude prompt at the end. No product-owner input is required for this design review. Production changes, fixtures and further device/provider actions are outside this review. Older entries and fixture instructions below are historical context.

**2026-09-22 Codex sandbox inspection:** In read-only Fidel test mode, the
Loyalty Loop Program still has zero locations and zero signed deliveries. Its
location wizard requires a real merchant Address, City, Postcode and Country;
the MID field is optional. I opened the wizard to inspect the required fields,
then cancelled every unsubmitted form and verified the location list was
unchanged. No location, webhook subscription, credential or test transaction
was created/changed. The product owner has been asked for the actual test
merchant details and threshold, and for whether API/webhook secrets are
already stored securely; do not invent them or put the values in this file.

**2026-09-22 Codex security fix (locally verified):** The newly added `spend`
transaction type was initially accepted by the existing merchant/staff insert
policy. That would let a browser fabricate arbitrary pence and trigger rewards.
`20260922194020_fidel_spend_schema.sql` now replaces that policy to reject
browser inserts of `spend`; the service-role webhook path remains able to write
it. This is not yet regression-tested against the disposable database. Claude
should include this policy boundary in checkpoint-1 review. Manual spend needs
a separately reviewed, server-validated RPC rather than reopening direct
table inserts.

**2026-09-22 Codex redemption race fix (locally verified):** The redemption
trigger in `20260922194020_fidel_spend_schema.sql` now locks the membership
row `FOR UPDATE` while checking `redemption_blocked_reason`. Without that lock,
a concurrent refund could update the balance after the redemption statement's
snapshot while the redemption still passed on stale state. A concurrent
refund/redemption regression test is still needed; Claude should review this
lock order in checkpoint 1.
The disposable PostgreSQL test now starts a refund in one connection, attempts
redemption in another before committing, and expects the redemption to see the
committed hold. Rerun passed: 1/1 disposable PostgreSQL integration test,
including the two-connection race and unchanged unredeemed reward.

**2026-09-22 Codex regression fixture update (locally verified):**
`apps/api/test/integration/fidel-supabase-spend.test.mjs` now reconstructs
the existing transaction insert policy before applying the new migration and
asserts that an authenticated business owner cannot insert `spend`. Run the
disposable PostgreSQL test before treating this fix as verified.
First run failed because the reduced PostgreSQL fixture lacked the real app's
authenticated `memberships` SELECT grant; the policy subquery raised
`permission denied for table memberships` before reaching the expected RLS
rejection. This is a fixture gap, not a passing security assertion. Fix the
fixture grant and rerun.
Fixture now grants authenticated SELECT on `memberships`, matching the
production membership read path. Rerun passed: `node --test
test/integration/fidel-supabase-spend.test.mjs` (1/1) in `apps/api`, using a
disposable embedded PostgreSQL instance outside the restricted shell sandbox.
The authenticated owner cannot insert a fabricated `spend` transaction.

**2026-09-22 Codex verification rerun:** The four isolated webhook helper tests
passed (4/4), the TypeScript no-emit check for signature/amount/transaction
helpers passed. These new files are untracked, so `git diff --check` alone does
not inspect them; a direct trailing-whitespace scan of the changed
migration/test/handoff paths found none. These are local checks only; there is
still no provider-signed delivery or hosted Supabase integration result.

**2026-09-22 Codex architecture sync:** `ARCH_PLAN.md` now requires the
service-only spend insert boundary and a membership row lock during
redemption, matching the tested migration. Claude should confirm both in
checkpoint-1 review rather than relying only on this Codex test.

**Claude Code: review revised checkpoints 1 and 2 before Codex starts checkpoint 3.**
Review the three migrations
(`20260922171734_fidel_stamp_foundation.sql`,
`20260922194020_fidel_spend_schema.sql`,
`20260922194307_fidel_spend_processing.sql`) and the disposable PostgreSQL test
(`apps/api/test/integration/fidel-supabase-spend.test.mjs`). Confirm the enum
migration order, spend constraints and RLS, the new membership-field tamper guard,
multiple-threshold reward issuance, negative refund and hold recovery, and the
1000-reward safety limit. Record approval or exact fixes here. In particular, decide
how the existing manual staff scan (currently inserts legacy `stamp` transactions)
must be switched to `spend` for businesses on the new default model before launch;
the old trigger remains active and the manual flow has not yet been adapted.

The checkpoint-3/4 helpers are staged locally under the user's instruction to
continue. They are not yet provider-verified or connected to a mutating endpoint.
A genuine Fidel sandbox signed request is needed for the provider-specific vector.

**Additional Claude review from Codex's continued work:** inspect
`supabase/functions/fidel-webhook/signature.ts`, `amount.ts`,
`transaction.ts` and `security.test.mjs`. Confirm double-HMAC signing,
the five-minute timestamp window, exact signed amount-token conversion, and the
documented negative refund shape. Review the new ARCH_PLAN.md §4.1 event-routing
note: Fidel's bare transaction examples omit an event field; each event
subscription has its own secret. Specify the exact registered URL and secret
mapping before wiring a mutating RPC. Also decide how auth and clearing
transaction IDs map when `originalTransactionId` points to a clearing ID,
and review the manual scan path before the spend model is activated.

Milestones 2 (capacity target) and 3 (Fidel sandbox access) can run in parallel — both
need the product owner, not Codex or Claude, to move first (an estimate, and Fidel
sandbox credentials respectively).

## Open items Codex must resolve before/during build (not guessed by Claude — see ARCH_PLAN.md §6)

- **Elevated priority**: pull a real signed Fidel sandbox `transaction.refund`
  delivery and confirm the documented distinct refund `id`, negative `amount`
  and `originalTransactionId`; verify the event-specific registered URL and
  webhook secret. Fidel's docs support this shape, but the user's subscription has
  not yet produced a local test vector.
- Spot-check `card.id` vs `accountId` against a real sandbox payload alongside the
  above — the correction is evidence-based, not sandbox-confirmed.
- Confirm each merchant's `businesses.reward_threshold_pence` before activating
  spend rewards. The database permits null during onboarding; the spend trigger
  rejects it at transaction time.

## Out of scope for this plan (flagged, not forgotten)

- Fidel card-linking UI/flow in the shopper app (how `linked_cards` rows actually get
  created, now writing `fidel_card_id`). Needs its own plan before end-to-end shipping.
- `apps/api` (the standalone Express/Prisma prototype) is not the production direction —
  see ARCH_PLAN.md §6 item 8. Do not port its architecture; its tests may be useful
  reference for edge cases only.

## Review checkpoints (ARCH_PLAN.md §7, revised 2026-09-22) — check off as Claude reviews each

- [x] 1. Revised spend migration (§3 schema + §4.4a redemption guard) — Claude-approved 2026-09-22, no blocking defects
- [x] 2. `handle_spend_transaction` + `apply_spend_clawback` (§4.3–§4.4a) — Claude-approved 2026-09-22, no blocking defects; multi-threshold-crossing fix confirmed correct
- [x] 3. Double-HMAC signature verification + timestamp tolerance (§4.1) — Claude-approved 2026-09-22, no blocking defects; genuine signed sandbox vector still needed before provider-verified
- [x] 4. Amount conversion as an isolated unit-tested function (§4.1a) — Claude-approved 2026-09-22, no blocking defects
- [x] 5. Full webhook body wired to atomic RPC and refund correlation fail-safe (§4.2–§4.4a, §4.5) — Claude-approved 2026-09-22, two non-blocking gaps to fix before a live route (see review above); synthetic tests only, no provider-signed delivery yet
- [ ] 6. `send-stamp-notification` + `pg_cron` recovery sweep, service-role auth reviewed specifically (§4.6)
- [ ] 7. Mock payload generator + full test suite (§7)

**2026-09-22 Codex coordination update:** `AGENTS.md` and `CLAUDE.md` now
require every Codex run to replace the copy-ready Claude prompt below with the
current next task, and require Claude to replace it with Codex's next task
after review. This keeps one current handoff prompt on disk without chat-file
uploads or a separate changelog.

**2026-09-22 Codex checkpoint 5 implementation:** Generated
`20260922215848_fidel_webhook_processing.sql` with the official Supabase CLI,
then added the service-role-only `process_fidel_webhook_event` RPC. It inserts
the delivery ledger first, returns idempotent/unknown/reconciliation outcomes
without retry loops, locks the membership, credits authorization spend through
the existing trigger, ignores negative/auth-false clearings, and applies only
correlated negative refund clawbacks. Added the `fidel-webhook` Edge Function
and its `verify_jwt = false` configuration; it requires exact event-specific
registered URL and secret environment mappings and validates raw-body signature
before parsing. Not yet synthetically tested or provider-verified; no database
or Edge Function was deployed.

**2026-09-22 Codex checkpoint 5 handler verification:** Added
`handler.synthetic.test.mjs`. Its four tests generate **synthetic** signed
requests with `fidelSignature()` and confirm one RPC call with exact pence
arguments, signature/malformed-payload rejection before RPC, acknowledged
duplicate/reconciliation outcomes, and refusal of unconfigured routes. The
handler and helper TypeScript no-emit check passed. These tests are synthetic,
not a provider-signed sandbox vector; no Fidel URL, secret, live database or
deployment was used.

**2026-09-22 Codex checkpoint 5 database test correction (resolved):**
The first disposable PostgreSQL run reached the new RPC and failed only because
the test expected a balance as though its earlier concurrent-refund test had
not intentionally left a 100-pence clawback applied. Corrected the two later
synthetic expected balances (350 then 150 pence). This was a fixture
expectation error, not an RPC assertion. The corrected rerun passed.

**2026-09-22 Codex checkpoint 5 database verification:** Rerun passed (1/1)
against disposable embedded PostgreSQL. The test applies all four Fidel
migrations and exercises synthetic atomic authorization, duplicate delivery,
negative-clearing ignore, correlated partial refund/clawback, and unresolved
refund acknowledgement. It remains a synthetic local test, not a signed Fidel
sandbox delivery or hosted Supabase test.

**2026-09-22 Codex local-runtime check:** `deno` is not installed and local
`supabase db lint --local` cannot connect because no Docker Supabase stack is
running at `127.0.0.1:54322`. The official CLI confirms the Edge Function serve
command is available, but no Edge Runtime smoke test was run. Updated
`IMPLEMENTATION_TIMELINE.md` to mark checkpoint 5 implemented and awaiting
Claude review; no deployment or live database access occurred.

**2026-09-22 Codex final checkpoint 5 checks:** The combined helper and
synthetic handler suites passed (8/8), TypeScript no-emit passed for all four
non-runtime webhook modules, and a direct trailing-whitespace scan of every
checkpoint-5 changed source, migration, test and handoff/timeline file found
none. Node issued only its expected module-type warning while executing `.ts`
test imports. The Git worktree remains otherwise user-dirty; no unrelated file
was changed or reset.

**2026-09-22 Codex pre-live review fixes (tests pending):** Exact-zero auth
and clearing events now pass parse validation, create only an idempotency-ledger
entry, and return `ignored_zero_amount` without merchant/card resolution or
reward changes. Refunds exceeding their original authorization, or implying a
progress increase, now return `invalid_refund` after the ledger insert rather
than throwing and rolling it back; the handler acknowledges and logs that
outcome. RPC failure logs now retain the provider-safe diagnostic message with
the code. No endpoint route, secret, database or deployment was configured.

**2026-09-22 Codex pre-live test and plan update (checks pending):** Added
synthetic handler coverage for a signed zero authorization, parser coverage
for zero auth and rejected zero refund, and database coverage that a zero auth
creates no spend transaction while an over-refund is ledgered as
`invalid_refund` and its replay returns `duplicate`. Updated `ARCH_PLAN.md`
with the zero-event and permanent over-refund acknowledgement decisions.

## Checkpoint 5 review (2026-09-22) — Claude, APPROVED with two non-blocking fixes required before a live route

Reviewed `20260922215848_fidel_webhook_processing.sql`, `handler.ts`, `index.ts`,
`signature.ts`, `amount.ts`, `transaction.ts`, `handler.synthetic.test.mjs`, and
`supabase/config.toml` against every item requested. Full findings:

**No changes needed** — service-role-only execution (DB grant + in-function check,
correctly redundant); empty `search_path` with fully-qualified references throughout
(stronger than ARCH_PLAN's own sketch); ledger-first idempotency via a savepoint-style
exception block; unknown merchant/card/membership all ack 200 via normal return;
membership `FOR UPDATE` lock before any logic, **plus** locking the `fidel_transactions`
row during refund processing (a correct addition beyond ARCH_PLAN's sketch); auth
credits only through the `transactions` insert → trigger path, never touches
`reward_progress_pence` directly; clearing correctly distinguishes and ignores the
negative-amount/`auth=false` refund side-effect, never re-grants on a genuine positive
clearing; unresolved-refund correlation failures ack 200 for manual reconciliation;
proportional clawback math verified by hand against repeated partial refunds, including
the guard against a refund somehow increasing progress; signature verified on the raw
body strictly before JSON parsing; 4xx/5xx split is correct for the normal paths.

**Two real, non-blocking gaps — fix before connecting a live route (not before, this
review doesn't block checkpoint 5 itself being "done" as implementation):**
1. Exact-£0 auth/clearing events are rejected as `malformed_payload` (400) rather than
   treated as a deliberate no-op ack. A genuine £0 verification event is a known card-
   network pattern, not malformed data. Fidel's retry behavior on non-2xx generally
   isn't confirmed to distinguish 4xx from 5xx, so this risks burning all 3 retries and
   silently dropping a legitimate event. This is the same item flagged "decide at
   checkpoint 5" in an earlier review — now here, needs an actual decision: treat
   exact-zero amounts as a benign 200 ack, not an error, in both `transaction.ts`'s
   parse-time checks and the RPC's own guards.
2. RPC exceptions all map to a uniform 500, including ones that can never succeed on
   retry — `refund exceeds original authorization amount` is a genuine provider-data
   scenario (not just an unreachable parse-bug guard), and because the exception rolls
   back the whole transaction, the ledger insert is undone too, so a retried delivery
   isn't even recognized as "already seen." Separately, `handler.ts`'s error log only
   captures `error.code`, dropping `error.message` — for this exact exception, that
   turns a clear diagnostic string into an opaque code. Fix: distinguish
   "won't-succeed-on-retry" RPC exceptions (map to 400, don't burn retries) from
   genuine transient failures (500), and log `error.message` alongside `error.code`.

Neither gap risks a double-credit or a security hole — both are about turning rare edge
cases into lost events or harder debugging, not correctness of the core money-moving
logic. Checkpoint 5 checked off below with these two fixes as the concrete next task.

## Previous copy-ready prompt for Codex — superseded

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Checkpoint 5 is approved with two required, non-blocking fixes — see "Checkpoint 5 review (2026-09-22)" in `CLAUDE_HANDOFF.md` for full detail: (1) treat exact-£0 `transaction.auth`/`transaction.clearing` amounts as a benign 200 ack instead of `malformed_payload`/an RPC exception — fix in both `transaction.ts`'s parse-time validation and `process_fidel_webhook_event`'s own guards; (2) in `process_fidel_webhook_event`, distinguish RPC exceptions that can never succeed on retry (e.g. `refund exceeds original authorization amount`) from genuine transient failures — the former should map to a 4xx in `handler.ts`, not the current uniform 500, since retrying an un-fixable payload wastes Fidel's 3 attempts for nothing; also log `error.message` alongside `error.code` in `handler.ts`'s RPC-failure branch, since the current log drops the diagnostic string entirely. Re-run the synthetic handler suite plus the disposable-PostgreSQL integration test after both fixes and record the result in `CLAUDE_HANDOFF.md`. Then proceed to checkpoint 6 (`send-stamp-notification` Edge Function + `pg_cron` recovery sweep, per `ARCH_PLAN.md` §4.6) — build it, do not deploy or configure real Fidel/Supabase secrets. Do not touch the manual staff-scan/`reward_model` pre-launch gap (still awaiting a product-owner decision, recorded separately). Update `CLAUDE_HANDOFF.md` after each completed item, then replace this section with the single copy-ready prompt for Claude Code.

**Remaining sandbox evidence still needed before checkpoint 5 can connect to a live route** (not before it can be built further): a genuine signed Fidel sandbox delivery of any event type (zero exist yet per the last dashboard inspection); a real signed `transaction.refund` payload to confirm whether `originalTransactionId` points to the auth id or a distinct clearing id; confirmation from Fidel's actual subscription UI of whether one URL+secret per event type is really how routing works; and a test Fidel Location under the Loyalty Loop Program (still zero, per Codex's last inspection) so a real transaction can be generated at all. None of this blocks continuing to checkpoint 6.

**2026-09-22 Codex pre-live fix verification:** Implemented both review fixes.
Exact-zero auth/clearing events are now ledgered `ignored_zero_amount` no-ops;
zero refunds remain invalid. Over-refunds and impossible progress-increase
refunds return durable `invalid_refund` outcomes rather than rolling back the
ledger, so replay returns `duplicate`; the handler logs both RPC code and
message for actual failures. Synthetic parser/signature/handler tests passed
(9/9), TypeScript no-emit passed, and the disposable PostgreSQL integration
test passed (1/1). No live route, Fidel configuration, secret, deployment,
hosted database or local Supabase stack was used.

**2026-09-22 Codex review-alignment correction (checks pending):**
`invalid_refund` now maps to a 400 in the handler, matching Claude's requested
permanent-error 4xx contract, while the RPC still commits its idempotency
ledger first. Updated the architecture plan and added a synthetic handler test
for this response. Rerun is required.

## Checkpoint 5 pre-live fixes review (2026-09-22) — Claude, APPROVED

Verified both fixes against the actual diffs, not just the log entries:

1. **Zero-amount handling** — `transaction.ts` now allows `amountPence === 0` for auth
   (only rejects `< 0`); the RPC short-circuits exact-zero auth/clearing to an
   `ignored_zero_amount` ack, after the ledger insert (idempotent) but before any
   merchant/card/membership lookup. Correct.
2. **Over-refund handling** — `refund exceeds original amount` and `refund would
   increase progress` now `return` a normal `invalid_refund` status instead of `raise
   exception`. This is better than what I originally suggested (map to 4xx): the ledger
   entry survives, a retried delivery correctly comes back `duplicate` instead of
   re-executing, and the response is a 200 ack — sidestepping any need to know Fidel's
   exact retry-on-4xx behavior at all. `handler.ts` now logs `error.message` alongside
   `error.code`. Correct.

**One new, minor, non-blocking finding, sandbox-dependent** (not a code defect, don't
fix blind): `transaction.ts` rejects any clearing event where `cleared !== true`, but
the RPC has a branch expecting a clearing event that might carry `cleared: false`
(Fidel's refund-driven negative clearing, per Codex's doc research). If that real event
sets `cleared: false` rather than just a negative amount, it'd be rejected at parse time
before the RPC's more nuanced handling ever runs. Add to the list of things a genuine
signed sandbox delivery will resolve — same category as the other open provider-behavior
questions, not guessed here.

**Checkpoint 5 is fully approved.** Nothing further required before checkpoint 6, other
than the sandbox evidence already tracked below (which blocks connecting to a *live*
route, not continuing to build).

## Pre-launch gap — resolved (2026-09-22)

Claude decision (product owner deferred to architect judgment): **`businesses.reward_model`
defaults to `'stamp_legacy'`, not `'spend_threshold'`** — reversing the default set in
the checkpoint-1 rebuild. Flipping every business to the new model on day one would
silently break manual staff stamping for every business not yet Fidel-enrolled, since
the manual "add stamp" UI still inserts the kind of record only the *old* trigger reads.
Defaulting to legacy means zero behavior change for any existing business until it's
deliberately switched — tied to real Fidel enrollment (§6a) or, later, once manual entry
is adapted to the amount-based model. Full reasoning now in ARCH_PLAN.md §0a/§3.2.

**Exact fix needed**: `supabase/migrations/20260922194020_fidel_spend_schema.sql` —
find `add column reward_model text not null default 'spend_threshold'` and change the
default to `'stamp_legacy'` (the check constraint on the next line stays the same, both
values remain valid, just the default flips). This migration is still unapplied
anywhere, so this is a one-line in-place edit, not a new migration. Re-run the
disposable-PostgreSQL integration test after the change — it may need updating if it
assumed the old default when setting up its fixture businesses.

**2026-09-22 Codex pre-launch default fix (check pending):** Changed the
unapplied migration's `businesses.reward_model` default from
`'spend_threshold'` to `'stamp_legacy'`, exactly as approved above. The test
fixture explicitly configures its spend business threshold and needs a
disposable PostgreSQL rerun to confirm no hidden default assumption.
The first rerun correctly failed because the fixture business inherited the
new legacy default; its test data now explicitly sets `reward_model` to
`'spend_threshold'`. Rerun passed (1/1) in disposable embedded PostgreSQL.
The default is now legacy-safe while the spend tests remain explicit.

## Product owner request (2026-09-22): start connecting to the real Fidel sandbox now

The default fix is done and verified (see entry above, rerun passed 1/1). Product owner
has now explicitly asked to begin connecting the built webhook to the real Fidel
sandbox — **this authorizes real deployment actions below**, not just local
tests. Scope is deliberately capped at what doesn't require Fidel-dashboard values that
don't exist yet (those need the product owner, see step 4).

## Checkpoint 6 design review (2026-09-22) — Claude, revised §4.6 before build

Confirmed the pre-launch default fix (see entry above) — verified, no further action.

Reviewed §4.6's notification design before Codex builds it. Core design is sound —
correctly fixes `send-user-push`'s two real flaws (wrong auth model for a service-role
caller; "latest pending" instead of exact `notification_id` targeting), and delivery is
properly decoupled from the balance-changing transaction (core rule #5 — a failed or
duplicated notification send can never double-credit a reward).

**Found and fixed in the plan (§4.6), before Codex builds — three real gaps, not
hypothetical:**
1. **Unbounded retry for cases that will never succeed.** `send-user-push`'s existing
   logic leaves `push_sent_at` null when skipping a send for an opted-out recipient or
   one with no registered device. Copied as-is, the `pg_cron` sweep would re-attempt
   those same rows every minute, forever. Fixed in §4.6 point 5: both cases must mark
   `push_sent_at = now()` with `push_error` recording why, so the sweep stops
   naturally. This is a deliberate behavior change from `send-user-push`, not silently
   inherited.
2. **No retry cap for genuine transient failures either.** Added a bound requirement
   (§4.6 point 6) — Codex should pick attempt-count or age-based (24h suggested),
   whichever fits the existing `notifications` columns most simply.
3. **Secret handling for the cron→function call** wasn't specified — the `pg_cron`
   job's `pg_net.http_post` call needs the service-role key as a header, which must
   come from Supabase Vault, never embedded as plaintext in the cron job's SQL
   definition (§4.6 point 7).

None of these block starting the build — they're now part of the spec Codex builds
against, not follow-up work.

## Clearing/refund contract pass (2026-09-23) — Codex

- Step 1 baseline complete (read-only): `transaction.auth` has 1 event, ID suffix `ecb9`. `fidel_transactions`, `business_fidel_locations`, `linked_cards`, Fidel-related `transactions`, and memberships with nonzero reward progress are all 0. No data was changed.
- Step 2 path corrected by read-only Dashboard navigation: **Programs → The Loyalty Loop → Transactions** (the program sidebar), rather than a top-level page. The `...ecb9` transaction menu is open now. Its only visible option is **Clear**; no Refund option exists. Product owner must choose **Clear** once. Do not replay or create another transaction. Codex will inspect the resulting provider delivery, logs and read-only database state.
- Step 2 clearing complete: the genuine `transaction.clearing` delivery is **Succeeded**. Gateway logs show exactly one `POST ?event=clearing` -> **HTTP 200**, version 3; the function log reports `unknown_merchant`. One new clearing ledger row was inserted and reuses auth transaction suffix `ecb9`. Its payload is a bare transaction object with the same field names/types as the verified auth schema: strings for top-level IDs/currency/timestamps and nested card/location/brand fields, number `amount`, booleans `auth`/`cleared`, and the same nullable wallet/card-present/location/brand/identifier fields. `auth = true`, `cleared = true`, amount is positive, and `originalTransactionId` is absent. No spend was awarded. No raw body, header or sensitive card data was recorded.
- Step 3 needs the product owner: because the Dashboard menu had no Refund option, use Playground -> Create Transaction once, selecting the same test card and Location, with the same amount as the first auth but **negative**. Do not clear, replay, or make any additional transactions after it. Codex will inspect every delivery it produces.
- Step 3 attempt recorded: the owner created the one negative Test-mode transaction (creation API 201). Its creation response represented a refund candidate: negative amount, `auth=false`, `cleared=true`, transaction suffix `513d`, and `originalTransactionId` suffix `ecb9`. This is **not** delivery evidence. In the provider delivery list and Supabase, no `transaction.refund` or second/negative `transaction.clearing` was sent: gateway count for the two routes is 0, function reconciliation logs are absent, and the ledger still contains only auth `ecb9` and positive clearing `ecb9`. No non-2xx webhook occurred; therefore no retry, replay or code change was made.
- Step 5 final read-only counts complete: ledger counts are auth 1 (`ecb9`) and clearing 1 (`ecb9`); refund 0. `fidel_transactions`, location mappings, linked cards, Fidel-related transaction rows and nonzero membership progress are all 0. No spend was awarded. Stop: Test mode did not produce a refund webhook despite creating the negative transaction. Claude must review this provider-contract gap before any further provider action.

(Codex's copy-ready prompt for this pass was duplicated here and at the end of the file; answered by "Clearing/refund contract review (2026-09-23, 17:40 UTC)" at the end.)

## WhatsApp D1 APPROVED; stage 2 handed to Codex (2026-10-01) — Claude, product owner decided

- **D1 approved by the product owner:** the old 30-day "move to the app" phase-out is dropped. Progress and reward messages continue for as long as the customer stays opted in. Cost is controlled by the stage 2 limits in `docs/WHATSAPP_PLAN.md` (marked approved there).
- Nothing built or deployed in this item. Reading the code: spend lands in `public.transactions` (manual entry via `record_manual_spend` and the Fidel credit path), and threshold rewards in `public.rewards`. `spend_next_tier` gives the next tier. `whatsapp_outbox` and `queue_whatsapp_transaction_update` are still in `whatsapp_archive`. The original `whatsapp-dispatch` is in the private GitHub repo `theloyaltyloop1-blip/loyalty-loop-whatsapp-wip`.
- Meta prerequisites for stage 2 going live (product owner): approve the `spend_progress` and `reward_ready` Utility templates (en_GB), finish business verification, and switch to a real UK number. Stage 2 can be fully built and tested against a fake Graph API before then.
- Order: Codex first finishes the pending independent review of `9b92125`/`e066b1b`/`008381b` (part A), then builds stage 2 locally (part B). Claude reviews before any deploy.

## Copy-ready prompt for Codex

Read CLAUDE_HANDOFF.md ("WhatsApp D1 APPROVED; stage 2 handed to Codex") and docs/WHATSAPP_PLAN.md (stage 2 and D1, now approved). Do part A, then part B. Update CLAUDE_HANDOFF.md after each completed item.

**Part A: independent review of the three unrecorded WhatsApp commits.** These are 9b92125 (the bot answers reward questions, supabase/functions/_shared/whatsapp-bot.ts), e066b1b (LOGOUT unlink) and 008381b (join and nearby shops by chat, supabase/functions/_shared/whatsapp-shops.ts). All three change supabase/functions/whatsapp-webhook/index.ts. Check that:
- the bot only reads the linked caller's own data and can't be steered into another user's or shop's data;
- STOP keeps priority over every new command;
- LOGOUT fully unlinks without deleting reward history;
- JOIN respects shop approval and `whatsapp_onboarding_enabled` and can't be abused by repetition;
- nearby search leaks no private shop data.
Also check prompt-injection handling, model budgets and rate limits, and Meta's retries after a 500 (no duplicate replies or joins).

Run the three `_shared/whatsapp-*.test.mjs` suites and `deno check` on the webhook. Add independent desired-behaviour tests under tmp/ without weakening the supplied ones. With read-only MCP only, confirm the deployed `whatsapp-webhook` version and whether it matches 008381b. Record a verdict, plus findings with a severity. Fix P0/P1 issues locally only if they're small and contained, and say so.

**Part B: build WhatsApp stage 2 (progress and reward messages) locally. Do not deploy.**
1. Write one additive migration:
   - restore or recreate `public.whatsapp_outbox` with claim/lease/attempt columns, RLS on and no client access. Use the archived table in `whatsapp_archive` and the migration in the private repo theloyaltyloop1-blip/loyalty-loop-whatsapp-wip as reference; read it with `gh`;
   - retire `queue_whatsapp_transaction_update`, with no 30-day phase-out (D1);
   - add a trigger on positive spend rows in `public.transactions` (both manual entry and the Fidel credit), which queues `spend_progress`: shop name, £ towards the next tier, tier title and £ remaining, using the same rule as `spend_next_tier`;
   - add a trigger on threshold rewards inserted into `public.rewards`, which queues `reward_ready` (never the sign-up reward);
   - refunds, undo and negative rows queue nothing;
   - queue only for contacts that are linked, opted in and not logged out;
   - coalesce `spend_progress` to at most one per customer per shop per 30 minutes, latest wins; `reward_ready` always queues;
   - add an operator-set global daily cap, default 500;
   - deleting an account deletes the contact and its pending outbox rows.
2. Write `supabase/functions/whatsapp-dispatch`: `verify_jwt=false`, authenticated by a constant-time check of `WHATSAPP_DISPATCH_SECRET`. It claims rows with a lease (no double sends under concurrency), sends approved templates only (`spend_progress`, `reward_ready`, en_GB) through the Graph API, makes capped retries with backoff, ends in a terminal failed state, and logs to `whatsapp_message_log`. Never log tokens or full phone numbers. Wake-up: a pg_net call from the trigger, or a caller, as the plan says; no scheduler yet.
3. Tests, on a disposable local PostgreSQL with a fake Graph API: queueing per type, no queueing on refund/undo, the 30-minute dedupe, the daily cap, opt-out and logout, account deletion, the dispatch lease race (two concurrent dispatchers, one send), the retry cap, and the auth rejection. Re-run the existing Fidel spend/manual-spend integration suites, to prove the triggers don't break or slow the credit path (a trigger failure must never roll back a spend), and also the WhatsApp pure suites, `deno check` on both functions, and the web, retailer and shopper type checks.

Don't apply migrations, deploy functions, send WhatsApp messages, call Meta or the model provider, change secrets or write live data. Commit locally; don't push. Leave one copy-ready prompt for Claude Code asking for the stage 2 review, listing the files and exact test commands with their results.

## Current status — 2 October 2026: local WhatsApp stage 2 and shop requests phase A complete

Local commits 67e8a2a, 1c2ba08 and b35e7c8; not pushed. S1 operator email and S2 configurable threshold 5 are confirmed. No migration/function deployment, live messages, production writes, native build or shopper OTA. Claude review remains required.

WhatsApp A/B: independently reviewed 9b92125/e066b1b/008381b. Deployed webhook version 14 and three helper files matched 008381b after newline normalization. Fixed approval/onboarding checks, atomic inbound replay reservation and bounded model budget, durable logout state, stale card-link guard and outbound active-contact check. Built private template outbox, lease/attempt/daily cap 500, latest-progress coalescing/30-minute spacing, threshold reward messages excluding signup, and account cascade. Ambiguous delivery is terminal to avoid duplicates; delayed retry needs caller wake, no scheduler. Existing live contacts restoration is absent from local migration history: focused fixture is not a full-history replay. Meta prerequisites and Claude review still block release.

Shop requests: one additive migration 20261002133700_shop_requests_phase_a.sql implements tables, nullable Google ID with protected writes, setting 5, full-payload HMAC user/expiry-bound RPC, own-vote-only RLS, persistent budgets, locked recount, exactly one collecting-to-ready status wake, admin management, join notification and atomic push/email claims. Search uses JWT, Text Search (New) field mask including addressComponents (regionCode alone is a bias), UK validation, listed ID/normalized-name+75m filtering, ten-minute signed tokens, 30 searches/day. Notify uses secret auth, anonymized operator pitch, existing push path, durable pre-send claims. delete-my-account recounts after auth deletion. Admin route/count/status/link/threshold and shopper Sheet/SuccessCheck, Requested count, Profile/withdraw, Home/Map entries implemented without native dependencies.

Changed paths: supabase/migrations/20261002133050_whatsapp_spend_dispatch.sql and 20261002133700_shop_requests_phase_a.sql; supabase/functions/whatsapp-{webhook,dispatch}, shop-request-{search,notify}, _shared/{whatsapp-dispatch,shop-requests,shop-request-notify}.ts, send-user-push, delete-my-account, config.toml; apps/shopper/App.tsx and src/components/ShopRequests.tsx; apps/web/src/App.tsx, pages/{AccessPanel,ShopRequests}.tsx; apps/api/test/integration/{shop-requests,whatsapp-stage2}.test.mjs and fidel-fixture.mjs; tmp/whatsapp-independent.test.mjs; scripts/verify-shop-requests.ps1. Timeline and docs/SHOP_REQUESTS_PLAN.md reflect local completion.

Verification: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-shop-requests.ps1 passed 26 database/fake-provider tests (all ten shop-request scenarios, eleven WhatsApp scenarios, parents and three existing Fidel regressions), 23 pure/independent tests, six Deno entrypoints and shopper/web/retailer/admin types, plus git diff --check. The script contains exact underlying commands. Deno uses --no-config --node-modules-dir=none. Initial Windows EBUSY fixture cleanup fixed with retry of verified disposable directory; final rerun stalled on an orphan PostgreSQL io_worker with exited parent, stopped that exact local worker and run completed with all assertions passing. Initial default Deno/config dependency checks failed; specified cached-runtime command passed. Tests use minimal fixture/direct REST-equivalent roles, not full Supabase REST or migration-history replay.

Browser fake harness tmp/shop-request-ui imports real components with fake stores and native Sheet/SuccessCheck stubs. Request/count/Profile/withdraw and admin contacted/join actions and screenshots reviewed. Later preview cleanup exposed repeated-render errors from unstable fake auth; fixed primitive user/admin dependencies (b35e7c8), stabilized harness, reran web types/diff and fresh browser/error checks. Preview server/browser stopped. Native gestures/device delivery remain unverified.

Release blockers: read-only secret-name check found GOOGLE_PLACES_API_KEY, SHOP_REQUEST_SIGNING_SECRET, SHOP_REQUEST_NOTIFY_SECRET absent; RESEND_API_KEY and WHATSAPP_DISPATCH_SECRET present (no values printed). Key supplied in chat was not used/stored/repeated; owner must revoke and replace it securely in Supabase. Matching signing/notify secrets required in Edge and Vault. Google Places policy conflicts with persistent POI-detail storage requested by plan; documented in docs/SHOP_REQUESTS_PLAN.md and blocks live release pending compliant design or confirmed contractual permission. Resend idempotency lasts 24 hours: durable pre-send claim prevents later duplicate retries but ambiguous failures require manual investigation. Expo ambiguity likewise can lose delivery, manual recovery required. No live provider traffic.

### Handoff editing incident — 2 October 2026
A later read-only website review attempted to insert before a missing prompt heading. PowerShell continued after a failed substring and overwrote the handoff. Restored tracked HEAD history and reconstructed the implementation/verification status from session evidence. Any pre-existing uncommitted wording not represented by tracked history or reconstructed notes may be lost; do not claim exact restoration of those edits. Other files were not changed in this incident. Future handoff replacements must stop on error and validate headings before writing.
### Website search read-only review — 2 October 2026
- Home.tsx dashboard search input has no value/onChange and does not filter results; category buttons alone filter. Discover.tsx map search does filter loaded businesses by name/category/address. Confirmed from source only; deployed website not checked. No code change, test or deployment.
### Dashboard search implemented — 2 October 2026
- apps/web/src/pages/Home.tsx now controls the search input and filters Trending/Nearby by case-insensitive trimmed shop name, category, address and postcode, combined with the category selection. Clearing restores matching category results. Added accessible search label and no-match message. Local only; verification pending.

### Dashboard search verification completed
- node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.app.json: PASS. git diff --check: PASS. No new tests added for this small reversible input/filter change; browser/live verification not run. No deployment. Prior WhatsApp/shop-request release gates remain unchanged.
### Dashboard deployment preparation — 2 October 2026
- Vercel reports latest production READY deployment dpl_EkxSMEzv4AzqBxs5epZK8DKRzPVS based on 008381b. Will isolate search fix from held shop requests. Connector get_project hit inconsistent input schema; CLI has no saved credentials and is awaiting device authentication. Reopened Vercel device sign-in in Codex at user request. No deployment started.

### Isolated website release prepared
- .codex-dashboard-search-release contains tracked production baseline 008381b plus only the Home.tsx search fix. No held shop-request/frontend changes are included. Build/deploy pending CLI authentication.

### Dashboard search release — built, NOT yet in production (2 October 2026) — Claude
- Used the already-authorised Vercel connector instead of CLI device sign-in, so the owner no longer needs to finish the device sign-in.
- Created commit `230a73a` ("Website: make the dashboard search box filter shops") on a new branch `release/dashboard-search`. Its parent is production's `008381b`, and it changes only apps/web/src/pages/Home.tsx (+14/−3). The blob is byte-identical to the main working tree's Home.tsx and to .codex-dashboard-search-release. It was built with git plumbing; the main working tree and local `main` were not touched.
- Pushed **only** that branch. Remote `main` is still `008381b`. The held commits d5386e5/67e8a2a/1c2ba08/b35e7c8 are not pushed.
- Vercel automatically built a preview, `dpl_DhVzqE5NZo3VpBoHyfys79zUVgyt`, at loyalty-loop-i4alv5dvu-loyalty-loop.vercel.app (alias loyalty-loop-git-release-dashboard-search-loyalty-loop.vercel.app). Result: **READY**, clean build (vite built in 2.24 s; the only warning is the pre-existing 500 kB react-vendor chunk warning). The preview is behind Vercel SSO, and the page needs a signed-in shopper, so no browser check was made.
- **Production deploy not done.** Claude Code's permission check blocked the production deployment call. The live site is still `dpl_EkxSMEzv4AzqBxs5epZK8DKRzPVS` (008381b) on www.the-loyalty-loop.com. Going live needs the owner's decision (see next actions).
- Unchanged: the WhatsApp stage 2 / shop-request review gates and the shopper OTA hold.
- Note for whoever next pushes `main`: the main working tree already contains the identical Home.tsx change (uncommitted). Commit it with the next `main` push, or a later production build from `main` would drop the search fix.
- Next actions:
  - (owner) Decide how it goes live: either promote preview `dpl_DhVzqE5NZo3VpBoHyfys79zUVgyt` to Production in the Vercel dashboard, or approve Claude to deploy it.
  - (Claude or Codex, after it is live) Read-only check that the production deployment is READY on commit 230a73a with the custom domains aliased.
  - (owner) Sign in on www.the-loyalty-loop.com, type a shop name into the home search box, and check the list filters, then clears again when the box is emptied.

### Owner asked to push everything to `main` (2 October 2026) — Claude
- The owner said "push that all to main". This fast-forwards `origin/main` from `008381b` through d5386e5, 67e8a2a, 1c2ba08 and b35e7c8, plus the Home.tsx search commit and this docs commit. Vercel builds production from `main`, so this replaces the release-branch route above.
- What goes live on the **website**:
  - the dashboard search fix;
  - the `/join` route (owner sign-up);
  - the admin "Shop requests" link and page. Until the shop-request migration is applied, the page shows a load error to admins only.
- What does **not** go live:
  - No Supabase migrations or Edge Functions: there are no GitHub workflows, and Supabase branching is off (no branches), so nothing auto-deploys.
  - No shopper OTA: `eas update` is manual.
  - The B1–B3 review gates for applying migrations and deploying functions remain in force.
- Checked before the push: web type check PASS, and the local `npm run build:web` succeeded (only the pre-existing chunk-size warning). Supabase `list_branches` returned none, and HEAD has no `.github` workflows.
- Not committed (pre-existing working-tree state, left for the owner to decide): the deleted docs/HANDOFF-*.md, docs/LOYALTY-LOOP-*.md and docs/NEW-SESSION-PROMPT.md; untracked tmp/, output/, timeline-site*, remote_schema_dump.sql and the .codex-* release folders.
- `release/dashboard-search` (230a73a) is now redundant. Its preview deployment was never promoted.

## Review: WhatsApp stage 2 + shop requests phase A (2026-10-02) — Claude (restored)

(This review was first recorded earlier on 2 October. It was lost in the handoff-editing incident above and is restored here verbatim from Claude's saved copy.)

**Verdict: APPROVED for local work; NOT approved for live release until P1 fixes B1–B3 are done.** Nothing was deployed or applied, and no live data was written. The only live access was one read-only query, which confirmed `pg_cron` is **not installed** (only `pg_net`).

**Checks actually run:** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-shop-requests.ps1` exited 0, with 26/26 disposable PostgreSQL/fake-provider tests, 23/23 pure/independent tests, six Deno entrypoints, the shopper/retailer/web/admin type checks, and the diff check. No orphan PostgreSQL process remained afterwards. I read every listed file and diff, and re-read Google's Places policy page: place IDs may be stored indefinitely, and other Places content must not be cached or stored outside the stated exceptions. This is prototype evidence only: there was no native device run and no real Places/Resend/Meta traffic.

**Verified correct (by reading the code, backed by the tests):**
- Shop requests:
  - Own-vote-only RLS, and no client access to `requested_shops`.
  - An HMAC token bound to the user, the `place_id`, GB, and an expiry of at most 15 minutes.
  - Persistent daily counters that survive withdrawal, and a threshold setting with default 5.
  - Exactly one wake: the trigger fires only on `collecting→ready`, under a row lock.
  - Silent suppression: the shopper sees "Request recorded", and the claim refuses rows that aren't ready.
  - Recount on withdrawal and account deletion. `ready` is sticky.
  - The operator pitch contains the count only, with no requester identity.
  - Each requester gets one claimed push, of their own notification only.
- WhatsApp:
  - The inbound reservation is atomic per provider message ID, so Meta retries can't repeat a command.
  - The contact is rechecked before every send and every dispatch.
  - The card-link trigger blocks links minted after LOGOUT or STOP.
  - Coalescing is serialised by the contact-row lock, and two dispatchers produce one send.
  - An expired lease ends as terminal `delivery_unknown` and is never resent.
  - A queue failure never rolls back a spend.

**Required before live (P1):**
- **B1. Places storage policy (resolves Codex's documented conflict).** Durable Places data is `place_id` only.
  - Amend the *unapplied* migration in place: drop `name, address, postcode, lat, lng, website, phone, primary_type` from `requested_shops` and stop writing them.
  - Fetch details only when needed, and don't store them:
    - (a) `shop-request-notify` calls Place Details once to build the operator email. It may include website and phone.
    - (b) A `details` mode on `shop-request-search` returns names and addresses for the caller's own requested IDs (max 20), or for admins any IDs (max 50 per page). It counts against the search budget.
    - (c) `my_shop_requests` and `admin_shop_requests` return ID, count and status only. The UI falls back to "A shop you asked for" if details fail.
    - (d) The join push title uses `businesses.name`, not Places data.
  - The token's lat/lng and name stay transient. They're used only for the listed-shop check.
  - Drop `websiteUri` and `nationalPhoneNumber` from the search field mask. That's data minimisation, and a cheaper SKU.
  - Update tests 5, 7 and 10, and §3 of docs/SHOP_REQUESTS_PLAN.md.
- **B2. A STOP can be lost.** With the new replay guard, a STOP whose opt-out update fails is still acknowledged with 200, so Meta never retries it. The current update also ignores its `{error}` and replies "unsubscribed" anyway.
  - Fix: in `reserve_whatsapp_inbound`, when `p_kind='stop'`, set `opted_out_at=now()` in the same transaction as the reservation, and suppress that phone's pending outbox rows.
  - Keep the webhook's STOP reply, and check errors on its remaining writes.
  - Test: the opt-out persists even when the later handler throws.
- **B3. There is no scheduler.** Nothing wakes `whatsapp-dispatch` for rows deferred by the 30-minute spacing or by retry backoff. They wait for the next unrelated spend, which at pilot scale could be hours away, or never come.
  - The same gap affects lost shop-request wakes and the existing `fidel-card-delete-sweep`. Its code says it's "called by a scheduled job", but none exists.
  - It's also why the admin "Scheduled jobs" health card is red: it's hardcoded `ok:false` at supabase/functions/platform-health/index.ts:42.
  - Fix: enable `pg_cron`. Add one-minute jobs for `whatsapp-dispatch` and for a shop-request sweep. The sweep picks up ready rows with `email_attempted_at is null`, and join notifications with `joined_push_claimed_at is null`. Add an hourly job for `fidel-card-delete-sweep`. Take secrets from Vault.
  - Make the health check read `cron.job` and recent `cron.job_run_details`.

**Should fix (P2):**
- **S1.** Per-user caps don't bound total Places cost, because accounts are free to create. Add a global daily search cap setting (default 1,000). The product owner should also set a quota on the key in Google Cloud.
- **S2.** In `joined` mode, one failed push throws and abandons the remaining requesters. Continue past failures and report them. The B3 sweep catches anything left unclaimed.
- **S3.** The admin page can't show a `ready` shop whose wake was lost. When `email_attempted_at` is null, show "Operator email not sent" with a resend action.

**Minor (P3, may batch):**
- The shopper list shows raw status words (`collecting`, `declined`). Use friendly labels, and offer **View shop** once joined.
- The "Shops you've asked for" block sits above the profile hero in Settings. Move it below.
- Shoppers see raw RPC errors such as "invalid place token".
- Recount from an AFTER DELETE statement trigger on `shop_requests` instead of from `delete-my-account`. That also covers dashboard deletes, and avoids an error message after a deletion that succeeded.
- `businesses.google_place_id` has no unique index.
- `finish_whatsapp_outbox` records a dispatcher `suppressed` outcome as `failed`.

**Gates still open:**
- Product owner: revoke the Places key that was pasted in chat; create a replacement Places API (New) server key with a quota (S1) and set it as the `GOOGLE_PLACES_API_KEY` secret.
- Codex: set `SHOP_REQUEST_SIGNING_SECRET` and `SHOP_REQUEST_NOTIFY_SECRET` in both Edge secrets and Vault, with matching values.
- Product owner, for WhatsApp with Meta: both templates approved, business verification done, and a real UK number.

**Next actions:**
- Codex fixes B1–B3 and S1–S3 locally (plus P3 if quick) and re-runs the script with the new tests (owner: Codex).
- Claude re-reviews the diff before any migration, deploy or shopper OTA (owner: Claude).
- The product owner completes the key gates above (owner: product owner).

Still pending, not dropped: Claude's check of the marketing contact artwork (output/marketing/*-contacts.png and business-card-front.png against output/marketing/README.md). Exact contacts: 07710244140, developer@the-loyalty-loop.com, www.the-loyalty-loop.com.

## Copy-ready prompt for Codex (next task)

Read CLAUDE_HANDOFF.md ("Review: WhatsApp stage 2 + shop requests phase A … (restored)") and fix B1–B3 and S1–S3 locally, plus the P3 items if quick. Nothing is applied or deployed yet, so amend 20261002133700_shop_requests_phase_a.sql and 20261002133050_whatsapp_spend_dispatch.sql in place. Add a new migration only for pg_cron.

- **B1:** durable Places data is `place_id` only. Details are fetched only when needed:
  - Place Details for the operator email.
  - A `details` mode on shop-request-search: the caller's own IDs (max 20), or admin pages (max 50, admin-checked), counted in the budget.
  - `my_shop_requests` and `admin_shop_requests` return ID, count and status only.
  - The join push uses `businesses.name`.
  - Drop website and phone from the search field mask.
  - Update docs/SHOP_REQUESTS_PLAN.md §3.
- **B2:** the STOP opt-out happens atomically inside `reserve_whatsapp_inbound` and suppresses pending outbox rows. Check errors on the webhook's STOP writes. Add a test where the handler throws after reservation and the opt-out persists.
- **B3:** a pg_cron migration:
  - Every minute: whatsapp-dispatch, and a shop-request sweep (ready shops never attempted; join notifications never claimed).
  - Hourly: fidel-card-delete-sweep.
  - Secrets come from Vault, never inline.
  - platform-health's "Scheduled jobs" check reads `cron.job` and recent `cron.job_run_details` instead of the hardcoded `ok:false`.
  - Tests: a deferred progress row and a retry row are sent by a sweep wake with no new spend; a lost ready wake is emailed exactly once by the sweep.
- **S1:** a global daily Places search cap setting (default 1,000), enforced in `consume_shop_search`.
- **S2:** joined-mode pushes continue past a failure.
- **S3:** the admin page shows "Operator email not sent" with a resend action.

Add the new tests to scripts/verify-shop-requests.ps1, re-run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-shop-requests.ps1`, and record the counts.

Deploy gates:
- After Claude's re-review passes, you may apply the migrations and deploy whatsapp-dispatch, shop-request-notify and the sweep.
- shop-request-search and the shopper OTA also wait for the product owner's replacement Places key, with a quota.

Also: when you next commit and push `main`, include the already-present Home.tsx search change. It's identical to release commit 230a73a, and leaving it out would remove the live search fix.

When editing this file, stop on any error and check the headings before writing; don't overwrite it wholesale. Never log tokens, keys, phone numbers or requester identities. Update CLAUDE_HANDOFF.md after each item, and finish with one copy-ready prompt for Claude Code asking for the re-review, listing the files and exact commands with their results.
