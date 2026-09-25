# CLAUDE_HANDOFF.md — Fidel Card-Linked Reward Engine

Living status log between Claude (architect/reviewer) and Codex (builder), for the
Fidel card-linked cumulative-spend engine. Spec: [ARCH_PLAN.md](ARCH_PLAN.md).
Both agents edit this file after every completed step; Codex reads "Next
action" before starting and records test evidence here.

Do not treat anything in "Done" as a request to redo it. Do not build ahead of "Next
action" without checking in — some steps are review checkpoints (ARCH_PLAN.md §7) that
need Claude's sign-off before the next one starts.

---

## Status (2026-09-25): Independent implementation review complete — changes requested

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

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Build checkpoint 6 per `ARCH_PLAN.md` §4.6 (fully revised 2026-09-22 — read the whole section, including points 5–7 added in this review, before starting): the `send-stamp-notification` Edge Function (service-role-only, takes an exact `notification_id`, applies the existing preference gate, sends via Expo, and — this is new — marks `push_sent_at`/`push_error` even on a skip so the recovery sweep doesn't loop forever) plus the `pg_cron` recovery sweep (with a retry cap, and its service-role bearer token sourced from Supabase Vault, not embedded in the cron job SQL). Write tests mirroring the rigor of earlier checkpoints — synthetic/local only. Do not deploy, configure real Fidel/Supabase secrets, or touch a live route; that deployment task (migrations + Edge Function deploy + test fixtures) is still separately queued and paused pending your report — mention in your update whether that happened before this, and if not, do checkpoint 6 first. Update `CLAUDE_HANDOFF.md` after each completed item, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex sandbox deployment attempt — blocked safely

1. Read the current handoff, architecture plan, and timeline. Confirmed linked Supabase
project ref: `tgukdabfvvoywawmzbdo`.
2. Ran the approved `supabase db push`. Supabase made no schema changes: it refused with
`LegacyDbPushMissingLocalError` because the remote migration history contains versions
absent from this checkout. Per the deployment instruction, no migration repair, pull, or
other undocumented fix was attempted.
3. Did not deploy `fidel-webhook`, create Fidel fixtures, configure webhook URLs, or set
any secrets. Those steps remain paused until the migration-history mismatch is resolved
through the project’s canonical migration source.

Verification: Supabase CLI connected to the remote database and returned the blocker
before applying migrations. No production deployment was attempted.

## Migration-history reconciliation review (2026-09-22) — Claude, safe path identified, do not skip step 0

Codex did the right thing: stopped at the first sign of a mismatch against a live
database and reported rather than guessing. Reviewed the situation and the safe
reconciliation path, in order:

**Step 0 — verify this is even the right project, before touching migration history at
all.** `LegacyDbPushMissingLocalError` most plausibly means real prior schema history
exists on the remote that this specific checkout's `supabase/migrations/` folder
doesn't have (plausible for a live, actively-developed product where deploys may have
happened from a different checkout/branch) — but the *cheaper*, easy-to-overlook
alternative explanation is that `tgukdabfvvoywawmzbdo` isn't actually the intended
Loyalty Loop project at all, and the CLI is correctly refusing to push a stranger's
migration history. **Before any reconciliation action, confirm `tgukdabfvvoywawmzbdo`
matches the project the product owner sees in their own Supabase dashboard** — ask the
product owner to confirm the project ref/name if there's any doubt, don't infer it from
being merely linked. If it's the wrong project: unlink and relink to the correct one,
and this entire blocker resolves itself without touching migration history at all.

**Step 1 — once confirmed correct, diagnose read-only before changing anything.** Run
whatever this installed Supabase CLI version's read-only comparison command is
(commonly `supabase migration list`, which shows local vs. remote migration versions
side by side — verify the exact flag/output shape against `supabase migration list
--help` for the installed version rather than assuming) to see precisely which versions
the remote has that this checkout lacks. This is the evidence needed to decide what
step 2 actually resolves, and it's non-destructive.

**Step 2 — the canonical fix for "remote has migrations local doesn't," per Supabase's
own tooling design, is `supabase db pull`,** not `supabase migration repair`. `db pull`
reconciles the *local* migration folder with what the remote already has — it does not
alter the remote schema or its migration history, only writes local files. This is the
right direction because the far more likely explanation (a live product's schema
genuinely has prior history this checkout is missing) means those remote migrations are
real, not obsolete — exactly the case the product owner's instruction says not to mark
as reverted. **Do not run `supabase migration repair --status reverted`** (or `applied`)
on any of those versions unless step 1's diagnosis produces concrete evidence they were
duplicated, abandoned, or genuinely never meant to exist — a live schema mismatch from a
divergent checkout is not that evidence on its own.

**Step 3 — after `db pull`, verify before pushing again:**
- Re-run the step-1 comparison command and confirm local now matches remote with no
  remaining remote-only versions.
- **Confirm all four Fidel migrations are still present, unmodified, and still sort
  after everything else** — `20260922171734_fidel_stamp_foundation.sql`,
  `20260922194020_fidel_spend_schema.sql`, `20260922194307_fidel_spend_processing.sql`,
  `20260922215848_fidel_webhook_processing.sql`. If `db pull` generates a new local file
  for the reconciled remote history, check its timestamp sorts *before* these four —
  if the CLI assigns it a timestamp that would sort after (e.g. because it stamps with
  the current time rather than the migration's true original date), that needs
  correcting before push, since these four migrations depend on running in exact
  relative order (particularly the `transaction_type` enum addition in the first file,
  which must commit in its own transaction before anything references `'spend'`).
- Only once both checks pass, retry `supabase db push` for the four Fidel migrations.

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Resolve the `LegacyDbPushMissingLocalError` blocker per "Migration-history reconciliation review" in `CLAUDE_HANDOFF.md` — follow steps 0 through 3 in that exact order, do not skip step 0. Report back at each step; stop and ask if step 0 can't be confirmed (you may need the product owner to confirm the project ref matches their dashboard) or if step 1's diagnosis shows anything unexpected (e.g. the remote-only versions don't look like plausible prior Loyalty Loop schema history — report exactly what they look like rather than proceeding). Do not run `supabase migration repair` in any form without first reporting the step-1 diagnosis here for review. Once step 3 passes and `db push` succeeds, resume the original deployment task (deploy `fidel-webhook`, create test fixtures, report the live URL) from where it was paused. Update `CLAUDE_HANDOFF.md` after each step, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex migration reconciliation — stopped at Step 1

Step 0 passed: `supabase/.temp/linked-project.json` identifies linked ref
`tgukdabfvvoywawmzbdo` as `The Loyalty Loop`.

Step 1 read-only comparison (`supabase migration list --linked`) found divergent
history, not merely remote-only history. Remote-only versions include the previously
reported August/September sequence (for example `20260806112723` through
`20260921230717`); local-only versions include the placeholder-style sequence
`0001`–`0030` plus dated migrations such as `20260814001109`, `20260817000100`,
`20260818155942`, `20260826000000`, `20260910120000`, `20260919214500`, and the four
pending Fidel migrations. This is unexpected under the assumed simple `db pull` path.

Stopped before Step 2: no `db pull`, migration repair, push, function deployment,
fixture insertion, or secret configuration was performed.

## Divergent-history review (2026-09-22) — Claude, diagnostic step required before any reconciliation command

This is not "remote has extra migrations we're missing" — it's two histories with no
overlapping version IDs at all. Local's `0001`–`0030` placeholder sequence plus later
dated migrations almost certainly represents a separate rebuild-from-docs effort on this
project (a documented prior activity), restating the schema fresh under new file names,
while remote's `20260806112723`–`20260921230717` sequence is the real, organically-grown
history of the actually-live database — never touched by that local rebuild. This is
plausible, not confirmed — the confirmation this needs doesn't exist yet.

**Why no reconciliation command is being issued yet**: whether it's safe to fix the
*bookkeeping* (tell Supabase "these local-only migrations are already accounted for,
don't run them") depends entirely on whether local's migrations actually produce the
same end schema as what's really live on remote. That's unverified. Guessing wrong here
either masks a real schema difference or corrupts migration tracking against a database
serving real customers — not a place to guess.

**The exact next command — a diagnostic, not a reconciliation:**
```
supabase db diff --linked -f pre_fidel_reconciliation_check
```
(Verify this exact flag shape against `supabase db diff --help` for the installed CLI
version — do not assume without checking.) This computes what would need to change to
make local's migration-derived schema match what's *actually* live on remote, and
writes it to a file — it does not touch the remote database or the migration tracking
table. This is the evidence step.

**Report back the result, then branch, do not proceed automatically:**
- **If the diff is empty or trivial** (comments/whitespace only, no real DDL): local's
  migrations and remote's actual schema are equivalent — the divergence really is just
  bookkeeping. In that case, and only then, `supabase migration repair --status applied
  <version>` for each local-only version (marking them accounted-for on remote without
  running anything) is the canonical, safe fix — **note this is a different, much safer
  operation than marking remote-only versions `--status reverted`, which stays
  off-limits regardless**, since those almost certainly represent real, currently-live
  schema. Do not run any `repair` command without reporting the diff result here first.
- **If the diff shows real differences**: stop, do not attempt any repair, pull, or
  push. Report exactly what the diff contains — this means genuine schema drift between
  what this checkout expects and what's actually live, which needs a decision from
  Claude/the product owner, not an automated fix.

Either way, the four Fidel migrations stay untouched and unapplied throughout this
diagnostic — nothing about this step affects them.

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Follow "Divergent-history review" in `CLAUDE_HANDOFF.md` exactly: run the one diagnostic command specified (`supabase db diff --linked -f pre_fidel_reconciliation_check`, verified against `--help` for the installed CLI version first), then report the result and stop — branch per that section's guidance, but do not run `migration repair`, `db pull`, or `db push` in the same pass. This is intentionally a report-and-wait step, not a fix. Update `CLAUDE_HANDOFF.md` with the diagnostic result, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex divergent-history diagnostic — environment blocked

Verified `supabase db diff --help`: `--linked -f` is the reviewed diagnostic and would
write only a local diff migration. Ran exactly `supabase db diff --linked -f
pre_fidel_reconciliation_check`. It stopped before producing a diff because neither
Docker nor Podman is installed/on PATH; Supabase requires one to build its shadow
database. No remote database, migration-history, Fidel, secret, or deployment change
occurred, and no diagnostic file was created.

## No-Docker diagnostic path (2026-09-22) — Claude, same evidence goal, different tools

Docker/Podman is a real environment constraint, likely not something Codex's sandbox
can install (no assumed system-package or container-runtime access) — **don't spend
time trying to arrange it before checking that it's actually possible**, and don't block
on it if it isn't. There's a read-only path to the same evidence that doesn't need a
Supabase-managed shadow database at all, reusing a tool already proven to work in this
exact sandbox this session.

**The goal, restated**: confirm whether local's full migration history (`0001`–`0030` +
dated migrations + the four Fidel migrations) produces a schema equivalent to what's
*actually* live on `tgukdabfvvoywawmzbdo` right now. `db diff --linked` was one way to
get that; here's another that avoids Docker entirely:

1. **Dump the real remote schema directly** — `supabase db dump --linked -f
   remote_schema_dump.sql` (verify the exact flag against `supabase db dump --help`
   first, same discipline as before). `db dump` runs `pg_dump` against a live Postgres
   connection string — remote or local — and does **not** need the Docker-based local
   dev stack the way `db diff`/`db start` do. This alone is a safe, read-only way to see
   exactly what's really on remote, independent of any migration-history bookkeeping.
2. **Materialize local's full migration history into a disposable Postgres instance** —
   reuse the exact embedded/disposable PostgreSQL mechanism already used successfully
   this session for the Fidel migration tests (`apps/api/test/integration/fidel-supabase-spend.test.mjs`
   and earlier), which has already been confirmed to work in this sandbox without
   Docker. Apply every local migration file in order — the full `0001`–`0030` sequence,
   the later dated ones, and the four Fidel migrations — into a fresh instance of it.
3. **Dump that disposable instance's resulting schema** the same way (`pg_dump` against
   its local connection string).
4. **Diff the two dumps** (`diff` or an equivalent structural comparison — table names,
   columns, types, constraints, RLS policies, functions) and report the result plainly.
   This is a coarser comparison than Supabase's own `db diff` algorithm (it's a raw
   schema-to-schema diff, not a purpose-built migration-aware one), but it answers the
   same question — say so explicitly when reporting, don't oversell its precision.

**Still applies, unchanged**: no `migration repair`, `db pull`, `db push`, deployment,
secret configuration, or fixture insertion until this diff evidence exists and has been
reported back. If arranging Docker/Podman later turns out to actually be possible and
easy, the original `db diff --linked` path remains equally valid — this isn't a
replacement for that method, just an alternative that doesn't require an environment
capability that isn't confirmed to exist here.

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Follow "No-Docker diagnostic path" in `CLAUDE_HANDOFF.md`: check briefly whether Docker/Podman can actually be installed in this environment (don't spend real effort on it — if it's not trivially available, move straight to the 4-step alternative). Then run the 4-step alternative exactly: dump the real remote schema via `supabase db dump --linked`, replay the full local migration history (all of it, not just the Fidel ones) into a fresh disposable Postgres instance using the same mechanism already proven this session, dump its schema, and diff the two. Report the result and stop — do not run `migration repair`, `db pull`, `db push`, or any deployment step in the same pass, regardless of what the diff shows. Update `CLAUDE_HANDOFF.md` with the diagnostic result, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex no-Docker diagnostic — blocked

Checked availability: Docker, Podman, and local `pg_dump` are unavailable. Verified
`supabase db dump --help`, then ran the approved `supabase db dump --linked -f
remote_schema_dump.sql`. Contrary to the review assumption, this CLI invocation also
attempted Docker/Podman and failed before dumping. No dump file, schema comparison,
remote change, migration repair/pull/push, deployment, fixture, or secret change
occurred. The disposable test mechanism has not been established as a complete schema
replay/dump tool, so it was not assumed for this diagnostic.

## Schema-diff evidence obtained — Claude, via a third path (2026-09-22)

Neither Docker/Podman nor local `pg_dump` were needed in the end — this session has
direct, read-only access to Supabase's own management API (a separate tool from the
CLI, no shadow database involved), used here purely for diagnosis, consistent with the
reviewer role. Confirmed project identity independently (`tgukdabfvvoywawmzbdo` =
"The Loyalty Loop") and pulled the real evidence:

**`list_migrations` on the live project returned 49 versions**, timestamped
`20260806112723` through `20260921230717`, with names — `foundations_auth`,
`core_loop`, `brands_and_franchises`, `push_notifications`,
`harden_upload_file_constraints`, `account_deletion_and_owner_handoffs`,
`usage_analytics`, `add_list_storage_objects_by_owner`, etc. — that match local's
migration files almost exactly, just under different timestamps (e.g. local
`20260817183730_shop_social_links.sql` vs. remote's actual `20260817183924
_shop_social_links`), and with local's earliest ones renamed down to placeholder-style
`0001`–`0030`. **This is not divergent history — it's the same history, with local
filenames renamed/renumbered at some point, breaking the version-ID match without
changing content.**

**Confirmed at the content level, not just by name**, via direct read-only SQL against
the live database:
- Full `public` table list (39 tables) matches what local's full pre-Fidel migration
  history would produce — `businesses`, `memberships`, `transactions`, `rewards`,
  `reward_catalog`, `staff_members`, `brands`, etc. — with **no Fidel tables present**,
  correctly confirming the four Fidel migrations are genuinely unapplied, nothing else
  is quietly missing.
- `memberships`' exact columns match `0004_core_loop.sql`'s definition precisely
  (`stamp_count`, `points_balance`, `current_tier`, etc.) — no stray columns, no
  missing ones, no Fidel-era columns present.
- The WhatsApp-area migrations initially looked like they might be real divergence
  (remote's `whatsapp_customer_onboarding` naming didn't obviously match local's
  `whatsapp_start_onboarding`/`fix_whatsapp_handoff_token_hash`/
  `add_optional_whatsapp_shop_qr` naming) — checked directly rather than assumed:
  `whatsapp_handoff_links` has `token_hash` (not a plaintext token) and a coherent
  shape consistent with local's fix history. Not drift, just further renaming.

**This satisfies the evidence bar set before any reconciliation was authorized**: local
and remote are schema-equivalent for everything pre-Fidel. The fix is bookkeeping-only.

## Exact next Codex task

1. **Get the authoritative remote version+name list** (reproduce or request the 49
   entries above — do not retype from this summary, re-fetch to avoid transcription
   error, e.g. via `supabase migration list --linked` — verify this doesn't itself need
   Docker before assuming; if it does, ask for the list via the same read-only Supabase
   API path used above instead).
2. **Map each remote version to its corresponding local file by content, not just
   name** — read every local migration file fresh (don't rely on memory or this
   summary) and match it to the remote version whose slug it corresponds to. Where a
   match is unambiguous (same semantic change, matching position in sequence), that
   local file's identity should be reconciled to the remote's real version+timestamp.
   **Where any mapping is NOT unambiguous, stop and report it here rather than
   guessing** — this repo's `whatsapp_*` area is the most likely place for a genuine
   1:many or many:1 mapping (e.g. remote's `whatsapp_customer_onboarding` vs. local's
   three separately-named WhatsApp migrations), and needs a careful read of actual file
   contents, not name-similarity alone.
3. **Reconcile via `supabase migration repair --status applied <version>`** for each
   confirmed mapping — this only edits the remote tracking table's bookkeeping, runs no
   DDL, and is safe *because* content-equivalence is now established, not assumed.
   Verify this command doesn't need Docker before running (it shouldn't — no shadow DB
   involved — but confirm via `--help` or a dry attempt per the discipline used
   throughout this reconciliation).
4. **Do not touch any of the four Fidel migrations in this step** — they stay exactly
   as they are; this reconciliation is entirely about the pre-Fidel history.
5. **After reconciliation, re-run `supabase migration list --linked`** and confirm no
   remaining local/remote divergence outside the four (still-unapplied) Fidel
   migrations.
6. **Only then**, resume the original deployment task from where it was paused:
   `supabase db push` (should now apply cleanly — just the four new Fidel migrations),
   deploy `fidel-webhook`, create test fixtures, report the live URL.

Report back at each numbered step. Stop and ask rather than guess at step 2 if any
mapping is unclear.

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Claude obtained the schema-diff evidence via a different, read-only path (Supabase's management API, not the CLI/Docker) — see "Schema-diff evidence obtained" in `CLAUDE_HANDOFF.md`: local and remote are schema-equivalent for everything pre-Fidel, the divergence is bookkeeping-only (renamed local migration files, not real drift). Follow "Exact next Codex task" (6 steps) exactly, in order. Step 2 requires reading every local migration file fresh and matching by actual content, not by name-similarity or by trusting this summary — stop and report rather than guess on any ambiguous mapping (the WhatsApp-area migrations are flagged as the most likely place for this). Report back after each step. Update `CLAUDE_HANDOFF.md` after each completed item, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex reconciliation — stopped at mapping evidence

Step 1 completed: `supabase migration list --linked` re-confirmed the 49 remote
version IDs. The installed CLI output contains no migration names or SQL content.
Read the full local migration filename inventory fresh. Step 2 cannot be completed
without the authoritative remote version-to-name/content list from the management-API
review: mapping by filenames alone violates the reviewed instruction, especially in the
WhatsApp area. No migration repair, pull, push, deployment, fixture, or secret change
was made.

## Authoritative remote version-to-name mapping (2026-09-22)

Correct diagnosis from Codex — the CLI's `migration list` only ever shows the remote
tracking table's version IDs, no names, because that's all it stores. Names/content
came from a different tool (Supabase's management API), not something re-runnable from
Codex's CLI-only environment. Full list, exactly as returned, so nothing needs
re-fetching or guessing:

```
20260806112723  foundations_auth
20260806112814  foundations_auth_hardening
20260806120707  update_admin_bootstrap_email
20260806144703  core_loop
20260806144750  core_loop_hardening
20260806144908  seed_demo_businesses
20260807000229  storage_buckets_logos_covers
20260807000239  winback_email_log
20260807001421  fix_storage_policy_name_ambiguity
20260807002420  business_web_research
20260807110921  signup_reward_and_loyalty_types_and_scan
20260807113222  business_verification_system
20260807120746  staff_accounts
20260807121003  favourites
20260807123057  fix_membership_scope_for_staff
20260807133853  owner_signup_role_grant_and_gallery
20260807135108  customer_engagement_privacy
20260807140357  owner_growth_tools
20260807140403  access_panel_controls
20260807141140  brands_and_franchises
20260807145633  fix_business_signup_and_role_boundaries
20260807153904  brand_workspace_feature_flags_and_delivery
20260808120718  owner_shop_deletion
20260808120844  secure_owner_shop_deletion_rpc
20260808122423  owner_legal_document_emails
20260814101953  security_hardening
20260814102114  add_check_daily_limit
20260814102422  revoke_anon_daily_limit
20260814102505  revoke_check_daily_limit_from_public
20260817144350  push_notifications
20260817180033  scanned_member_details
20260817181644  reward_redemption_push_notification
20260817183924  shop_social_links
20260818160149  harden_upload_file_constraints
20260818165524  admin_transfer_business_ownership
20260824175004  whatsapp_customer_onboarding
20260826172913  account_deletion_and_owner_handoffs
20260826174647  fix_handoff_storage_owner
20260827112800  archive_whatsapp_customer_onboarding
20260827113644  usage_analytics
20260830140303  add_admin_laptop_backup_history
20260910193720  review_moderation
20260912152151  announcement_push
20260915204344  revoke_anon_request_announcement_push
20260915204406  revoke_authenticated_request_announcement_push
20260915204431  revoke_public_request_announcement_push
20260919214259  add_list_storage_objects_by_owner
20260921230406  add_platform_announcement_targets
20260921230717  make_platform_announcement_body_optional
```

**Content-level confirmation already done (not re-derivable by Codex, so trust this
rather than re-verify)**: `public` schema's full table list, and `memberships`' exact
columns, both match what local's pre-Fidel migration history would produce, with zero
Fidel tables/columns present. `whatsapp_handoff_links` — the one area whose naming
looked most divergent — also checked out at the column level (`token_hash`, not a
plaintext token, coherent shape). This was obtained via direct read-only SQL against
the live database through the management API, which Codex's environment doesn't have
access to; there's no equivalent re-check Codex can perform, so this stands as given
fact for the mapping step, not something to re-verify or second-guess.

**Note two things this list makes visible that weren't obvious before:**
- `whatsapp_customer_onboarding` (20260824175004) and `archive_whatsapp_customer_onboarding`
  (20260827112800) are almost certainly **not** a 1:1 match to local's three
  separately-named WhatsApp migrations (`whatsapp_start_onboarding`,
  `fix_whatsapp_handoff_token_hash`, `add_optional_whatsapp_shop_qr`, if those are
  still the local file names — Codex should confirm current local filenames fresh, not
  trust this recollection) — likely a squash or a rename-with-consolidation. Map by
  reading actual SQL content, not by assuming order-of-appearance correspondence.
- `20260814101953`–`20260814102505` is **four** remote migrations (`security_hardening`,
  `add_check_daily_limit`, `revoke_anon_daily_limit`,
  `revoke_check_daily_limit_from_public`) where local may have fewer or differently-split
  files covering the same ground — check count, not just names, in this cluster too.

## Exact next Codex task (revised — mapping data now provided)

1. List current local migration filenames fresh (`ls supabase/migrations` or
   equivalent) — do not rely on any filenames mentioned in this handoff's history, they
   may be stale.
2. For each of the 49 remote versions above, find the local file(s) whose actual SQL
   content matches — read the file, not just its name, and compare against what the
   version's name implies. Build an explicit mapping list (remote version → local
   filename) and report it here **before running any repair command** — this is a
   checkpoint, not optional.
3. Flag explicitly, don't silently resolve: any remote version with no obvious local
   match, any local file with no obvious remote match, and the two clusters called out
   above (WhatsApp onboarding, the four `20260814` migrations) specifically.
4. Only after that mapping is reported and reviewed: reconcile via `supabase migration
   repair --status applied <version>` for each confirmed 1:1 mapping. Verify this
   command doesn't need Docker before running.
5. The four Fidel migrations are untouched throughout this — this step is entirely
   about the 49 pre-Fidel versions.
6. After reconciliation, re-run `supabase migration list --linked` and confirm no
   remaining divergence outside the four (still-unapplied) Fidel migrations, then
   resume the paused deployment task (`db push`, deploy `fidel-webhook`, test
   fixtures, report the live URL).

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md` directly from this project. Claude has provided the authoritative 49-entry remote version-to-name mapping under "Authoritative remote version-to-name mapping" in `CLAUDE_HANDOFF.md`, obtained via a tool Codex's environment doesn't have access to — treat it as given fact, not something to re-derive. Follow "Exact next Codex task (revised)" exactly: list local files fresh, build and report the content-based mapping (step 2) *before* running any repair command, explicitly flagging the WhatsApp-onboarding cluster and the four `20260814` migrations rather than guessing at them. Only after that mapping is reviewed, proceed to reconciliation and the resumed deployment. Report back after each step. Update `CLAUDE_HANDOFF.md` after each completed item, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-22 Codex content-mapping checkpoint — review required

Read the current local migration inventory and SQL bodies. Confirmed 1:1 semantic
mappings: `0001→20260806112723`, `0002→06112814`, `0003→06120707`,
`0004→06144703`, `0005→06144750`, `0006→06144908`, `0007→07000229`,
`0008→07000239`, `0009→07001421`, `0010→07002420`, `0011→07110921`,
`0019_business_verification_system→07113222`, `0016→07120746`, `0017→07121003`,
`0018→07123057`, `0019_owner_signup→07133853`, `0020→07135108`, `0021→07140357`,
`0022→07140403`, `0023→07141140`, `0024→07145633`, `0025→07153904`,
`0026→08120718`, `0027→08120844`, `0028→08122423`,
`20260817000100→17144350`, `17000200→17180033`, `17000300→17181644`,
`17183730→17183924`, `18155942→18160149`, `18174500→18165524`,
`26000000→26172913`, `26000001→26174647`, `27000000→27113644`,
`30135555→30140303`, `20260910120000→10193720`,
`20260919214500→19214259`.

Flagged; no safe 1:1 mapping: remote `20260814101953/14102114/14102422/14102505`
versus local `20260814001109`, `0029`, `0030` (local security SQL combines/revokes
multiple privileges); remote WhatsApp `20260824175004/20260827112800` versus local
`20260829130005/30010000/30013000` (onboarding, hash correction, QR feature);
remote announcement versions `20260912152151/20260915204344/15204406/15204431` versus
local announcement migrations `0012`, `0013`, `20260912150000`, `20260915180000`.
Also no unambiguous remote counterpart by name/content inference for local
`0014_reviews_and_owner_replies` and `0015_platform_access_panel_and_support`.

Per instruction, stopped before `migration repair`. Fidel migrations untouched.

## 2026-09-23 Claude: card-linking architecture plan (draft, awaiting product owner)

Product owner redirected Claude to card linking (milestone 7 design). The migration-
reconciliation review requested below is **still pending**; not done in this pass.

- **What changed:** new [CARD_LINKING_PLAN.md](CARD_LINKING_PLAN.md); pointer added to
  ARCH_PLAN.md §6 item 6; IMPLEMENTATION_TIMELINE.md milestone 7 status updated. No code,
  migrations or config changed.
- **Research performed (documentation + package source, no sandbox calls):** Fidel RN
  SDK guide/reference v2, migration guide, security guidelines, iOS/Android guides,
  Cards docs, Select webhooks, API reference (Get/Delete Card, List by metadata). Also
  downloaded and read `fidel-react-native@3.2.1` from npm (docs only describe v2).
  Key facts: official RN bridge exists (legacy NativeModules, not TurboModule; no Expo
  plugin; Android needs JitPack repo; iOS 15.1); SDK key must be served from our server;
  result carries `cardId`; `card.linked` webhook payload lacks metadata.
- **Product decisions confirmed 2026-09-23:** entry points = account sheet + enrolled-
  shop prompt + one-time intro; max 5 cards; shared card refused generically; account
  deletion deletes all Fidel card data.
- **Security design:** per-user secret `fidel_metadata_id` passed as SDK metadata; server
  verifies a claimed `cardId` via `GET /v1/cards/metadata/{id}` with the secret API key
  before a service-role insert. Client-supplied card ids are never trusted.
- **New defect found (not yet fixed, affects unapplied Fidel migration):**
  `fidel_transactions.user_id`/`linked_card_id` are `on delete restrict`, so
  `delete-my-account`'s `auth.admin.deleteUser` will fail for any user with a Fidel
  transaction. Fix specified in CARD_LINKING_PLAN.md §3.4.
- **Open:** product decisions D1 (cash visits vs ARCH_PLAN §4.8 blanket block), D2
  (confirm post-sign-in intro instead of pre-sign-in onboarding slide), D3 (Amex);
  unknowns U1–U8 resolved by the CL-1 spike.
- **Next action — owner: product owner.** Confirm the plan and answer D1–D3. Then Claude
  writes Codex's CL-1 spike prompt. **Do not hand card-linking work to Codex before that.**

## Migration reconciliation decision (2026-09-23) — Claude: every version has an explicit treatment

Evidence gathered read-only through the Supabase management API (no remote writes).

**Correction to my own earlier instruction.** I previously said to reconcile with
`supabase migration repair --status applied <local version>`. That is withdrawn. It
would write 49 local version ids into the remote history table and still leave all 49
remote versions "remote-only", so `db push` would keep failing unless those were marked
`reverted`, which is exactly what must not happen. Codex's checkpoint stopped before
this, correctly.

**What the evidence shows.**
- `supabase_migrations.schema_migrations` on the live project holds **49 versions, all
  with full SQL in `statements`** (0 empty). The remote history is complete and
  authoritative.
- Every local-only effect is live, checked object by object: `reviews`,
  `review_replies` and their scope triggers (0014); `support_requests` and
  `ensure_current_user_bootstrap` (0015); `announcements` (0012/0013);
  `check_daily_limit` executable by authenticated only (0029/0030/security cluster);
  security-hardening revokes (`is_active_staff_of`, `lookup_user_by_stamp_code` not
  executable by anon); WhatsApp tables, service-only `find_whatsapp_user_by_phone`,
  token hashing inside `complete_whatsapp_signup`, and
  `businesses.whatsapp_onboarding_enabled` (WhatsApp cluster);
  `notifications.announcement_id` and `request_announcement_push` revoked from anon and
  authenticated (announcement cluster).
- **Codex's checkpoint missed two remote-only versions:** `20260921230406
  add_platform_announcement_targets` and `20260921230717
  make_platform_announcement_body_optional`. They have no local file at all. They touch
  platform announcements only; nothing the Fidel migrations use.
- **The Fidel migrations are safe against the live schema.** Every object they depend on
  exists under the exact name they use: `has_role`, `is_active_staff_of`,
  `staff_has_permission`, `update_updated_at_column`, `enforce_rewards_update_scope`,
  `enforce_membership_update_scope`, policy `transactions_insert_owner_or_staff_or_admin`,
  constraint `transactions_value_check`, `notifications.push_sent_at/push_error`, and the
  `transaction_type` enum (which correctly lacks `'spend'`). The three objects they
  replace are strict supersets of the live versions: the live membership guard's staff
  clause, the live insert policy's `staff_has_permission(..., 'scan_stamps')` path and
  membership requirement, and the live reward field list are all preserved. Nothing live
  is silently dropped.

**Treatment, per version (no `migration repair` of any kind):**

| Versions | Treatment |
|---|---|
| All 49 remote versions (37 with 1:1 local matches, 4 security, 2 WhatsApp, 4 announcement, 2 unmatched `20260921…`) | Unchanged on remote. Materialized locally as `<version>_<name>.sql` from the remote's own recorded statements. |
| The 37 recorded 1:1 mappings | **Approved as content-equivalence evidence.** Bookkeeping action is the row above plus archive, not repair. |
| All 49 pre-Fidel local files (`0001`–`0030` incl. both `0019`s, plus 18 dated files, including `0012`–`0015`, `0029`, `0030`, and every cluster file) | **Archived, not deleted and never pushed.** Move to `supabase/migrations_archive/pre_reconciliation_20260922/` so history is preserved in the repo. Every effect is verified live above. |
| The 4 Fidel migrations | Stay in `supabase/migrations/`, byte-identical. They sort after `20260921230717`. Pushed only after the checks below pass. |

**Card-linking defect (from the 2026-09-23 card-linking entry above).** The `on delete
restrict` foreign keys on `fidel_transactions` are kept on purpose. The fix lives in
`delete-my-account` (CARD_LINKING_PLAN.md §3.4), not in these migrations, so it does not
block this push. Two consequences for now: test fixtures must use a dedicated test
account, never a real shopper; and that fix must ship before any real shopper can link a
card.

## Tiered £ rewards migration (2026-09-25) — Claude implementing: applied live

- **Product owner decisions T1–T5** are recorded in ARCH_PLAN §4.11:
  - several £ rewards per shop;
  - a £20 default;
  - progress starts at £0 at the switchover, and unredeemed rewards stay;
  - the switchover goes ahead without Fidel;
  - the stamps/points/visits setup is removed.
- **Migration `20260925164755_fidel_spend_tiers.sql`:**
  - `reward_catalog.spend_threshold_pence` (unique per shop, 1..100,000,000);
  - a sync trigger keeps `businesses.reward_threshold_pence` equal to the highest tier;
  - `spend_next_tier()`: the next reward, or the highest tier if every tier was lowered;
  - `handle_spend_transaction` rewritten to walk the tiers: each tier issues its own
    titled reward with `catalog_id`; the top tier restarts the cycle and carries the
    excess; negative progress must be covered first; the single-threshold fallback
    remains;
  - progress notifications now say "£X away from <reward>";
  - `record_manual_spend` and `scanned_member_spend_summary` return the next reward's
    `thresholdPence` and `nextRewardTitle`;
  - a new `refuse_stamps_at_spend_shops` BEFORE INSERT guard (`shop_uses_spend_rewards`).
- **Tests:** new `fidel-spend-tiers.test.mjs`, 1/1 pass (one tier, two tiers,
  multi-crossing, carry, negative progress, lowered tiers, fallback, sync on
  insert/delete, RPC next-reward fields, duplicate and zero tiers refused, the stamp
  guard, the legacy 1–50 stamp range at stamp shops, and privileges).
  - The fixture gained `reward_catalog`.
  - `fidel-supabase-spend` now expects `shop_uses_spend_rewards` for its stamp-at-spend-
    shop insert, and `fidel-manual-spend` expects `nextRewardTitle`.
  - All 4 suites pass (4/4).
  - **Mutation check:** dropping the carry makes the test fail (0 vs 137); restored.
- **Applied:** `db push`. Live: latest `20260925164755`; both triggers present; Pure
  Elegant's next reward is £10 "Free reward" until the switchover gives its catalogue
  tier a £ amount.

## Push notifications for spend (2026-09-25) — Claude implementing: deployed

- **New `_shared/push.ts` plus `_shared/push-store.ts`:**
  - sends **every** unsent notification for a customer at a shop from the last 30
    minutes (e.g. a reward and a progress update), to every registered device, in Expo
    batches of 100;
  - respects `user_settings` (stamps, rewards, offers);
  - opted-out and no-device rows are marked handled (never retried); a rejected Expo
    request records the error but leaves the row unsent for a later retry.
- **`send-user-push`:** same sign-in and permission checks as before, now using the
  shared sender. Before, it sent only the single latest notification.
- **`fidel-webhook`:** a new `onProcessed` hook. After an auth is `processed`, the
  function finds the customer from `fidel_transactions` and sends their pushes in the
  background (`EdgeRuntime.waitUntil`, accessed defensively). A hook failure never
  changes the response to Fidel.
  - Also fixed the pre-existing type-only error (`FidelRpcClient.rpc` now returns
    `PromiseLike`).
- **Tests:** `node --test supabase/functions/_shared/*.test.mjs
  supabase/functions/fidel-webhook/*.test.mjs` passes 39/39, including a new
  `push.test.mjs` (4 tests) and 2 new handler hook tests. `deno check` is clean for
  both functions.
- **Deployed** `fidel-webhook` and `send-user-push`. Smoke tests: webhook unsigned → 401
  `invalid_signature`; send-user-push with the anon key → 401.
- **Not yet verified:** a real push on a phone. The next card payment or manual entry at
  a test shop will show it.
- **Deferred:** a retry sweep for failed pushes.

## Copy-ready prompt for Codex

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md`. Follow "Migration reconciliation decision (2026-09-23)". Do not run `supabase migration repair` in any form. Steps, in order, reporting after each:
>
> 1. Record `sha256` of the four Fidel migration files.
> 2. Move the four Fidel files to `supabase/.fidel_hold/` (outside the migrations folder).
> 3. Move all 49 pre-Fidel local migration files into `supabase/migrations_archive/pre_reconciliation_20260922/` (`git mv` for tracked files, `mv` for untracked). Do not delete any.
> 4. Check `supabase migration fetch --help`. If it exists and needs no Docker, run it against the linked project. If it's missing or needs Docker, **stop and report**; Claude will export the 49 files from the management API instead. Do not hand-write them.
> 5. Verify exactly 49 files now exist, and that each `<version>_<name>` matches the authoritative list in "Authoritative remote version-to-name mapping" exactly, with none empty.
> 6. Move the Fidel files back and confirm all four `sha256` values are unchanged.
> 7. Run `supabase migration list --linked`. Required: 49 matched on both sides, 0 remote-only, local-only is exactly the 4 Fidel migrations. If anything else appears, stop and report.
> 8. Run `supabase db push --dry-run` (confirm the flag with `--help`). It must list exactly the four Fidel files, in timestamp order. If it lists anything else, stop.
> 9. Only if steps 5–8 all pass: run `supabase db push`. Then run `supabase migration list --linked` again and report the result.
> 10. **Stop there.** Do not deploy `fidel-webhook` or insert fixtures in this pass. Claude will independently check the live schema after the push before deployment resumes.
>
> Also re-run the disposable-PostgreSQL integration test with the fetched history. If the local fixture can't replay Supabase platform objects (auth, storage, extensions), report that as an environment limit rather than working around it. Update `CLAUDE_HANDOFF.md` after each step, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-23 Codex reconciliation execution

Step 1 complete. Recorded SHA-256 values before moving the four Fidel migrations:

- `20260922171734_fidel_stamp_foundation.sql`: `C5D4A2F1125D58C809FDF95CFB5F142952254274BF125F56897872A6BE5F656C`
- `20260922194020_fidel_spend_schema.sql`: `B08119E626EC9B1C85163C2DBC35C8A98590AB024A20BCF2A8A56FD188477177`
- `20260922194307_fidel_spend_processing.sql`: `AB2EF8C2EC0C29D7A64913D0714D9468F8A9EFBBED24CF8EAF41C546D6E68E5F`
- `20260922215848_fidel_webhook_processing.sql`: `871828B8062F68DD9CE15078FE56CD1CAC71560A6C44215DF7688318FE71A1C4`

Step 2 complete. Moved the four Fidel migrations to `supabase/.fidel_hold/`; active
`supabase/migrations/` contained no Fidel file afterward.

Step 3 complete. Used `git mv` to archive all 49 tracked pre-Fidel local migrations
under `supabase/migrations_archive/pre_reconciliation_20260922/`. Verified archive
count = 49 and active migration count = 0. Nothing was deleted.

Step 4 complete. Verified `supabase migration fetch --help`; the command exists and
does not declare a Docker requirement. Ran `supabase migration fetch --linked`
successfully. It fetched the linked project's 49 authoritative migration-history files
into `supabase/migrations/` without changing the remote database.

Step 5 complete. Verified exactly 49 fetched files; filenames match the authoritative
version/name list exactly, with 0 missing, 0 extra, and 0 empty files.

Step 6 complete. Restored the four Fidel migrations to `supabase/migrations/` and
recomputed SHA-256. All four hashes exactly match Step 1; active migration count is 53
(49 fetched history + 4 Fidel), and the hold directory is empty.

Step 7 complete. `supabase migration list --linked` shows all 49 authoritative
pre-Fidel versions matched on both sides, 0 remote-only versions, and exactly the four
Fidel migrations as local-only.

Step 8 complete. Verified `db push --help`, then ran `supabase db push --dry-run
--skip-vault`. The dry run listed exactly the four Fidel migrations, in timestamp
order, with no seeds, roles, or other migrations.

Step 9 complete. Ran `supabase db push --skip-vault`; Supabase applied exactly these
four migrations, in order: `20260922171734`, `20260922194020`, `20260922194307`, and
`20260922215848`. A post-push `supabase migration list --linked` shows all 53 local
versions matched on the remote with no divergence.

Disposable-PostgreSQL verification also completed against the reconciled migration
folder: `node --test apps/api/test/integration/fidel-supabase-spend.test.mjs` passed
1/1. The fixture successfully handled the fetched history needed by this test; no
platform-object workaround was required.

Step 10 complete: stopped after the database push. `fidel-webhook` was not deployed,
and no fixtures or secrets were inserted/configured.

## Live schema review after the Fidel push (2026-09-23) — Claude: structure approved, one required fix before the webhook can work

Checked independently, read-only, through the Supabase management API. I didn't rely on
Codex's report.

**Approved, verified live:**
- History: 53 versions, the last four being the Fidel migrations in order.
- `transaction_type` now includes `'spend'`. `transactions_value_check` keeps the old
  1–50 range for every non-spend type and requires `value > 0` for spend.
- **No existing customer or merchant is affected.** All 10 businesses are on
  `reward_model = 'stamp_legacy'`, the column default is `'stamp_legacy'`, no business
  has a threshold set, every membership has 0 progress and no hold, there are 0 spend
  transactions, and all four Fidel tables are empty.
- The four new tables have RLS on and are owned by `postgres`. `anon` has no access at
  all. `authenticated` has `SELECT` only on `linked_cards` (own rows or admin) and
  `business_fidel_locations` (owner, active staff or admin). `fidel_transactions` and
  `fidel_webhook_events` have no client access; `service_role` only.
- Insert policy on `transactions` blocks `'spend'` from every signed-in user and keeps
  the owner, staff `scan_stamps`, admin and membership rules exactly.
- Every new or replaced function is `SECURITY DEFINER` with a fixed `search_path`
  (`''` for the webhook RPC). Only `service_role` can execute them; `anon` and
  `authenticated` cannot.
- Triggers: `on_spend_transaction` fires only for `'spend'`; the legacy
  `on_stamp_transaction` is intact; the membership and reward guards are attached.
- Supabase security advisor: nothing flagged for any Fidel function. It lists
  "RLS enabled, no policy" (INFO) for `fidel_transactions` and `fidel_webhook_events`,
  which is intended: deny every client, service role only.

**Required fix — the functions may not recognise the backend on the real API path.**
Three functions decide "is this the trusted backend?" by reading only the legacy setting
`request.jwt.claim.role`: `process_fidel_webhook_event`, `apply_spend_clawback`, and
`enforce_membership_update_scope`. On this project, Supabase's own `auth.role()` and
`auth.uid()` fall back to the newer `request.jwt.claims` JSON, because current versions
of Supabase's API layer may set only that one. If the legacy value is absent:
- every webhook call is rejected with "requires service role" and returns 500, so
  nothing is ever processed;
- refunds fail twice over: `apply_spend_clawback` refuses, and the membership guard
  blocks its balance update.

No data would be corrupted; the feature would simply never work. The disposable test
passed because its fixture sets the legacy value by hand, so it can't catch this. The
database permissions (EXECUTE only for `service_role`) are correct either way; only
these redundant in-function checks are affected.

**Fix:** a **new** corrective migration. Don't edit the four applied files: that would
make them differ from the SQL recorded in the live history. Recreate the three
functions unchanged except for the role check, which becomes
`coalesce(auth.role(), '') = 'service_role'` (always schema-qualified, since the
webhook RPC has an empty `search_path`). `auth.role()` checks both settings, so this is
safe whichever one the API layer sets. Apply it even if the probe below passes.

**Not blocking, not Fidel, existing issues for a separate pass:** the advisor flags
`deliver_shop_announcement()` and `notify_reward_redeemed()` (trigger functions) as
executable by `anon`, and leaked-password protection as disabled in Auth settings. The
long "authenticated can execute SECURITY DEFINER" list is the existing app's RPC surface
and is expected.

**One thing to watch at the first signed request (not blocking the deploy):** the
handler matches `request.url` exactly against the registered URL. If Supabase's runtime
hands the function a different host or scheme than the public URL, a genuine Fidel
delivery would get a 404 `unconfigured_webhook_route`. Check this first if that
happens.

### Execution scope for the live role fix (partially completed; see current status below)

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md`. Follow "Live schema review after the Fidel push (2026-09-23)". Report after each step. Never write keys into any file, the handoff, or chat; hold them only in shell environment variables for the duration of a command.
>
> 1. **Probe the real API path before changing anything.** Get the project's service-role and anon keys with the Supabase CLI into environment variables. Using `supabase-js` against the linked project, call RPC `process_fidel_webhook_event` with `_fidel_message_id: ''`, `_event_type: 'transaction.auth'` and non-empty placeholder strings for the other text arguments (`_original_transaction_id: null`, `_amount_pence: 0`, `_auth: true`, `_cleared: false`). With the **service-role** key, record the error message. "invalid validated Fidel transaction arguments" means the role check passed; "requires service role" confirms the defect. Both fail before any write. Repeat with the **anon** key and confirm permission is denied. Confirm `fidel_webhook_events` still has 0 rows.
> 2. **Write the corrective migration** with `supabase migration new fidel_service_role_detection`. It recreates `process_fidel_webhook_event`, `apply_spend_clawback` and `enforce_membership_update_scope` exactly as they are now, except the service-role check becomes `coalesce(auth.role(), '') = 'service_role'`. Copy the current bodies from the applied migrations; change nothing else. Re-state the existing revokes and grants so privileges are unchanged.
> 3. **Update the disposable test** so its "service role" context sets only `request.jwt.claims` (JSON with `role: service_role`) and not the legacy `request.jwt.claim.role`. Run it against the full migration folder; it must pass. Also run the synthetic handler and helper suites.
> 4. `supabase db push --dry-run`: it must list only the new migration. Then `supabase db push`, and `supabase migration list --linked` must show 54 matched versions.
> 5. **Repeat the step 1 probe.** The service-role call must now return "invalid validated Fidel transaction arguments", and anon must still be denied. If not, stop and report.
> 6. **Deploy the webhook:** `supabase functions deploy fidel-webhook`. `config.toml` already sets `verify_jwt = false` for it. With no `FIDEL_WEBHOOK_*` secrets set, the function has no configured route, so it can't process anything. Smoke test: a `GET` returns 405, and an unsigned `POST` returns 404 `unconfigured_webhook_route`. Report the deployed URL exactly as Supabase prints it.
> 7. **Stop.** Don't set any `FIDEL_WEBHOOK_*` secret or insert fixtures. The product owner registers the webhook URL on Fidel's dashboard next, then adds the resulting secrets through Supabase secrets.
>
> Update `CLAUDE_HANDOFF.md` after each step, then replace this section with the single copy-ready prompt for Claude Code.

## 2026-09-23 Codex configured-route verification

Step 1 complete: `supabase secrets list` confirmed exactly these six configured Fidel
secret names: `FIDEL_WEBHOOK_AUTH_URL`, `FIDEL_WEBHOOK_AUTH_SECRET`,
`FIDEL_WEBHOOK_CLEARING_URL`, `FIDEL_WEBHOOK_CLEARING_SECRET`,
`FIDEL_WEBHOOK_REFUND_URL`, and `FIDEL_WEBHOOK_REFUND_SECRET`. No values are recorded.

Step 2 failed, stopped as specified: unsigned `{}` POST probes returned `404`
`unconfigured_webhook_route` for all three public routes (`?event=auth`,
`?event=clearing`, `?event=refund`) instead of `401 invalid_signature`. Platform JWT
verification is not the cause: the function ran and returned its own 404. This confirms
the runtime URL does not match the registered URL strings under the current exact-match
design. No code, secret, fixture, transaction, or real Fidel delivery was changed.

## 2026-09-23 Codex corrective deployment continuation

Step 1 complete: retained the full-history replay test unchanged except its explicit
skip reason prescribed in the corrective review. Ran it: 1 skipped, 0 passed, 0 failed.
Full replay remains a pre-pilot requirement, not claimed coverage. Claude's technical
waiver authorizes this corrective push; no product-owner test-gate answer is needed.

Step 2 complete: dry-run listed only `20260922233331_fidel_service_role_detection.sql`;
`supabase db push --skip-vault` applied that migration successfully, with no seeds,
roles, or secret updates.

Step 3 complete: `supabase migration list --linked` confirmed exactly 54 matched
versions and 0 divergent versions after the corrective push.

## 2026-09-23 Claude: card-linking decisions D1–D3 recorded (appended; does not change Codex's current reconciliation prompt)

The card-linking draft entry above is superseded by this one.
- **Product owner decided:**
  - D1: card-linked customers can still get staff-confirmed manual entries (cash or an
    unlinked card), max 3 per customer per shop per day, at least 30 minutes apart.
  - D2: the post-sign-in intro sheet is confirmed.
  - D3: Amex is supported.
- **Files changed:**
  - CARD_LINKING_PLAN.md: §1 P5–P7, §3.6 rewritten, §6, §7, §8 U5, §9. CL-2 now states
    it needs a new migration, because the four Fidel migrations are being pushed in the
    reconciliation.
  - ARCH_PLAN.md §4.8: amendment note.
  - IMPLEMENTATION_TIMELINE.md: milestone 7 status.
- **Design detail added:**
  - P5 is enforced by a `BEFORE INSERT` trigger on `transactions`, not by RLS. It uses an
    advisory lock, because the membership row may not exist yet, and counts by
    Europe/London calendar day.
  - New columns `transactions.manual_payment_method` and `recorded_by`. `transactions`
    currently records no inserter.
  - New staff-only RPC `customer_card_link_status`, and a "how did they pay?" sheet in
    the retailer app.
- **Checks performed:** documentation and schema reading only. No code, tests or
  database run.
- **Open, not blocking CL-1:**
  - P5 has no effect at spend-threshold shops until the server-validated manual-spend
    RPC is designed.
  - The optional guard (no manual entry within 30 minutes of a Fidel authorization) is
    off unless requested.
  - The account-deletion FK fix (CARD_LINKING_PLAN §3.4) must ship before any real
    shopper links a card.
- **Next action, owner Codex:** finish the current reconciliation pass first, as its
  prompt says. Then run card-linking **CL-1** with the queued prompt below.
- **Next action, owner product owner:** add the Fidel **test** SDK key and secret API key
  to the agreed secret settings when Codex asks. Never put them in chat or this file.

### Queued prompt for Codex: card linking CL-1 (run after the reconciliation pass is complete)

> Read `CLAUDE_HANDOFF.md`, `CARD_LINKING_PLAN.md`, `ARCH_PLAN.md` and `IMPLEMENTATION_TIMELINE.md` directly from this project. Carry out **CL-1 only** from `CARD_LINKING_PLAN.md` §7. It is a spike: no production code is merged, nothing is deployed, no migrations are written, and no live keys are used.
>
> **Build and enroll**
> - Build an Expo dev-client of `apps/shopper` that includes `fidel-react-native@3.2.1`. Add the JitPack Maven repository through Expo config; verify the exact config key in the docs for the installed Expo SDK (~54), not v57.
> - Keep the New Architecture enabled.
> - Serve the Fidel **test** SDK key from a stub authenticated endpoint. Never bundle it.
> - On a real iOS device and a real Android device, enroll a Fidel test Visa and a test Amex with `metaData.id` set to a random test id.
>
> **Record redacted evidence for each unknown in §8 (U1–U8)**
> - The exact `ENROLLMENT_RESULT` and `ERROR` shapes, including `userCanceled`, and `cardAlreadyExists` when the same test number is re-entered under a *different* metadata id (U4).
> - Whether the bridge works under the New Architecture (U1).
> - Whether Fidel's screen appears above an open RN `Modal` (the account sheet) (U7).
> - From a server-side script using the test secret API key: the response shape and pagination of `GET /v1/cards/metadata/{id}`, and whether `GET /v1/cards/{id}` includes `metadata` (U2).
> - Which delete path works, and whether re-enrolling the same test number after delete returns a new `card.id` (U3).
>
> **Rules**
> - Never put SDK or API keys, card numbers or full card ids in any project file. Redact ids to their last 4 characters.
> - If you need the product owner to add the test keys to secret settings, stop and ask.
> - Update `CLAUDE_HANDOFF.md` after each completed item. End with a copy-ready Claude Code prompt asking Claude to review the CL-1 findings before CL-2 starts.

## 2026-09-23 Codex live role detection fix and webhook deployment

Step 1 complete — read-only API probe against `tgukdabfvvoywawmzbdo` via
`supabase-js`: service role returned HTTP 400 / `P0001`,
`process_fidel_webhook_event requires service role`; anon returned HTTP 401 /
`42501`, `permission denied for function process_fidel_webhook_event`.
`fidel_webhook_events` remained at 0 rows. CLI keys were held only in the command's
process environment and cleared afterward; none were written to files or output.

Test-evidence correction: the previous 1/1 disposable test loaded only the four Fidel
migrations atop a handwritten public-schema fixture. It did **not** replay the full
fetched migration history. The earlier claim that fetched history was successfully
handled without platform workarounds is withdrawn. This pass will distinguish focused
Fidel regression coverage from the full-history replay attempt.

Step 2 complete — created `supabase/migrations/20260922233331_fidel_service_role_detection.sql`
with the official CLI. Copied the three applied function definitions and their existing
revokes/grants; changed only role detection to use schema-qualified
`coalesce(auth.role(), '')`. The membership check compares equality; the two rejecting
guards preserve their existing `<> 'service_role'` condition. No applied migration was
edited. Mechanical comparison confirms exactly those three role-check replacements.

Step 3 work completed so far: updated
`apps/api/test/integration/fidel-supabase-spend.test.mjs` for JSON-only claims,
fixture `auth.role()`/`auth.uid()` fallbacks, explicit legacy-setting absence checks,
sorted Fidel migration loading, and service/anon/authenticated role/ACL probes.
Test name explicitly identifies its limited public-schema fixture scope. Verification
is pending.

Added `apps/api/test/integration/supabase-history-replay.test.mjs` to attempt all
migration files unchanged against disposable PostgreSQL. Full replay **failed** at
`20260806112723_foundations_auth.sql`: SQLSTATE `0A000`, `extension "pg_net" is not
available`. The initial sandbox attempt also failed at Windows user lookup; rerunning
outside the sandbox reached PostgreSQL and established the real extension blocker.
No historical SQL was stripped or changed, and no full-history pass is claimed.

Helper and synthetic-handler suites passed 10/10 (synthetic data only). Focused
integration syntax check passed; its initial sandbox run failed before assertions
with `uv_os_get_passwd` / `ENOMEM`, so a permitted outside-sandbox rerun is needed.

Focused rerun reached PostgreSQL but exposed a test-fixture ACL assumption: the
membership trigger has no explicit service-role EXECUTE grant in the original SQL,
and stock PostgreSQL lacks Supabase's default grants. Corrected the test to compare
all three function ACLs before/after the corrective migration and assert explicit
RPC grants separately. No database-function privileges were changed to satisfy a test.

Focused JSON-only claims regression now passed 1/1, including accounting, refunds,
redemption race, service/anon/authenticated access and unchanged ACLs. Full-history
replay remains blocked by missing `pg_net` and is not a pass. Asked the product owner
whether the passing focused suite plus Claude's live-schema review and before/after
API probes may substitute for that latest handoff gate; no corrective push or webhook
deployment will occur while this question is pending.

Step 4 dry-run portion complete — `supabase db push --dry-run --skip-vault` listed
only `20260922233331_fidel_service_role_detection.sql`; no seeds or roles. Rechecked
all four applied Fidel migration hashes against the recorded originals: unchanged.
The new migration was mechanically compared with source bodies/ACL statements and
differs only at the three approved role checks. Push remains pending the test-gate
decision above.

Independent local review found no additional defects: source function bodies and
revokes/grants are preserved apart from role detection, and focused test ACL/claims
checks are accurate. Updated `IMPLEMENTATION_TIMELINE.md` to reflect applied database
history, the role-fix gate, and the deployment sequence; card-linking decisions remain
unchanged.

Current stopping point: Steps 1–2 complete; focused/synthetic portions of Step 3
pass, full-history replay cannot pass in the available embedded runtime. Step 4 dry-run
is complete, but the corrective push and Steps 5–7 remain pending. No function was
deployed and no Fidel secrets or fixtures were created. Product-owner input is required
only to accept substitute evidence for the full-history test gate (or provide a full
Supabase test environment). The existing backend rejection remains live until the fix
is applied.

## Corrective migration review (2026-09-23) — Claude: APPROVED to push; full-history gate resolved

**Only the three role checks changed. This is proven against the live database, not
the local files.**
- For each function, the database took the live body, swapped the legacy role check
  for the new one and computed an md5.
- I computed the md5 of the matching body in
  `20260922233331_fidel_service_role_detection.sql` (LF line endings, no CRLF).
- All three match:
  - `process_fidel_webhook_event`: `bdb0c2c9…`, 6545 chars
  - `apply_spend_clawback`: `10ab8ce5…`, 735 chars
  - `enforce_membership_update_scope`: `d77421c7…`, 1613 chars
- After the swap, no `request.jwt.claim.role` remains in any of the three. The
  membership check's logic is unchanged: both old and new forms are false when no
  role is present.

**Privileges are preserved.**
- Live ACL of all three is `{postgres=X/postgres, service_role=X/postgres}`.
  `create or replace` with identical signatures keeps the existing ACL, and the
  migration's restated revokes and grants are no-ops against it.
- `search_path` (`''` for the RPC, `public` for the others) and `SECURITY DEFINER`
  are the same.
- The definer (`postgres`) can execute `auth.role()`.
- The focused test independently asserts that every ACL is identical before and after
  the migration.

**Tests reviewed.**
- `fidel-supabase-spend.test.mjs` now sets only `request.jwt.claims` and asserts the
  legacy settings stay unset.
- Its fixture `auth.role()` and `auth.uid()` match the live Supabase definitions
  exactly (checked earlier today).
- Its role and ACL probes are correct. Its limited scope is honestly named.
- Codex's correction is noted and accepted: the earlier 1/1 run never replayed full
  history.

**Full-history gate: resolved by Claude.** No product-owner decision is needed: this
was a technical evidence gate I set, not a product question. I withdraw the "full
migration folder must pass" requirement for this change.
- **Why it can't be met here:** the authoritative history needs Supabase platform
  extensions (`pg_net` from the first migration), which embedded PostgreSQL can't
  provide. The only ways to get it are Supabase's local stack (needs Docker, not on
  this machine) or a Supabase preview branch (a paid feature).
- **Substitute evidence, which is stronger for this change:**
  - the md5 proof above, against live bodies;
  - the live ACL snapshot plus the before/after ACL test;
  - the JSON-only-claims regression, 1/1, covering accounting, refunds and the
    redemption race;
  - synthetic handler and helper tests, 10/10;
  - a dry-run listing only this migration;
  - the before and after live API probes.
- **Scope of the waiver:** it covers only this corrective push. **Genuine full-history
  replay is recorded as a pre-pilot gate** (before timeline milestone 9): run it with
  Docker on a machine that has it, or on a Supabase preview branch if the product owner
  approves the cost.
- **Keep the replay test:** don't delete `supabase-history-replay.test.mjs`. Mark it
  skipped with that reason, so it isn't a permanent failing test and nobody reads it as
  coverage.

## 2026-09-23 Claude: release scope decided — every shop on Fidel and spend-based at release

This doesn't change the Codex prompt below. Finish that push and deploy pass first.

- **Product owner decided:**
  - Every shop is enrolled with Fidel by release.
  - Every shop runs spend-based rewards at release; the stamp system is kept, switched
    off.
  - What happens to the current test shops is deferred until shortly before release.
- **Files changed:**
  - ARCH_PLAN.md: new §0b; §6a marked release-blocking; §6 items 9–10.
  - IMPLEMENTATION_TIMELINE.md: new milestone 8a.
  - No code or database changes.
- **Now release-blocking:**
  - automatic Fidel enrollment plus a backfill (§6a; Brand-mapping question must be
    researched first);
  - manual spend entry (RPC, retailer amount UI, the per-day limits; **not yet
    designed**);
  - a threshold required for every shop;
  - a release cutover migration that flips every shop, and the default, to
    `spend_threshold`. It must refuse to run unless every shop has a threshold and an
    active Fidel Location.
- **The `'stamp_legacy'` default stays until that cutover.**
- **Product owner action:** ask Fidel how long a live shop Location takes to activate, (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end)
  and whether each shop must consent or sign anything. It isn't verified, and it sets how
  early real shops must be registered before release.
- **Claude action (next design pass, after the current deploy review):** Fidel Brands API
  research and brand mapping; design of manual spend entry and the cutover.

## Post-push verification (2026-09-23) — Claude: APPROVED to deploy `fidel-webhook`

Codex applied `20260922233331_fidel_service_role_detection.sql` (54/54 versions matched)
but couldn't run the post-push API probes or the deploy: the environment's approval
system hit its usage limit. Claude ran the probes independently on the live project.
Each probe switched to the caller's role, set **only** `request.jwt.claims` (the same
way Supabase's API layer does, with the legacy setting absent), and ran inside a
transaction that was rolled back. Every probe fails before any write.

| Check | Result |
|---|---|
| History | 54 versions, last `20260922233331` |
| All three functions | Use `auth.role()`; no `request.jwt.claim.role` left; ACL unchanged `{postgres=X, service_role=X}` |
| `process_fidel_webhook_event` as `service_role`, empty message id | `P0001 invalid validated Fidel transaction arguments`: **role check passes** (it was "requires service role" before the fix) |
| `apply_spend_clawback` as `service_role`, `_delta = 1` | `P0001 clawback requires a negative delta and nonempty reason`: **role check passes** |
| `process_fidel_webhook_event` as `anon` | `42501 permission denied` |
| `apply_spend_clawback` as `anon` | `42501 permission denied` |
| Side effects | `fidel_webhook_events` 0, `fidel_transactions` 0, spend transactions 0, memberships with progress or a hold: 0 |

**Limit, stated plainly:** this simulates the API layer inside the database; it isn't an
HTTP call through Supabase's gateway. The deploy smoke test below covers the HTTP path.
If approvals allow, Codex's `supabase-js` probes are a useful extra, but they no longer
block deployment.

## 2026-09-23 Codex webhook deployment and smoke test

Step 2 complete: deployed `fidel-webhook` through the Supabase API bundler using the
existing `config.toml` setting `verify_jwt = false`. Supabase reported:
`https://supabase.com/dashboard/project/tgukdabfvvoywawmzbdo/functions`.
The public function URL tested was
`https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook`.

Step 3 complete: without an Authorization header, `GET` returned `405`
`{"error":"method_not_allowed"}` and an empty unsigned `POST` returned `404`
`{"error":"unconfigured_webhook_route"}`. This confirms platform JWT verification is
off and the function rejects unconfigured routes before reading a payload.

Stopped after deployment. No `FIDEL_WEBHOOK_*` secret, card/location fixture, or Fidel
dashboard route was configured. The optional `supabase-js` HTTP probes were not retried;
Claude's independent rolled-back database probes are recorded above.

## Deployment review (2026-09-23) — Claude: APPROVED; product-owner registration next

Verified independently:
- **`verify_jwt = false`:** `supabase/config.toml` has `[functions.fidel-webhook]
  verify_jwt = false`, and the behaviour proves it's live. Claude's own requests, with
  no `Authorization` header, reached the function rather than being rejected with 401 by
  the platform.
- **Smoke responses, exact:**
  - `GET https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook` →
    `405 {"error":"method_not_allowed"}`
  - unsigned `POST` → `404 {"error":"unconfigured_webhook_route"}`
- **No secrets:** the 404 means no `FIDEL_WEBHOOK_*` URL/secret pair is configured.
  The Supabase CLI isn't available in Claude's shell, so secret names were confirmed by
  behaviour, not by listing.
- **No fixtures:** `linked_cards` 0, `business_fidel_locations` 0, `fidel_transactions`
  0, `fidel_webhook_events` 0.

### Product-owner steps (only you can do these)

**Never paste a secret key into chat, email, this file, or any project file.**

**A. Fidel dashboard — Test mode, "The Loyalty Loop" program**
1. **Webhooks:** delete the existing `transaction.auth` webhook that points at
   `webhook.site`. It sends test data to a third-party inspector and would compete with
   the real route.
2. Create **three** webhooks, one per event. Copy each URL exactly, character for
   character. No custom headers.
   - Event `transaction.auth` →
     `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=auth`
   - Event `transaction.clearing` →
     `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=clearing`
   - Event `transaction.refund` →
     `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=refund`
3. Each webhook shows its own **secret key**. Keep all three for step B.
4. **Stop and tell Claude** if Fidel refuses a URL with `?event=…`, allows only one
   webhook, or doesn't offer `clearing` or `refund` events. The routing design depends
   on this.
5. **Locations:** create one test Location under the program (a plausible test address
   is fine in Test mode).
6. **Playground → Create card:** link Fidel's test Visa (`4444000000004***`). Don't
   create a transaction yet; Codex will ask when it's ready.

**B. Supabase dashboard — "The Loyalty Loop" project → Edge Functions → Secrets.** Add
exactly these six names (upper case):

| Name | Value |
|---|---|
| `FIDEL_WEBHOOK_AUTH_URL` | the auth URL above, exactly |
| `FIDEL_WEBHOOK_AUTH_SECRET` | the auth webhook's secret key |
| `FIDEL_WEBHOOK_CLEARING_URL` | the clearing URL above, exactly |
| `FIDEL_WEBHOOK_CLEARING_SECRET` | the clearing webhook's secret key |
| `FIDEL_WEBHOOK_REFUND_URL` | the refund URL above, exactly |
| `FIDEL_WEBHOOK_REFUND_SECRET` | the refund webhook's secret key |

**C.** Tell Codex "the Fidel webhook secrets are set" (never the values), then send it
the prompt below.

## Previous copy-ready prompt for Codex — superseded 2026-09-23 by the route-selection prompt at the end of this file (its step 2 failed: see "Codex configured-route verification")

> Read `CLAUDE_HANDOFF.md`, `ARCH_PLAN.md`, and `IMPLEMENTATION_TIMELINE.md`. The product owner has registered the three Fidel sandbox webhooks and set the six `FIDEL_WEBHOOK_*` secrets (see "Deployment review (2026-09-23)"). Never print, log, or write any secret value; list names only.
>
> 1. Run `supabase secrets list` and confirm exactly the six `FIDEL_WEBHOOK_*` names exist. If any is missing, stop and ask the product owner.
> 2. **Route-matching probe:** send an unsigned `POST` (body `{}`) to each of the three `?event=` URLs. Each must now return **401 `invalid_signature`**, which proves the function's `request.url` matches the registered URL. If any still returns 404 `unconfigured_webhook_route`, the runtime sees a different URL than the public one. **Stop and report**; don't change code, since Claude designs that fix.
> 3. **First genuine signed delivery:** ask the product owner to run Fidel Playground → Create Transaction with the test card at the test Location. Expect:
>    - Fidel's dashboard delivery log shows a 2xx for the auth webhook;
>    - `fidel_webhook_events` gains one `transaction.auth` row;
>    - the response status is `unknown_merchant`, which is correct because no fixtures exist yet.
>
>    A 401 means the double-HMAC doesn't match Fidel's real signature; stop and report the headers' *names* and the timestamp format, never values.
> 4. From Fidel's delivery log, record the payload's **field names and types** (redacted; ids to their last 4 characters, no card numbers). Compare them with `transaction.ts`'s expectations and note any difference.
> 5. **Stop.** Don't insert fixtures or trigger refunds yet. Claude reviews this first real delivery, then sets the fixture and refund-test task (on a dedicated test account only).
>
> Update `CLAUDE_HANDOFF.md` after each step, then replace this section with the single copy-ready prompt for Claude Code.

## Route-selection design review (2026-09-23) — Claude: fix designed and prototyped; Codex implements

**Root cause.** `index.ts` requires `request.url` to equal the whole registered URL. Inside
Supabase's runtime it never can.
- Supabase's routing docs say paths inside a function start with the function name. The
  function therefore sees `/fidel-webhook`, not `/functions/v1/fidel-webhook`. The runtime
  value itself was never printed. This is documented behaviour, and it matches all three
  404s.
- The gateway log records the public URL together with its query (`request.search =
  ?event=auth` on a 07:05 UTC GET). Codex's three configured-route POSTs appear as three
  function boots at 07:50 UTC. Their request rows had not reached the logs when checked.
- The deployed source (version 2, `verify_jwt: false`) is identical to the local
  `index.ts` and `handler.ts`.
- The secrets and the Fidel registrations aren't at fault. Any exact full-URL comparison
  fails here.

**Design: the query selects a route, the signature authenticates it.** `handler.ts` stays
unchanged. It already signs with `route.registeredUrl`, the configured string, not
`request.url`. Only route selection changes:
1. Read the request's `event` query values. Exactly one is required, and it must be
   `auth`, `clearing` or `refund` in exact lower case. It is looked up in a fixed
   server-side map. Anything else returns `null` (404). The request's scheme, host and
   path are ignored.
2. The map supplies the environment prefix and the event type. Read that prefix's `_URL`
   and `_SECRET`. If either is missing, return `null`.
3. The configured URL must parse and be canonical (`new URL(v).href === v`). It must use
   `https:`, its query must be exactly `?event=<selector>`, and it must have no fragment.
   Otherwise log `fidel-webhook route misconfigured <PREFIX>` (the prefix only, never the
   value) and return `null`.
4. Return `{ eventType, registeredUrl, secretKey }`. The handler verifies the double HMAC
   over `rawBody + registeredUrl + timestamp` with that secret, exactly as it does now.

**Why the query value is never trusted as the event type.** It only chooses which secret
the sender must already hold. The event type comes from server configuration. The URL
inside the signature names the same event.

| Attempt | Outcome |
|---|---|
| Forge any event on any route | Needs that route's secret → 401 |
| Replay a genuine signed auth delivery to `?event=refund` or `?event=clearing` within 5 minutes | The HMAC is recomputed with the refund or clearing URL and secret → 401. The URL differs even if Fidel reused one secret. Prototype-tested. |
| Environment swap (`FIDEL_WEBHOOK_AUTH_URL` holds the clearing URL) | Refused at step 3, error logged. Without step 3, a swapped URL and secret would let a replayed clearing delivery be processed as auth. |
| `?event=auth&event=refund`, `?event=AUTH`, `?event=transaction.auth`, `?event=__proto__` | 404 |
| Replay to the same route | Existing message-id and (transaction, event) uniqueness |
| Stray newline, space, upper-case host or `:443` in a `_URL` secret | Refused at step 3. It shows up in the unsigned probe instead of silently failing every real delivery with 401. |

Cost is unchanged: one double HMAC per request. A 404 still means routing and a 401 still
means the signature.

**Rejected alternatives**
- **Rebuild the public URL** from `x-forwarded-*` or `SUPABASE_URL` and keep the exact
  match. This trusts proxy headers and stays a fragile string comparison.
- **Try every configured secret** and accept the one that verifies. This works without
  the query, but it changes the handler contract, triples the HMAC work and loses the
  404/401 distinction. Keep it only as a fallback in case the query string doesn't reach
  the runtime. Supabase's docs show functions reading query parameters, so this isn't
  expected. It needs Claude's review before use.

**Prototype evidence (scratch copy, not the repo).** The reference `route.ts` below plus
4 `node:test` cases ran on Node 26 against the real `handler.ts` and `signature.ts`:
- a runtime-shaped URL (`http://…/fidel-webhook?event=…`) selects each of the three
  routes;
- 8 bad selectors → `null`;
- 8 misconfigured registered URLs → `null`;
- a signed auth delivery → 200 on `?event=auth`, 401 on `?event=refund` and
  `?event=clearing`, 404 on an unknown selector.

All 4 passed, and the existing suites still pass 10/10. Nothing was deployed, and no
repo code, secret, Fidel setting, database row or fixture was changed. `ARCH_PLAN.md`
§4.1 now records the routing rule.

**Reviewed reference: `supabase/functions/fidel-webhook/route.ts`**

```ts
import type { FidelWebhookRoute } from "./handler.ts";

type EnvGet = (name: string) => string | undefined;

// Selector value in `?event=` -> environment prefix and event type. The request's
// query only chooses which configured route to try; the event type is taken from
// server configuration and authenticated by that route's own signed URL and secret.
const routes = new Map<string, [string, FidelWebhookRoute["eventType"]]>([
  ["auth", ["AUTH", "transaction.auth"]],
  ["clearing", ["CLEARING", "transaction.clearing"]],
  ["refund", ["REFUND", "transaction.refund"]],
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function configuredRoute(requestUrl: string, env: EnvGet): FidelWebhookRoute | null {
  const selectors = parseUrl(requestUrl)?.searchParams.getAll("event") ?? [];
  const config = selectors.length === 1 ? routes.get(selectors[0]) : undefined;
  if (!config) return null;
  const [prefix, eventType] = config;
  const registeredUrl = env(`FIDEL_WEBHOOK_${prefix}_URL`);
  const secretKey = env(`FIDEL_WEBHOOK_${prefix}_SECRET`);
  if (!registeredUrl || !secretKey) return null;
  // The registered URL is part of the signed string, so it must name this same
  // event and be byte-for-byte canonical, or the route is treated as unconfigured.
  const registered = parseUrl(registeredUrl);
  if (!registered || registered.href !== registeredUrl || registered.protocol !== "https:" ||
      registered.search !== `?event=${selectors[0]}` || registered.hash !== "") {
    console.error("fidel-webhook route misconfigured", prefix);
    return null;
  }
  return { eventType, registeredUrl, secretKey };
}
```

In `index.ts`, delete the local `configuredRoute` and wire the new one:
`routeFor: (requestUrl) => configuredRoute(requestUrl, (name) => Deno.env.get(name))`.

### Fidel and Supabase configuration after the fix: nothing changes if the values are exact

| Fidel webhook event | URL registered in Fidel **and** stored in the `_URL` secret | Secret-key secret |
|---|---|---|
| `transaction.auth` | `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=auth` → `FIDEL_WEBHOOK_AUTH_URL` | `FIDEL_WEBHOOK_AUTH_SECRET` = the auth webhook's own key |
| `transaction.clearing` | `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=clearing` → `FIDEL_WEBHOOK_CLEARING_URL` | `FIDEL_WEBHOOK_CLEARING_SECRET` = the clearing webhook's own key |
| `transaction.refund` | `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/fidel-webhook?event=refund` → `FIDEL_WEBHOOK_REFUND_URL` | `FIDEL_WEBHOOK_REFUND_SECRET` = the refund webhook's own key |

- The selector is exact lower case: `auth`, `clearing` or `refund`. Never
  `transaction.auth`.
- Each `_URL` value is the URL registered in Fidel, character for character: `https://`,
  no trailing slash, no space or line break, no other query parameter and no `#`.
- Each `_SECRET` comes from its own webhook in Fidel. Never paste a secret into chat or a
  file.
- The old `webhook.site` auth webhook should already be deleted (step A1 above).
- If a probe logs `route misconfigured <PREFIX>`, the product owner re-enters only that
  one `_URL` value.

**Still unverified:** that Fidel signs using the registered URL *including* `?event=…`.
Only a genuine signed delivery can show this. A 401 on that delivery means stop and
report.


## Route-selection implementation (2026-09-23) — Codex

- Step 1 complete: added `supabase/functions/fidel-webhook/route.ts` from Claude's reviewed reference; `index.ts` delegates with the injected environment getter. Updated only the routing comment in `handler.ts`; handler logic and the signature, amount and transaction helpers are unchanged.
- Supabase routing documentation was checked again. The changelog fetch still fails because the web reader does not support its markdown content type. No secrets were read or changed, no dashboard changes, database writes or fixtures. Tests, deployment and probes are pending.
- Step 2 implementation complete: added `supabase/functions/fidel-webhook/route.test.mjs` with six tests for runtime URL routing, invalid selectors, invalid/missing configuration, prefix-only diagnostics and synthetic signed cross-route rejection (including shared-secret URL binding). These use generated synthetic test keys only; no provider-signed evidence is claimed. Full-suite execution is next.
- Step 2 verification complete: `node --test "supabase/functions/fidel-webhook/*.test.mjs"` passed **16/16** (10 existing + 6 new), zero failures/skips. Existing Node module-type warnings remain; no test failures needed fixing. New tests also prove rejected requests make no RPC call and diagnostics expose only the route prefix. Deployment is next.
- Step 3 deployment complete: `npx --yes supabase@latest functions deploy fidel-webhook --project-ref tgukdabfvvoywawmzbdo --use-api` succeeded, uploading only this function's six source modules. Local `supabase/config.toml` still has `verify_jwt = false`; remote metadata confirmation and unsigned probes are next. The sandboxed CLI help lookup stalled and was cancelled; its network-enabled retry succeeded. No secrets or database data were changed.
- Step 3 remote verification complete: Supabase function metadata reports `fidel-webhook` **ACTIVE, version 3, `verify_jwt: false`**. Step 4 will probe without an Authorization header.
- Step 4 complete: all six unsigned probes with **no Authorization header** passed: GET -> 405 `method_not_allowed`; POST `{}` without query and with `?event=bogus` -> 404 `unconfigured_webhook_route`; POST `{}` to each of `auth`, `clearing`, `refund` -> **401 `invalid_signature`**. All configured selectors now reach signature verification. No misconfiguration investigation or fallback is needed. This does not establish the real Fidel signing contract. Step 5 now requires the product owner to create one transaction in Fidel Playground Test mode, using the test card and test Location; no fixtures/refunds.
- Step 5 preparation: asked the product owner to create that one genuine Test-mode transaction. A read-only aggregate query confirmed the pre-delivery baseline: `fidel_webhook_events = 0`, `business_fidel_locations = 0`, `linked_cards = 0`, `fidel_transactions = 0`. The expected first auth result is therefore `unknown_merchant`, with one auth event ledger row. No SQL writes were run. Genuine delivery and payload-shape comparison remain pending.
- Coordination updated: `IMPLEMENTATION_TIMELINE.md` now records version 3, the passing tests/probes and the genuine-delivery gate. Browser inspection initially failed during sandbox startup, then recovered after one reset. Fidel Playground is accessible in Test mode; the product owner is completing the creation flow. Codex has not submitted or edited that flow.
- Step 5 received genuine transaction evidence: the owner created one Playground test transaction (creation API HTTP 201, which is not itself the webhook status). A read-only ledger query now shows exactly one `transaction.auth` row, transaction ID ending `ecb9`, received at `2026-09-23 16:39:09.450638+00`. Delivery-log HTTP status and `unknown_merchant` outcome are being checked separately. No raw payload, card numbers or full IDs were copied into project files.
- Step 6 complete: inspected the **genuine Fidel delivery log** in Test mode. The single `transaction.auth` delivery is marked **Succeeded**. Its payload is a **bare transaction object**, unlike the Playground creation response's `items` envelope. Extracted only field names/types and ID suffixes; no values for card numbers, auth codes, identifiers or headers were emitted or saved.

### Genuine auth payload schema (delivery log, transaction ...ecb9)

| Field paths | Observed types |
|---|---|
| `id`, `programId`, `accountId`, `programType`, `authCode`, `created`, `updated`, `datetime`, `currency` | string |
| `amount` | number |
| `auth`, `cleared` | boolean |
| `wallet`, `cardPresent` | null |
| `card` | object |
| `card.id`, `card.firstNumbers`, `card.lastNumbers`, `card.scheme` | string (card-number values omitted) |
| `location` | object |
| `location.id`, `location.address`, `location.city`, `location.countryCode`, `location.timezone`, `location.postcode` | string |
| `location.metadata`, `location.state`, `location.geolocation` | null |
| `brand` | object |
| `brand.id`, `brand.name`, `brand.logoURL` | string |
| `brand.metadata` | null |
| `identifiers` | object |
| `identifiers.MID`, `identifiers.visaAuthCode` | string (values omitted) |
| `identifiers.mastercardTransactionSequenceNumber`, `identifiers.mastercardAuthCode`, `identifiers.mastercardRefNumber` | null |

ID suffixes only: transaction `ecb9`, program `0b95`, account `f95e`, card `a8c6`, location `4944`, brand `5efc`.

Comparison with unchanged `transaction.ts`: all required strings and nested IDs are present, `currency` satisfies GBP, amount is a nonnegative number, `auth` satisfies true, and `cleared` is boolean. Neither `event` nor `originalTransactionId` is present, as expected for this auth. The event comes from the configured signed route; `accountId` remains extra metadata, not card identity. No auth payload-contract mismatch found. This does not verify clearing/refund shapes or refund correlation.

- Step 5 verification complete: Fidel's delivery page marks the single auth **Succeeded**. Supabase gateway logs for `2026-09-23T16:39:00Z`–`16:40:00Z` show exactly **one POST, HTTP 200, version 3** on the auth selector; function logs contain exactly one `fidel-webhook reconciliation required unknown_merchant`. Read-only final counts: auth events **1**, other events **0**, merchant mappings **0**, linked cards **0**, Fidel purchase records **0**. Thus this genuine auth verified through the unchanged signature helper using the configured URL and secret, and was acknowledged without awarding spend. No header values, secrets or raw bodies were queried from logs.
- Step 7 stop reached: no fixtures, refunds, replay requests, secret changes, dashboard configuration changes or direct database writes. The sole new ledger row came from the owner's genuine Test-mode webhook. Claude must review the implementation and this first signed auth before further work. No product-owner input remains for this review; clearing/refund signature contracts and refund correlation remain unverified.
- Final coordination complete: handoff status/next action and `IMPLEMENTATION_TIMELINE.md` now reflect the successful first auth and Claude review gate. Replaced this run's Codex task with one current Claude prompt at the end. No code changed after the passing tests/deployment; all unrelated workspace edits remain untouched.

## Route-selection and first-auth review (2026-09-23) — Claude: APPROVED, no defects; auth contract verified, clearing/refund next

### Item 1: code, tests and deployment — APPROVED

- **`route.ts`:** byte-for-byte identical to the reviewed reference (mechanical `diff`
  against Claude's tested prototype).
- **`index.ts`:** the old local `configuredRoute` is gone.
  `routeFor: (requestUrl) => configuredRoute(requestUrl, (name) => Deno.env.get(name))`
  is the only wiring change. Secrets are still read per request and never logged.
- **`handler.ts`:** the only change is the 3-line comment above `handleFidelWebhook`,
  which now describes selector routing accurately. `signature.ts`, `transaction.ts` and
  `amount.ts` are unchanged (mechanical `diff` against the pre-change copies).
- **`route.test.mjs` (6 tests):** they cover everything the task required, plus four
  extras:
  - `?event` with no value, and a repeated identical `?event=auth&event=auth`;
  - an assertion that invalid selectors never read configuration;
  - an upper-case host and a `:443` port;
  - an assertion that the diagnostic log carries only the prefix.

  The shared-secret variant shows that the URL alone prevents cross-route replay. Every
  test is synthetic and honestly labelled so.
- **Tests, run by Claude:** `node --test "supabase/functions/fidel-webhook/*.test.mjs"`
  → **16/16 pass**, 0 fail, 0 skipped.
- **Deployment, checked by Claude through the Supabase API:** `fidel-webhook` is
  **ACTIVE, version 3, `verify_jwt: false`**, updated 2026-09-23 16:36:14 UTC. The
  deployed `index.ts`, `route.ts` and `handler.ts` were read and match the local files.
  The three helpers are unchanged from version 2.

### Item 2: unsigned probes — CONFIRMED

- **Codex's six probes:** function logs show exactly **six version-3 invocations** at
  16:37:05–16:37:07 UTC, after the 16:36:14 deploy, and no `route misconfigured` error
  at any point. Their per-request status rows had not reached the gateway logs when
  checked, so their status codes rest on Codex's record plus the re-run below.
- **Claude's re-run** (17:06 UTC, no Authorization header, body `{}`; each rejected
  before any database access):
  - `GET` → 405 `method_not_allowed`;
  - `POST` with no query → 404 `unconfigured_webhook_route`;
  - `POST ?event=bogus` → 404 `unconfigured_webhook_route`;
  - `POST ?event=auth`, `?event=clearing` and `?event=refund` → **401
    `invalid_signature`** each.
- **Query string reaches the runtime:** the gateway logs now also show Codex's earlier
  version-2 probes (07:50 UTC) with `request.search` of `?event=auth`, `?event=clearing`
  and `?event=refund`, each answered 404. The fallback design is not needed.
- **What this proves:** all three configured `_URL` values pass the canonical check,
  and each route reaches signature verification. The unsigned probes don't prove Fidel's
  signing contract for clearing or refund.

### Item 3: first genuine Fidel Test-mode auth — CONFIRMED; the auth signing contract is verified

- **Gateway log:** exactly one request from Fidel's sender (user agent `axios/1.19.0`,
  1114-byte body): `POST ?event=auth` → **HTTP 200**, **version 3**, at 16:39:09.554 UTC.
  Nothing else reached the function between the probes and this review.
- **Function log:** a single warning in that same execution: `fidel-webhook reconciliation
  required unknown_merchant`. There is no `route misconfigured`, `malformed payload` or
  `rpc failed` line.
- **Database (read-only, Claude):** `fidel_webhook_events` holds 1 row in total:
  `transaction.auth`, transaction ending `ecb9`, a 36-character message id, received
  16:39:09.450638 UTC. The following are all **0**: `fidel_transactions`,
  `business_fidel_locations`, `linked_cards`, `transactions` of type `spend` or with
  a `fidel:` note, and memberships with nonzero `reward_progress_pence`.
- **Live RPC body re-read:** on the `unknown_merchant` path, the event-ledger insert is
  the only write. Merchant lookup happens before any card, membership, purchase or spend
  step, so nothing was awarded.
- **What this proves, because a 200 can't come from any other code path:**
  - Fidel signs `raw body + registered URL including ?event=auth + x-fidel-timestamp`
    with the auth webhook's own key, using the double HMAC, exactly as `signature.ts`
    implements it.
  - `x-fidel-timestamp` is a 13-digit millisecond value that arrived within the 5-minute
    window.
  - `fidel-message-id` is present.
  - The body is a bare transaction object that `transaction.ts` accepts.
  - The service-role RPC call works through the real HTTP path.
- **Not proven by this:**
  - the clearing and refund keys, and that Fidel signs those URLs the same way (their
    unsigned probes reached verification only);
  - clearing and refund payload shapes;
  - whether a clearing reuses the auth's `id` (the RPC's clearing path assumes it
    does);
  - what a refund's `originalTransactionId` points to;
  - the negative clearing Fidel emits alongside a refund;
  - retry behaviour (`fidel-attempt-number`).
- **Accepted consequence, not a defect:** the `ecb9` auth is now ledgered as
  `unknown_merchant`, so a later merchant mapping never re-credits it. That matches the
  reconciliation design. Fixture tests must use a new transaction.

### Item 4: redacted auth schema vs `transaction.ts` — no mismatch

| `transaction.ts` requires | Genuine auth delivery (`...ecb9`) | Result |
|---|---|---|
| top-level object | bare transaction object (not the Playground response's `items` envelope) | pass; confirms ARCH_PLAN §4.1 |
| `id`, `programId`: non-empty string ≤ 200 | string | pass |
| `currency === "GBP"` | string, accepted | pass |
| `card` object, `card.id` string | object, string | pass; `card.id` is the identity key |
| `location` object, `location.id` string | object, string | pass; merchant key with `programId` |
| `amount`: finite JSON number, ≤ 2 dp, ≥ 0 for auth | number, accepted | pass (a 200 needs the exact-token parse to succeed) |
| `auth === true` for auth, `cleared` boolean | booleans, accepted | pass |
| `originalTransactionId`: absent, null or string | absent | pass (expected for an auth) |

- **Extra fields are ignored safely:** `accountId`, `programType`, `authCode`,
  `created`, `updated`, `datetime`, `wallet`, `cardPresent`, `card.firstNumbers`,
  `card.lastNumbers`, `card.scheme`, the other `location.*` fields, `brand` and
  `identifiers`. `accountId` stays audit-only, per ARCH_PLAN §2.
- **Documented but not in this auth:** `approvalCode`, `descriptor`,
  `merchantCategoryCode`, `offer` and `refundTransactionId`. The parser needs none of
  them. Fidel's docs say `refundTransactionId` is set on the original once it is
  refunded.
- **Useful for later work:**
  - `brand.id` is present (suffix `5efc`). It feeds the §6a Brands-API research.
  - `identifiers.MID` is present as a string. It can fill
    `business_fidel_locations.fidel_mid` at enrollment; the RPC doesn't use it.
- **Verified vs still unverified:**

| Contract | Status |
|---|---|
| Auth signature: double HMAC over body + registered URL **including `?event=auth`** + ms timestamp, auth webhook's key | **Verified** (genuine Test-mode delivery) |
| Auth payload shape and parser acceptance | **Verified** |
| Clearing and refund keys, and that their signed URL includes the query | **Unverified**: routes reach verification, but no genuine signed delivery yet |
| Clearing payload: does it reuse the auth `id`? What are `auth` and `cleared`? | **Unverified**. If the id differs, positive clearings return `unresolved_clearing` (200, status tracking only; spend is credited at auth, so no money moves). |
| Refund payload: negative amount, `auth=false`, `cleared` value | **Unverified**. A `cleared` value other than `true` on the refund's negative *clearing* would be parsed as malformed (400), and Fidel would retry and fail. |
| Refund correlation: presence and target of `originalTransactionId` | **Unverified**, and the only one with money at stake. Without it every refund is `unresolved_refund` and no clawback happens. |
| Retries (`fidel-attempt-number`, 3 attempts) | **Unverified**; not needed before the fixture stage |

- **How Fidel's docs say to produce these in Test mode:**
  - Clearing: Dashboard → Transactions → ⋯ on the transaction → **Clear**, which fires
    `transaction.clearing`.
  - Refund: Create Test Transaction with a **negative amount**. The request has no
    `originalTransactionId` parameter, so Test mode may never produce a matched refund.
  - A refund emits both `transaction.clearing` and `transaction.refund` with
    `auth=false` and a negative amount.

  Sources: docs.fidelapi.com/docs/select/transactions and
  reference.fidel.uk/reference/create-transaction-test, both read 2026-09-23.

### Item 5: verdict — APPROVED, no defects

- **The route-selection fix is approved as deployed** (version 3). The routing and
  security contract holds, the tests are adequate, and the first genuine auth verified
  end to end without awarding anything.
- **Only the auth contract is verified.** Clearing and refund signatures, their payload
  shapes, clearing id reuse and refund correlation stay unverified until genuine Test-mode
  deliveries of each (next task).
- **Optional hardening, pre-existing and not blocking:** `handler.ts` reads the whole
  body before the 1 MB check in `transaction.ts`. Before the pilot, consider rejecting a
  `content-length` above 1,000,000 before `request.text()`. This is not part of the next
  task.
- **Next, in order:**
  1. Codex: the clearing and refund contract pass below (no fixtures; everything ends
     `unknown_merchant`).
  2. Claude reviews it.
  3. Claude sets the dedicated-test-account fixture task (auth → spend, clearing,
     refund → clawback).
- **Product-owner action (can run now, in parallel):** ask Fidel two things. (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end) Do live
  refunds carry `originalTransactionId`, and how is it matched? Can Test mode produce a
  matched refund? Test mode alone may never answer this.

## Clearing/refund contract review (2026-09-23, 17:25 UTC) — Claude: PARTIAL; clearing verified, refund not yet delivered, fixture stage NOT started

Codex had recorded no evidence for this pass when Claude reviewed it. Claude checked the
live logs and database directly (read-only):
- **Genuine clearing, verified.** One request from Fidel's sender (`axios/1.19.0`):
  `POST ?event=clearing` → **HTTP 200** at 17:19:37.808 UTC. The same execution logged
  `reconciliation required unknown_merchant`. A 200 is only possible after the signature
  verifies, so Fidel signs clearing over the **clearing** URL (including
  `?event=clearing`) with the **clearing** webhook's own key.
- **Clearing reuses the auth id.** The new ledger row is `transaction.clearing` with
  transaction id ending **`ecb9`**, the same as the auth, received 17:19:37.755 UTC. This
  matches the RPC's clearing path, which updates the purchase found by the auth's id. The
  `(fidel_transaction_id, event_type)` uniqueness allows both rows.
- **No refund delivery yet:** no `?event=refund` request and no refund or negative-clearing
  ledger row.
- **Counts:** `fidel_webhook_events` = 2 (auth `ecb9`, clearing `ecb9`). The following
  are all **0**: `fidel_transactions`, `business_fidel_locations`, `linked_cards`, spend
  or `fidel:` transactions, and memberships with nonzero `reward_progress_pence`.
  Nothing was awarded.
- **Still missing from Codex (needs the delivery log):**
  - the clearing payload's field names and types;
  - its `auth` and `cleared` booleans and amount sign;
  - the ⋯ menu option names, including whether a Refund option exists.
- **Still unverified:** the refund signature and key, the refund shape, the negative
  clearing's `cleared` value (the parser requires `true` for any clearing), and
  `originalTransactionId`.
- **No contract mismatch found so far.** Claude changed nothing: no secrets, settings,
  code, data, fixtures or replays.
- **The fixture stage is deliberately not issued yet.** Its refund → clawback test
  depends on the refund shape and correlation, which aren't known. Claude writes it once
  the refund evidence is reviewed.

## 2026-09-23 Claude: release rule revised — every shop spend-based, Fidel wherever it can work

- **Product owner decided:** replace the rule that every shop must have an Active Fidel
  Location at release. Every shop is still spend-based and still *submitted* to Fidel
  automatically. Card-linked earning switches on per shop once its Location is Active and
  real payments have been seen to match. Every other shop, including any SumUp, Square or
  Zettle shop Fidel can't isolate, earns through staff manual spend entry. No shop goes
  back to stamps.
- **Why:** Fidel's docs say payment-facilitator shops may share merchant IDs and that
  coverage is per shop and not guaranteed. Most small UK shops use these providers, so
  the old rule could have blocked the release indefinitely.
- **Files changed:**
  - ARCH_PLAN.md §0b: decision, item 4 cutover rule, consequences, card-linking knock-on;
  - ARCH_PLAN.md §6 item 9;
  - CARD_LINKING_PLAN.md: release-scope note;
  - IMPLEMENTATION_TIMELINE.md: milestone 8a.
  - No code or data changed.
- **New design requirements (for Claude's §6a and cutover design pass, not built yet):**
  - store and refresh each shop's Fidel Location status;
  - `card_linked_business_ids()` and the ⚡ badge count only Active Locations;
  - the cutover requires a threshold, Fidel submission and live manual spend entry, not
    an Active Location.
- **Product-owner action:** ask Fidel how they handle UK SumUp, Square and Zettle (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end)
  merchants: the share they can isolate to one shop, the time it takes, and what they
  need from the merchant. Keep the SumUp Solo for the live pilot.
- **The current Codex prompt below is unaffected** (finish the refund contract step).

## Clearing/refund contract review (2026-09-23, 17:40 UTC) — Claude: clearing APPROVED; refund not delivered by Test mode; fixture stage approved without the refund leg

Codex's evidence is in "Clearing/refund contract pass (2026-09-23) — Codex", which sits
mid-file (near line 852), not at the end. Claude re-checked the live logs and database
read-only.

**Clearing: verified and approved.**
- **Delivery:** exactly one delivery from Fidel's sender: `POST ?event=clearing` → HTTP
  200, version 3, 17:19:37 UTC, `unknown_merchant`.
- **Signing:** Fidel signs clearing over the clearing URL (including `?event=clearing`)
  with the clearing webhook's own key.
- **Ledger:** the row reuses the auth id `...ecb9`. The RPC's clearing path depends on
  that, so the assumption is now confirmed.
- **Payload:** positive amount, `auth=true`, `cleared=true`, no `originalTransactionId`.
  The field names and types match the verified auth schema. No parser mismatch.

**Refund: no webhook was ever attempted.**
- The negative Test-mode creation returned 201 and a refund-shaped transaction:
  - id `...513d`;
  - negative amount, `auth=false`, `cleared=true`;
  - `originalTransactionId` ending `...ecb9`.
- After the clearing, the function logs show **nothing at all**: no request, not even a
  rejected 401 or 404, and no function start. The ledger still holds only auth `ecb9`
  and clearing `ecb9`.
- All other counts are 0: `fidel_transactions`, `business_fidel_locations`,
  `linked_cards`, spend or `fidel:` transactions, and memberships with progress. Nothing
  was awarded.

**Diagnosis: most likely a Test-mode limitation, not our configuration. One provider-side
check is still owed.**
- **The negative clearing is the strongest evidence.** Fidel's docs say a refund emits a
  negative `transaction.clearing` *and* a `transaction.refund`. The clearing
  subscription was proven working 10 minutes earlier, yet it received nothing either.
  Something missing only on the refund subscription can't explain that.
- **Nothing reached our endpoint.** A wrong URL, key or route on our side still produces
  a logged 401 or 404, as the probes showed. So Fidel never sent anything; our side
  didn't reject it.
- **Fidel's docs only describe two Test-mode actions:** creating a transaction (which
  fires auth) and **Clear** (which fires clearing). They describe no Test-mode refund
  trigger. The Create Test Transaction API documents negative amounts but not which
  webhooks they fire.
- **Owed:** a read-only look at Fidel's Webhooks page, to confirm a `transaction.refund`
  webhook exists, is enabled, and points at `...fidel-webhook?event=refund`. Setup step A
  said to create it, but no one has recorded seeing it since. This needs the product
  owner's permission (Dashboard).

**Positive, but weaker, evidence on correlation.** The Test API's refund object
carries `originalTransactionId` = the auth id (`...ecb9`), which is also the clearing id.
That is exactly the id the RPC looks up in `fidel_transactions`, and its shape
(`auth=false`, negative, `cleared=true`) passes `transaction.ts`'s refund rules. But it is
an API response, not a signed delivery. It doesn't prove live refunds are delivered,
signed the same way, or always matched.

**Unresolved production risk, recorded here and in `IMPLEMENTATION_TIMELINE.md`.** If
live refunds arrive without `originalTransactionId`, arrive differently, or never arrive,
refunds won't claw back. A customer could keep reward progress from a refunded purchase
and redeem it. The refund RPC path is covered only by the focused disposable-PostgreSQL
test, not by a genuine delivery. Required before real shoppers:
1. **Product owner asks Fidel:** (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end)
   - Does Test mode ever emit `transaction.refund` or a negative clearing for a
     negative test transaction?
   - Do live refunds always send both webhooks, and when is `originalTransactionId`
     absent?
   - Must a program setting be enabled for refund webhooks?
2. **New pre-pilot gate:** one genuine **live** refund, a small real purchase and its
   refund (for example on the SumUp Solo once live), verified end to end. It must show a
   signed `?event=refund` delivery, the correlation, and the clawback. No real shopper
   links a card until this passes.
3. **Claude design item (not built):** a refund reconciliation backstop that
   periodically asks Fidel's Transactions API for refunds and flags any purchase with no
   matching refund event. It gets designed only if Fidel can't guarantee delivery and
   correlation.

**Fixture stage: approved now, without the refund leg.** Auth → spend and clearing don't
depend on refunds, and both contracts are genuinely verified. The refund leg stays on the
live gate above.

**Product-owner steps before Codex starts (only you can do these):**
- **A. Dedicated test shopper account.** In the shopper app, sign up with a test-only
  email that isn't a real customer. Join the test shop (B) from that account.
  - This account can't be deleted through "delete my account" until the card-linking
    deletion fix ships (CARD_LINKING_PLAN §3.4), so keep it as a permanent test account.
- **B. Dedicated test shop.** Either create a new shop named "Fidel Test Shop" in the
  retailer app, or name one existing test shop that has no real customers.
  - It will be switched to spend-based rewards with a £10.00 threshold.
- **C. Tell Codex** the shop's and account's display names (not passwords), and say "OK
  to run up to three Fidel Playground actions when Codex asks."
- **Optional, same visit:** open Fidel → Programs → The Loyalty Loop → Webhooks and tell
  Codex whether a `transaction.refund` webhook is listed, enabled, with the `?event=refund`
  URL. Look only; change nothing.

## Refund diagnosis revised (2026-09-23, 17:55 UTC) — Claude: likely a Fidel webhook configuration gap, not a Test-mode limitation

- **New information:** the product owner reports that Fidel's Test mode *does* send
  refund webhooks when a simulated test refund is processed. That withdraws the "most
  likely a Test-mode limitation" conclusion above.
- **Fidel's docs:** refunds are matched to the original by `cardId`, `locationId`,
  `merchantId`, `amount` and `datetime`. Our negative test transaction *was* matched
  (`originalTransactionId` ending `...ecb9`), so Fidel processed it as a refund, yet
  delivered nothing to us.
- **Leading hypotheses**, all on the Fidel side, all checkable read-only on the
  Webhooks page (Programs → The Loyalty Loop → Webhooks):
  1. no `transaction.refund` webhook exists (for example, it was never created, or it
     was deleted with the old `webhook.site` one);
  2. it was created for **`transaction.refund.qualified`** instead. Fidel lists both,
     and the `.qualified` one fires only for Fidel offers, which we don't use;
  3. it was created in the other mode. Fidel webhooks carry a `live` flag; ours must be
     a Test-mode webhook like the working auth and clearing ones;
  4. its URL isn't exactly `...fidel-webhook?event=refund`, or it's disabled.
- **What this doesn't explain:** Fidel's docs say a real refund also sends a negative
  `transaction.clearing`, and none arrived on the working clearing webhook. Test mode
  may send only `transaction.refund`. If the refund webhook turns out to be correctly
  configured, ask Fidel directly. (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end)
- **The negative-clearing parser rule is unaffected:** the parser needs `cleared=true`,
  and the test refund object had it.
- **Nothing about our code or secrets is implicated:** no request of any kind reached
  the function.
- **Next:** the product owner looks (read-only) at the Webhooks page and reports each
  webhook's event name, mode, URL and status. Claude then gives the exact fix. If the
  refund webhook is fixed or recreated, it gets a **new secret key**, and
  `FIDEL_WEBHOOK_REFUND_SECRET` must be updated to match. Then one fresh negative test
  transaction retests delivery. The fixture stage can go ahead in parallel; it doesn't
  depend on refunds.
- **The live-refund pre-pilot gate stays** until a genuine signed refund delivery is
  verified, either in Test mode now or live later.
- **Coordination:** the product owner has hit their ChatGPT (Codex) usage limit. Claude
  can carry out Codex's tasks in the meantime if the product owner asks.

## Webhook configuration check (2026-09-23, ~18:05 UTC) — Claude: refund webhook looks correct; secret keys exposed in chat, rotate

- **The product owner shared Fidel's Webhooks page.** Three webhooks exist, all on
  program "The Loyalty Loop", all created at the same time. Each has its own secret key
  (values deliberately **not** recorded here):
  - `transaction.refund` → `...fidel-webhook?event=refund`
  - `transaction.clearing` → `...fidel-webhook?event=clearing`
  - `transaction.auth` → `...fidel-webhook?event=auth`
- **Hypotheses 1, 2 and 4 are ruled out:** the webhook exists, the event is
  `transaction.refund` (not `.qualified`), and the URL is exactly right. The page
  doesn't show the mode. All three were created together, and auth and clearing fire in
  Test mode, so a mode mismatch is unlikely but not proven.
- **Still no request of any kind** reached the function after 17:21 UTC (checked
  ~18:05 UTC).
- **Revised conclusion:** configuration looks correct on both sides. So the open
  question is *how* Fidel's Test mode triggers a refund webhook. A negative Playground
  Create Transaction produced a matched refund record (`...513d` → `...ecb9`) but no
  delivery. **Product owner asks Fidel support:** (withdrawn 2026-09-23: the product owner can't contact Fidel; see "No Fidel contact" at the end) "A negative test transaction (id ending
  513d) was matched to transaction ending ecb9, but our registered `transaction.refund`
  webhook received nothing and no delivery was logged. How do we trigger a refund webhook
  in Test mode? Does it also send a negative `transaction.clearing`?"
- **Security: secret keys were pasted into the chat.** All three webhook keys appeared
  in a chat message. Anyone holding a key could sign fake events for that route. Today
  that affects only Test-mode events with no linked cards, so nothing can be awarded.
  - ~~**Required before the fixture stage links a card:** rotate all three.~~ (Declined by the product owner 2026-09-23; see "Test-mode key exposure: accepted" at the end.) In Fidel, delete
    and recreate each webhook with the same event and URL, then set the new keys in
    Supabase `FIDEL_WEBHOOK_AUTH_SECRET`, `..._CLEARING_SECRET` and `..._REFUND_SECRET`
    through the dashboard.
  - Then re-run the unsigned probes (each must be 401) and one Playground auth (must be
    200). Recreating the refund webhook also rules out any hidden fault on it.
  - Live-mode keys will be separate, and must never be pasted into chat.

## No Fidel contact (2026-09-23) — product-owner constraint; plans adjusted

- **Product owner:** they can't message Fidel, so no plan may depend on asking Fidel.
  Earlier "ask Fidel" actions in this file are marked withdrawn. ARCH_PLAN §0b,
  CARD_LINKING_PLAN U6 and IMPLEMENTATION_TIMELINE rows 5 and 8a are updated.
- **The refund question is answered by our own evidence instead:**
  1. ~~After the key rotation,~~ (no rotation, see below) the refund webhook gets **one** optional fresh negative
     Playground test transaction (product-owner approval required). If nothing arrives,
     treat Test mode as unable to deliver refunds for us, and stop trying.
  2. **Pre-pilot gate (unchanged):** one genuine live refund is verified end to end
     before any real shopper links a card.
  3. **The refund reconciliation backstop is now required, not optional.** It is a
     scheduled job that reads refunds from Fidel's Transactions API with our own key
     and flags any refund with no matching processed refund event. Claude designs it
     before the pilot. It flags only; it never claws back on its own guess.
- **SumUp, Square and Zettle matching:** measured per shop in the live pilot. Manual
  spend entry already covers any shop that doesn't match.
- **Pricing:** unknown, and not something we can plan around.

## Test-mode key exposure: accepted (2026-09-23) — product-owner decision

- **Decision:** the product owner won't rotate the three Test-mode webhook keys that
  were pasted into chat. Recorded as an accepted risk.
- **Why the risk is low:**
  - The keys only authenticate *Test-mode* routes.
  - A forged event awards spend only when its full Fidel card id and Location id match a
    linked card and a mapped shop. After the fixture stage, that means only the dedicated
    test account at the test shop, and those full ids aren't in chat (suffixes only).
  - Nothing real can be earned or redeemed.
- **Hard go-live requirement (added to the pre-pilot gates):** before any real shopper
  links a card, all three `FIDEL_WEBHOOK_*_SECRET` values must be replaced with the
  **Live-mode** webhooks' keys, and the `_URL` values checked. Once that swap is made,
  the exposed Test keys stop being accepted, so the exposure ends at go-live
  automatically. Live keys must never be pasted into chat.
- **Watch until then:** any fixture-stage anomaly, such as a transaction for the test
  account that no one created in the Playground, means stop and treat it as a forged
  event.
- **The optional refund retest** (one fresh negative test transaction) no longer depends
  on rotation. It is low value, because the configuration is unchanged. The live-refund
  gate and the reconciliation backstop remain the real safeguards.
- **Unaffected:** the fixture-stage prompt below still stands.

## CL-2 card-linking migration (2026-09-23) — Claude, acting as implementer while Codex is unavailable: written and tested, NOT applied

**Role note:** the product owner asked Claude to start building card linking while
Codex (ChatGPT) is out of usage. Claude is implementer and reviewer for this item, so
it had no independent second review. Codex should review it when back.

**Gate decision:** CL-2 went ahead before the CL-1 phone spike. Its design holds
whatever CL-1 finds:
- the partial unique index covers both answers to U3 (same or new `card.id` after
  re-link);
- the claim RPC refuses cross-user cards whatever U4 shows;
- U1, U2 and U7 affect only the app and Edge Functions.

The migration is **not pushed**; applying it needs the product owner's approval.

**File:** `supabase/migrations/20260923182000_fidel_card_linking.sql` (sha256
`461d97c0…3276`). It is additive; no applied migration is edited.
- **`fidel_link_identities`:** a per-user 32-hex secret metadata id. RLS on, no client
  access. Created by the service-role RPC `fidel_link_identity(user_id)`.
- **`linked_cards`:**
  - the global unique on `fidel_card_id` becomes a partial unique index (active rows
    only);
  - new columns `fidel_deleted_at`, `fidel_delete_error` and `unlink_reason`;
  - new checks: a reason must be present exactly when unlinked, and a card deleted at
    Fidel must also be unlinked;
  - a pending-delete index.
- **Service-role RPCs:**
  - `claim_linked_card`: locks the identity row; 5-card cap; idempotent
    `already_linked`; `already_linked_elsewhere`, including a caught unique-violation
    race; `no_identity`; argument validation.
  - `unlink_linked_card`: ownership-checked; stops earning in the same commit.
  - `mark_fidel_card_deleted`.
  - `fidel_cards_pending_delete`: **skips an unlinked row whose card has since been
    re-linked**, because deleting it at Fidel would silently break the new link. This
    is a new safety rule, not in the plan text.
- **`business_fidel_locations`** gains `fidel_status` (`idle`, `syncing`, `active`,
  `not_found`) and `fidel_status_checked_at`. **Refinement of CARD_LINKING_PLAN §3.6 and
  §4:** the ⚡ list (`card_linked_business_ids()`), the P5 rule and
  `customer_card_link_status` count only **active** Locations, not any Location row.
  Otherwise, at a still-syncing shop, staff choosing "they used their linked card" would
  leave the customer with no credit, because Fidel can't send anything yet.
- **P5 (§3.6):**
  - new columns `transactions.manual_payment_method` (`cash`, `unlinked_card`) and
    `recorded_by`;
  - a `BEFORE INSERT` trigger with a per-customer, per-shop advisory lock, the London-day
    limit of 3 and the 30-minute gap;
  - the trigger forces `created_at := now()` on the limited path, so a client can't
    backdate around the limits;
  - admin and service role are exempt; refusals raise
    `linked_customer_payment_method_required`, `manual_daily_limit_reached` or
    `manual_too_soon` (with an ISO next-allowed time in DETAIL);
  - `customer_card_link_status(customer, business)` is owner, active staff or admin
    only, and returns `{linked, manualToday, nextAllowedAt}`.
- **Privileges:** the five RPCs are service_role only; `card_linked_business_ids()` and
  `customer_card_link_status()` are authenticated only; the helpers and the trigger
  function have no client execute.

**Checks actually run:**
- **New focused test** `apps/api/test/integration/fidel-card-linking.test.mjs`, on
  disposable PostgreSQL with a minimal public-schema fixture plus every Fidel migration
  (not a full-history replay): **1/1 pass**. It covers:
  - the privilege matrix;
  - identity creation, stability and denial;
  - claims: no identity, claimed, idempotent, elsewhere, invalid scheme and last-4;
  - clients can read their own cards but can't insert or update them;
  - **6 concurrent claims leave exactly 5**; two users racing for one card leave one
    winner;
  - unlink ownership and re-unlink;
  - pending delete excludes a re-linked card; mark-deleted error and success paths;
  - the state check;
  - the ⚡ list shows only active shops, and anon is denied;
  - London day start across both 2026-10-25 and 2027-03-28 clock changes, plus the next
    day across a 25-hour day;
  - P5: method required; inserter recorded; backdating ignored; too soon at +0 and +29
    minutes; allowed at +30 minutes 1 second; 3 today refuses a 4th; yesterday doesn't
    count;
  - **two concurrent staff entries: the second waits, then is refused**;
  - exemptions: admin, service role, unlinked customer, syncing shop;
  - status-RPC access control.
- **Mutation check:** removing the advisory lock makes the concurrency assertion fail
  (the second entry is inserted). The migration was restored byte-identical.
- **Existing focused Fidel test**, which now also loads this migration: **1/1 pass**.
- **Live compatibility dry run:** the tables, columns, constraints, index, helper,
  status RPC and trigger were executed on the live project inside one transaction that
  **aborted itself**. That confirmed the live `has_role(uuid, app_role)` resolution, the
  staff helpers and the constraint name. The service-role RPCs and grants were omitted
  for length; they touch only this migration's objects and the fixture test covered them.
  First, a probe proved this tool runs multi-statement queries atomically. Afterwards,
  the live schema was confirmed unchanged: no new table, column or trigger, and the old
  constraint still present.

**A CL-1 finding from source, not a device:** on iOS, `Fidel.start()` presents from
`UIApplication.shared.delegate.window.rootViewController`, not the top-most controller.
If our Your-account `Sheet` (an RN `Modal`) is open, Fidel's screen almost certainly
won't appear. **CL-4 must close the sheet, run Fidel, then reopen it on Linked cards**
(the plan's §5.7 fallback becomes the design). The spike still confirms this on a
device.

**Not done or open:**
- the migration is not applied (needs product-owner approval);
- CL-1 needs the product owner: test `FIDEL_SDK_KEY` and `FIDEL_API_KEY` set as Supabase
  secrets (never in chat), plus approval of a native EAS build;
- CL-3, CL-4 and CL-5 aren't started;
- the §6a enrollment design must populate `fidel_status`.

## CL-2 applied to the live project (2026-09-23, ~20:10 UTC) — Claude, with product-owner approval

- **Push:**
  - `supabase db push --dry-run --linked` listed only
    `20260923182000_fidel_card_linking.sql`;
  - `supabase db push --linked` applied it, with no seeds or roles;
  - the file's hash was unchanged (`461d97c0…`).
- **Live checks (read-only):**
  - 55 migrations, and the latest is `20260923182000`;
  - the `fidel_link_identities` table and the P5 trigger exist;
  - EXECUTE: `card_linked_business_ids` and `customer_card_link_status` are available to
    authenticated (plus service_role). Every other new function is service_role only,
    with no anon access anywhere;
  - `authenticated` can't read `fidel_link_identities`;
  - existing data untouched: 27 transactions, 0 linked cards, 2 webhook events.
- **Security advisors:** the only new items are expected.
  - `fidel_link_identities` has RLS on and no policy (INFO, intentional: server-only);
  - the two client-facing definer functions are executable by authenticated
    (WARN, intentional).
  - Pre-existing findings are unchanged.
- **Behaviour change today:** none. No Location has `fidel_status = 'active'`, and no
  card is linked.

## CL-3 card-linking Edge Functions (2026-09-23, ~20:40 UTC) — Claude implementing: built, tested, deployed, inert

**Files:**
- `supabase/functions/_shared/fidel-cards.ts`: the core, with Fidel HTTP and the
  database injected;
- `_shared/fidel-card-http.ts`: auth from the verified JWT only, the DB adapter and
  error mapping;
- entry points `fidel-card-session`, `fidel-card-claim`, `fidel-card-unlink` and
  `fidel-card-delete-sweep` (all `verify_jwt` default true);
- `delete-my-account` updated.

**Behaviour, following CARD_LINKING_PLAN §3.3–§3.4:**
- **Session:** returns `{enabled:false}` unless `FIDEL_CARD_LINKING_ENABLED=true`,
  **or the caller is an admin** (a deviation: it lets the product owner test while the
  kill switch stays off).
  - At 5 cards: no SDK key and no metadata id.
  - Otherwise: SDK key, program id, the metadata id from `fidel_link_identity`, the
    consent text (the site's real `www.the-loyalty-loop.com/legal/...` PDFs) and display
    cards.
- **Claim:** lists `GET /v1/cards/metadata/{metadataId}` (follows `last` pagination, at
  most 10 pages).
  - Accepts only cards whose `metadata.id`, `programId` and `live` match.
  - A client `cardId` only narrows the choice, and the client's own card fields are
    ignored.
  - At `limit_reached` it deletes the card at Fidel; `already_linked_elsewhere` isn't
    deleted.
  - It returns display fields only: no Fidel ids.
  - It works with the kill switch off, so a card enrolled before a switch-off can still
    be recovered.
- **Unlink:** calls the RPC first, so earning stops, then `DELETE /v1/cards/{id}`. A
  404 counts as deleted; a failure is recorded for the sweep.
- **Sweep:** refuses any caller whose bearer isn't the service-role key. It retries up
  to 50 rows and logs an `ALERT` for rows stuck over 24 hours.
  - **Not scheduled yet:** the pg_cron job with the service-role key from Vault is still
    to do. It isn't needed until cards exist.
- **Environment:** set by key prefixes. The API key must start `sk_test_` or `sk_live_`,
  the SDK key `pk_test_` or `pk_live_`, and the two must agree; otherwise the
  configuration counts as missing.
  - `[assumption]` Fidel SDK keys use the `pk_` prefix. If not, the session reports
    disabled; CL-1 confirms.
- **delete-my-account:**
  - before the existing table loop, it deletes at Fidel every linked card not already
    deleted;
  - if any delete fails, it stops with "We couldn't finish removing your linked cards…"
    and keeps the account;
  - it then deletes `fidel_transactions`, then `linked_cards`.
  - With no cards, nothing changes; no Fidel configuration is needed.

**Checks actually run:**
- **Tests:** `node --test supabase/functions/_shared/fidel-cards.test.mjs` passes
  **16/16** against a fake Fidel and fake DB. They cover:
  - config prefixes;
  - kill switch, admin tester and limit;
  - a forged card id not stored;
  - wrong program, environment or metadata filtered out;
  - Fidel's own fields used and no Fidel ids returned;
  - cap delete; elsewhere not deleted; pagination recovery;
  - 400, 503 and 502 errors;
  - unlink order and Fidel failure, 404 and ownership;
  - sweep counts and alert;
  - account deletion fails closed;
  - **no key in any log line**.
- **Webhook suites:** still 16/16, so 32/32 in total.
- **Type check:** `deno check` (run on a scratch copy) passes for all five new or
  changed functions.
  - **Pre-existing, not introduced here:** `fidel-webhook/index.ts` fails a type check,
    because supabase-js's `rpc()` builder isn't assignable to `FidelRpcClient`. It is
    type-only, since the deployed function works (verified by the genuine auth and
    clearing deliveries). It's a small cleanup for later.
- **Before deploying:** the live `delete-my-account` v14 source matched the local file
  exactly, so the redeploy ships only this change.
- **Deploy:** `supabase functions deploy … --use-api` succeeded for all five.
- **Smoke tests:**
  - with no auth, every function returns 401 at the gateway;
  - with the anon key, the three card functions return `401 not_authenticated`, the
    sweep returns `403 forbidden`, and delete-my-account returns
    `400 Not authenticated` (unchanged).
  - No Fidel keys are set yet, so nothing can link.

**Next:**
- **Product owner:** set `FIDEL_API_KEY` and `FIDEL_SDK_KEY` (test) and
  `FIDEL_PROGRAM_ID` in Supabase secrets. Leave `FIDEL_CARD_LINKING_ENABLED` unset.
  Admins can test.
- **Claude:** CL-4 app UI, plus the Android JitPack config; then ask before a native
  build.
- **Still owed:** the sweep's cron schedule; Codex review of CL-2 and CL-3.

## Fidel card-linking test secrets set (2026-09-23, 22:11 UTC)

- **Loaded:** `FIDEL_API_KEY`, `FIDEL_SDK_KEY` and `FIDEL_PROGRAM_ID` (Test mode) with
  `supabase secrets set --env-file`, from a file the product owner created outside the
  repo. Values are never recorded here. `supabase secrets list` shows all three names.
  `FIDEL_CARD_LINKING_ENABLED` is left unset, so only admins can link.
- **Prefixes confirmed:** the key prefixes match the code's `sk_test_` / `pk_test_`
  check, which resolves the `pk_` assumption in the CL-3 entry. The program id matches
  the test program in CARD_LINKING_PLAN §6.
- **Exposure, same accepted risk as the webhook keys:** attaching the file with @ put
  its contents into the chat transcript. These are Test-mode keys and nothing real can
  be earned with them. They must be replaced by the Live keys at go-live, which is
  already a pre-pilot requirement. The product owner should delete the local file.

## CL-4 shopper app card-linking UI (2026-09-23) — Claude implementing: code complete, NOT built or run on a device

**Files:**
- `apps/shopper/package.json`: `fidel-react-native` 3.2.1 (exact) and
  `expo-build-properties` ~1.0.10, installed with `expo install`;
- `apps/shopper/app.config.js`: `expo-build-properties` with
  `android.extraMavenRepos: ['https://jitpack.io']`, needed by Fidel's Android SDK;
- new `apps/shopper/src/card-linking.ts`;
- `apps/shopper/App.tsx` (+~200 lines).

**What it does (CARD_LINKING_PLAN §5):**
- **Your account → "Payment cards" → Linked cards,** shown only when the server session
  says enabled (today: admin testers only):
  - the explainer;
  - the card list with Remove, which confirms, removes optimistically and restores on
    failure;
  - a "Link a card" button with Preparing… and Checking your card… states;
  - limit copy, the "front-of-card number, not a virtual number" note and the Fidel
    notice.
  - Opening the view runs claim recovery.
- **Link flow:** session → Fidel's native screen, with our secret metadata id in
  `metaData.id` and UK only, Visa, Mastercard and Amex → claim, with 2 retries and
  backoff. The error mapping follows §5.3; Fidel's raw messages are never shown.
  Success shows the existing `SuccessCheck` and haptic, then a "Card linked" alert.
- **iOS:** because Fidel presents from the root view controller (U7, from source), the
  account sheet closes before `Fidel.start()` and reopens on Linked cards afterwards,
  pausing before the success modal. Android starts Fidel's own Activity above the sheet.
- **Shop detail:** for shops in `card_linked_business_ids()` (active Fidel Locations
  only), show the "Earn automatically here" card with a Link button if the user has no
  cards, otherwise the ⚡ chip.
- **Delete-account copy** now mentions linked (payment) cards.
- **OTA safety:** runtime policy is `appVersion` at 1.0.0, so JS updates reach existing
  store builds that lack the native module. `fidel-react-native` is therefore
  `require`d lazily, only when `NativeModules.NativeFidelBridge` exists. Otherwise every
  card UI stays hidden and Fidel's module is never evaluated.

**Checks actually run:**
- `npx tsc --noEmit` passes, covering `App.tsx` and `card-linking.ts`;
- `npx expo config --type prebuild` resolves with the JitPack repo plugin;
- `npx expo export --platform android --platform ios` bundles both platforms (1592
  modules each);
- the Android and iOS SDK sources were read to confirm the result keys (`type`,
  `enrollmentResult`, `error`, `subtype`) and the constant names.
- **Not run:** no native build, no device run, no screenshots. U1 (the SDK under RN 0.81
  New Architecture), U7 on a device, and U2 against real Fidel are still unverified.

**Side effect to watch in the next native build:** `npm install` pruned two stale
lockfile entries that nested `react-native-worklets` 0.5.1 under `apps/shopper` and
`apps/retailer`. Both apps' `package.json` already require ~0.8.3; locally both resolve
0.8.3; `react-native-reanimated` 4.1.7 declares support for worklets 0.5–0.8. EAS builds
may previously have used the nested 0.5.1, so the next shopper native build moves to
0.8.3. That is within the supported range, but check animations on the test build.

**Not done yet (in order):**
1. **Product owner:** approve a native test build. It can't ship OTA. An Android
   internal APK (`preview` profile) is suggested first, then iOS via TestFlight.
2. **Claude/Codex:** on the device, link Fidel's test Visa `4444000000004***` and a test
   Amex. Record the result and error shapes, `cardAlreadyExists`, cancel, remove and
   re-link. This covers the CL-1 checks.
3. **Not built:** the one-time post-sign-in intro sheet (P1/P6), the ⚡ chip on shop
   list cards, the retailer "how did they pay?" sheet (CL-5), and the sweep's cron
   schedule.
4. Codex review of CL-2, CL-3 and CL-4.

## Android test build for card linking (2026-09-23) — Claude, product owner approved

- **Build:** `eas build --platform android --profile preview` (an internal APK, not
  submitted to any store). Build id `6846ee33-4cfc-4827-a498-fad68e66e167`, logs at
  https://expo.dev/accounts/the-loyalty-loop/projects/localoop-rewards/builds/6846ee33-4cfc-4827-a498-fad68e66e167
- **Configuration:** the `preview` EAS environment supplied the four `EXPO_PUBLIC_*`
  variables (names only listed); remote Android credentials were used; EAS created the
  update channel and branch `preview`.
- **Status: FINISHED** at 22:43 UTC. APK:
  https://expo.dev/artifacts/eas/IQH1pB633gYWuSb5UGXZmvAztRIPV4C7TVsYp01C29Q.apk
- **What that proves:** the Android native build compiles and links with
  `fidel-react-native` 3.2.1 under RN 0.81 New Architecture, and the JitPack repository
  config works. It does **not** prove runtime behaviour (U1 at runtime, the result
  shapes, U2): the product owner's device test is next.

## CL-5 retailer "how did they pay?" sheet (2026-09-23) — Claude implementing: code complete, NOT shipped

**File:** `apps/retailer/App.tsx` (`StampsScreen` plus a helper), JS only.
- **Status call:** after a customer is found in stamp mode, the app calls
  `customer_card_link_status(customer, business)`.
  - If `linked` (the customer has an active card **and** this shop's Location is
    active), tapping **Award** opens a sheet first, following CARD_LINKING_PLAN §3.6:
    "This customer has a linked card / If they paid with it … nothing to do / How did
    they pay? **[Cash] [A different card] [They used their linked card]**".
  - Cash and different card insert the stamp with `manual_payment_method` `cash` or
    `unlinked_card`; "linked card" closes without inserting.
  - The sheet shows "N of 3 manual entries used today" when above 0.
  - If the status call fails, the old behaviour applies (no question); the database
    still enforces the rule.
- **Refusal copy:** the database refusals map to friendly alerts, and raw errors are
  never shown.
  - `manual_daily_limit_reached` → "This customer has had 3 manual entries here today."
  - `manual_too_soon` → "The next manual entry for this customer is allowed at HH:MM"
    (London time, from the error DETAIL).
  - `linked_customer_payment_method_required` → "Choose how the customer paid", and the
    sheet reopens (covers a card linked after the scan).
- **Fix while there:** the Award button now calls `award()` without passing the press
  event as an argument.
- **Checks:**
  - `npx tsc --noEmit` passes (retailer);
  - `npx expo export --platform android` bundles (3126 modules);
  - the refusal codes were already covered by the CL-2 database test.
  - No device run.
- **Shipping:** it's JS only, so an `eas update` for the retailer app delivers it, with no
  native build. It isn't urgent: nothing changes until a shop's Fidel Location is
  `active`. **It must be live before the first shop is activated.** Not published; that
  needs product-owner approval.
- **Still not built:** manual spend entry in £ (design pending, ARCH_PLAN §0b item 2).
  The same payment question must be reused there.

## Card-linking tester allowlist (2026-09-23) — Claude

- **Problem:** the shopper app's `isShopper` gate rejects any account holding
  `business_owner`, `staff` or `brand_head`. Both existing admin accounts are also
  `business_owner`, so the "admins can test" route can't work in the shopper app.
- **Rejected:** granting `admin` to a new test customer account, which would give it
  full platform control.
- **Change:** `cardSession` now also enables linking for user ids listed in the secret
  `FIDEL_CARD_LINKING_TESTER_IDS` (comma-separated, case-insensitive) while the kill
  switch is off.
  - The new test covers it: listed id enabled, other id denied, empty list denied.
  - The suite passes 17/17.
  - `fidel-card-session` redeployed; the anon smoke test still returns 401.
- **Next:** the product owner signs up a plain customer account in the test APK and
  shares only its email. Claude looks up its user id and sets the secret. The id isn't
  sensitive; the secret simply keeps it out of code.

- **2026-09-23 22:50 UTC:** the product owner created the test customer account
  `zahihussain92+test@gmail.com` (user id `75d5e256-…c9`, roles `consumer` only; email
  not yet confirmed). `FIDEL_CARD_LINKING_TESTER_IDS` is now set to that single id. This
  account also becomes the dedicated test account for the fixture stage.

## CL-1 device results, Android (2026-09-23, 22:50–22:53 UTC) — product owner's phone, test APK, test account; verified by Claude

**Genuine Fidel Test-mode card linking works end to end on Android.** Screenshots show
Linked cards with "Visa •••• 4104", the SuccessCheck, and Fidel's own native toast
"Card linked successfully".

- **Sequence (DB and function logs, read-only):**
  1. opening Linked cards ran recovery claims (2-byte bodies, 200);
  2. **link** at 22:52:27: claim with a `cardId` body (49 bytes) → row `visa`/`4104`,
     Fidel card `…809b`, account `…f95e`, one `fidel_link_identities` row;
  3. **remove** at 22:52:47: `fidel-card-unlink` 200, `unlink_reason='user'`,
     `fidel_deleted_at` set 1.2 s later, no delete error;
  4. **re-link** at 22:53:06: claim with a `cardId` body again, so Fidel returned a new
     *enrollment result*, not `cardAlreadyExists`. A new active row was created with
     the **same Fidel card id `…809b`**.
- **Unknowns resolved:**
  - **U1 (runtime, Android):** the legacy-bridge SDK works under RN 0.81 New
    Architecture: setup, start, result event, card screen.
  - **U2:** `GET /v1/cards/metadata/{id}` returns the card with matching
    `metadata.id`, program and `live=false`; the claim accepted it on the first
    attempt, with no retries.
  - **U3:** `DELETE /v1/cards/{id}` succeeded, and **re-enrolling the same number after
    deletion returns the same `card.id`.** The partial unique index design (active
    rows only) is required and worked; the pending-delete sweep's "skip if re-linked"
    rule is also justified.
  - **SDK key prefix:** confirmed `pk_test_` (the session reported enabled for the
    tester).
- **Still to test:**
  - cancel from Fidel's screen;
  - `cardAlreadyExists` when the same card is enrolled by a **different** account (U4;
    needs a second test account);
  - a test Amex;
  - iOS (needs a TestFlight or ad-hoc build; U7 on device);
  - account deletion with a linked card (only on a throwaway account).
- **Note:** the account's `4104` suffix shows Fidel's test Visa used by the product owner
  (Playground list), not the `4001` Claude guessed.

- **2026-09-24:** second test customer `zahihussain92+test2@gmail.com` (id `8c646e8b-…f2`,
  `consumer` only, confirmed) added to `FIDEL_CARD_LINKING_TESTER_IDS`, for the U4
  shared-card test.

- **Shared-card test (U4), 2026-09-23 ~23:03 UTC:** signed in as test2, the product owner
  tried to link the same Visa `…4104`. The app showed "This card is linked to another
  account". Database: test2 has **no** `linked_cards` row; test1 keeps its active row
  (`…809b`). Security outcome: pass.
  - **Which layer refused is not yet determined.** Function edge logs were still
    ingesting: only a 2-byte claim at 23:03:46 was visible.
    - A 2-byte recovery claim right after the Fidel screen means Fidel raised
      `cardAlreadyExists` (Fidel blocks the same card under a different metadata id).
    - A 49-byte claim returning `already_linked_elsewhere` means our database
      backstop refused it.
  - Re-check `function_edge_logs` for 23:03–23:06 UTC to record U4 definitively.

## Manual spend entry designed (2026-09-24) — Claude; ARCH_PLAN §4.10

- **Product owner decisions:**
  - **M1:** £200 default cap per entry, owner-adjustable from £1 to £1,000, enforced in
    the database;
  - **M2:** undo own entry within 10 minutes; owner or admin can undo any manual entry
    within 7 days; Fidel-credited spend can never be undone;
  - **M3:** the existing `can_scan_stamps` permission, plus owner and admin.
- **Design:** customers are still identified by QR or short code. A till-style pence
  keypad (no decimal key). The §3.6 payment question comes first for linked customers at
  Active shops. A second confirmation for amounts at or above half the cap.
- **Server:**
  - `record_manual_spend` is an authenticated definer RPC and the only client path for
    `spend`. It checks caller, shop model, cap and membership, is idempotent on
    `client_ref`, and reuses the P5 trigger and `handle_spend_transaction`.
  - `undo_manual_spend` voids rows and decrements progress, blocking redemption if
    progress goes negative. Voided rows still count toward P5.
  - `scanned_member_spend_summary` is one call after a scan.
  - New columns: `businesses.manual_spend_max_pence` and
    `transactions.client_ref/voided_at/voided_by/void_reason`.
- **Shopper:** shows £ progress at spend-threshold shops.
- **Tests and build order:** listed in §4.10.
- **Not started:** the build, and the cutover design (§0b item 4).
- **Also noticed:** no app or web screen shows `reward_progress_pence` yet. Shopper £
  progress is part of §4.10; retailer and web dashboard spend views still need scoping.

## Manual spend build, step 1: database (2026-09-23 23:1x UTC) — Claude implementing: applied live, inert

**File:** `supabase/migrations/20260923231109_fidel_manual_spend_entry.sql` (sha256
`7c3f1b04…`), following ARCH_PLAN §4.10.
- **Columns:** `businesses.manual_spend_max_pence`, default 20000, checked between 100
  and 100000; `transactions.client_ref` (unique partial) and
  `voided_at/voided_by/void_reason` (state check).
- **Functions:**
  - `can_record_manual_spend`: internal;
  - `record_manual_spend` (authenticated): the idempotent path, including a caught
    concurrent unique violation;
  - `undo_manual_spend` (authenticated): sets the void columns only;
  - trigger `on_spend_void` → `handle_spend_void`: decrements progress, blocks redemption
    when negative and notifies the customer. It runs as a trigger, so the membership
    guard's `pg_trigger_depth() > 1` rule is untouched;
  - `scanned_member_spend_summary` (authenticated).
- **Tests:** a new shared fixture `apps/api/test/integration/fidel-fixture.mjs`, which
  adds `businesses.name` and the live membership and reward guard triggers.
  `fidel-card-linking.test.mjs` moved onto it.
  - New `fidel-manual-spend.test.mjs` passes 1/1, covering the privilege matrix, callers
    (staff, no-permission staff, customer, stranger, anon, owner, admin), stamp shop
    refused, 0 refused, 1p and cap allowed, cap+1 refused with the cap in DETAIL, cap
    range checks, non-member refused, idempotent retry, another caller's ref refused, two
    concurrent same-ref calls leaving 1 row, direct client spend insert refused, P5
    through the RPC (method required, too soon, invalid method), summary fields and
    access, and undo (own at 9 minutes, 11 minutes too late, others' entries refused,
    owner at 6 days allowed and 8 days too late, admin allowed, Fidel row refused,
    double undo refused, negative progress blocks redemption with a notification, an
    undone entry still counts toward P5).
  - **Mutation check:** widening the staff undo window made the test fail; the file was
    restored byte-identical.
  - The card-linking and spend tests still pass (each 1/1).
- **Applied:** the dry-run listed only this migration; `db push` applied it.
- **Live checks:**
  - 56 migrations, latest `20260923231109`;
  - EXECUTE: the three RPCs to authenticated only; `can_record_manual_spend` and
    `handle_spend_void` are not client-callable;
  - `on_spend_void` present; all 10 shops at the 20000 default;
  - **0 spend_threshold shops, so no behaviour change**; 27 transactions unchanged.
- **Limitation:** the fixture has no owner update policy on `businesses`, so an owner
  editing the cap is covered by the live policy plus the check constraint, not by this
  test.

## Manual spend build, steps 2–4: apps (2026-09-24) — Claude implementing: code complete, NOT shipped or device-tested

- **Retailer `App.tsx` (`StampsScreen`),** active only when
  `business.reward_model === 'spend_threshold'`:
  - the title becomes "Record a purchase" and the segment "Purchase"; the stamp stepper
    is hidden;
  - after a scan, `scanned_member_spend_summary` shows "Name: £x of £y" and "reward
    paused" if blocked;
  - a till-style keypad (digits fill pence, C and ⌫, capped at the shop limit);
  - "Add £x" leads to the §3.6 payment sheet for linked customers at Active shops, then
    a confirm alert, with the large-amount wording at or above half the cap;
  - `record_manual_spend` with an idempotency `client_ref` that is kept across a
    network failure, so a retry never double-credits;
  - friendly refusal copy for every RPC error code;
  - a success check plus a banner ("£4.50 added. Sam is £7.50 from a reward." or "earned
    a reward!");
  - "Your recent entries": own entries from the last 10 minutes with "Undo · N min".
  - Stamp shops are unchanged.
- **Retailer `src/owner-pages.tsx` (`RewardsPage`),** spend shops only:
  - "Purchase entry limit" (£1–£1,000; saves `manual_spend_max_pence`; the DB check
    enforces it);
  - "Manual entries, last 7 days" with Undo (`undo_manual_spend`).
- **Shopper `App.tsx` (`ShopDetail`),** spend shops only: "Your spend £x of £y", a
  pence-based progress bar (negative shows £0.00), "Spend £z more…", and a paused-reward
  note when `redemption_blocked_reason` is set.
- **Checks:** `tsc --noEmit` passes for retailer and shopper; `expo export` bundles the
  retailer (Android) and shopper (Android and iOS). No device run.
- **Shipping:** all JS, so it can go out by `eas update` for both apps (no native build).
  **Not published.**
- **Device test:** needs the test shop switched to `spend_threshold` with a threshold,
  plus the test customer as a member. That is a data change that needs product-owner
  approval and a named shop.
- **Not yet spend-aware:** shopper Favourites and Home cards, the Android and iOS
  widgets, Apple and Google Wallet passes, and retailer and web analytics. All still show
  stamps and need scoping before the cutover.

## Test shop switched and OTA updates published (2026-09-24) — Claude, product owner approved

- **Test shop (data change, reversible):** "Pure Elegant Dry Cleaners" (`3aec6bbc-…`,
  owner `pureelegantdrycleaners@…`) is now `reward_model = 'spend_threshold'`,
  `reward_threshold_pence = 1000`, cap 20000.
  - It has 5 members (all apparently test or review accounts, including
    `retailerreview@` and one unrecognised address), 7 historical stamp transactions and
    1 catalogue item. Stamp counts are kept but hidden while the shop is spend-based.
  - Revert with `reward_model='stamp_legacy'`.
- **OTA (`eas update`, PowerShell, runtime 1.0.0, one call per platform):**
  - shopper `production`: Android `12b49c0b…`, iOS `c0049a05…`;
  - shopper `preview` (the card-linking test APK): Android `87d7fdb4…`, iOS
    `9ad84017…`;
  - retailer `production`: Android `c6761bf7…`, iOS `f7438a3c…`.
  - Published from the working tree (the changes are **not committed to git**; the
    product owner hasn't asked for a commit).
  - Live store builds on 1.0.0 get these updates. Card-linking UI stays hidden there,
    because the native Fidel module is absent and the code loads it lazily. Spend UI
    only appears at spend-threshold shops (only the test shop).
- **An `--platform all` attempt failed first,** because web bundling fails on
  `react-native-maps`. Nothing was published by that attempt.

## Manual spend device test (2026-09-23 23:35–23:40 UTC) — product owner: "they both work"

- **Test shop:** Pure Elegant Dry Cleaners, spend-based, £10 threshold, on the OTA builds.
- **Database (read-only):** 4 manual `spend` rows, all with `recorded_by` and
  `client_ref`:
  - £20.00 and £1.56, both **undone**;
  - £5.87;
  - £200.00, exactly the default cap.
  - `manual_payment_method` is null throughout, which is correct: the shop has no active
    Fidel Location, so no payment question.
- **Verified on device:** retailer keypad entry, confirmation, undo, the cap, and the
  shopper £ progress display (product owner report).
- **Not exercised:** the owner's cap change and 7-day undo list, and the payment
  question at an Active shop.

## Pure Elegant connected to the Fidel test Location (2026-09-25) — Claude, product owner approved

- **Data change:** one `business_fidel_locations` row: Pure Elegant (`3aec6bbc-…`),
  program `…0b95` (the Test program), Location `…4944`, `fidel_mid` null,
  **`fidel_status = 'active'`**.
  - The full Location id came from the RPC's own `unknown merchant location` warning in
    postgres_logs for the 16:39 auth and the 17:19 clearing (not a secret).
  - Pre-checks: the Location wasn't mapped elsewhere and the shop had no Location.
  - `card_linked_business_ids()` now returns only Pure Elegant.
- **Effects, all intended for testing:**
  - the ⚡ badge and prompt show on Pure Elegant for card-linking testers;
  - the P5 rule now applies there: staff must choose how a card-linked customer paid,
    with 3 entries a day, 30 minutes apart;
  - a genuine Test-mode Playground transaction at Location `…4944` with a linked card
    whose owner is a member will now be **processed**, crediting spend.
- **Test prerequisites:** `zahihussain92+test@gmail.com` owns active card `…809b` but is
  **not yet a member** of Pure Elegant (a genuine delivery before joining returns
  `unknown_membership`). `+test2` is a member with progress 587 but has no card.
- **Revert:** delete this row, or set `fidel_status` to null.

## MILESTONE: first genuine card payment credited automatically (2026-09-25 00:03 UTC) — verified by Claude

- **Setup:** `zahihussain92+test@gmail.com` joined Pure Elegant (spend-based, £10) in the
  app; its linked Visa `…4104` (Fidel card `…809b`) was the card used. The product owner
  created one Fidel Playground Test-mode transaction at Location `…4944`.
- **Chain (read-only DB):**
  1. `fidel_webhook_events`: `transaction.auth`, transaction `…3c7c`, 00:03:13 UTC;
  2. `fidel_transactions`: `…3c7c`, original 637, credited 637, `authorized`;
  3. `transactions`: `spend` 637, note `fidel:auth:…`, service role (no
     `recorded_by`);
  4. membership progress 637, `visit_count` 1, not blocked;
  5. notification "Progress updated: You are £3.63 away from your next reward."
- **Also:** the 1 reward row is the shop's sign-up ("Welcome") reward from joining,
  not a threshold reward.
- **What this proves end to end:**
  - in-app card linking;
  - card identity (`card.id`) resolution;
  - Location and program mapping, with the Active status honoured;
  - membership resolution;
  - the atomic webhook RPC, `handle_spend_transaction` and the spend-based progress
    display.
- **Still not covered:**
  - a threshold crossing by card (a second payment ≥ £3.63 would test it);
  - clearing of this purchase;
  - refunds (Test mode doesn't deliver them);
  - **push** delivery: the notification row exists, but checkpoint 6 dispatch isn't
    built, so no push was sent;
  - iOS card linking.

## Work committed to git (2026-09-25) — Claude, product owner asked

- **Local branch `main`, not pushed:**
  - `cc3359f`: Supabase (the migration reconciliation, all Fidel migrations and Edge
    Functions, delete-my-account);
  - `7008e94`: shopper and retailer apps;
  - `ccd7ea5`: `apps/api` and the integration tests;
  - `bbd1daf`: Codex's legal PDFs, generator and web copy;
  - `6de360d`: plans, handoff, timeline and agent instructions.
- **Secret scan** of the 126 committed text files for API, SDK and webhook keys, JWTs,
  private keys and `sb_secret_`: no hits.
- **Deliberately left out:**
  - `.codex-homepage-release/` and `.codex-policy-release/`: these are git
    **worktrees** for branches `codex/homepage-refresh` and `codex/fidel-policy-release`;
  - `timeline-site/`: its own git repository. It was first added as a gitlink by
    mistake; I removed it and amended the unpushed commit;
  - `tmp/`: Codex scratch (rendered PDFs, a verify script);
  - `remote_schema_dump.sql` (0 bytes) and `timeline-site.tar.gz` (an artifact).
- **Left uncommitted pending the product owner:** the 8 deleted `docs/*.md` files
  (HANDOFF-CREDENTIALS-AND-MAINTENANCE, HANDOFF-DEV-NOTES, HANDOFF-STATUS, the
  LOYALTY-LOOP-* specs and NEW-SESSION-PROMPT). They are missing only from this working
  folder; every branch, including `origin/main`, still has them, and no commit deleted
  them. `git checkout -- docs/` restores them.

## Historical copy-ready prompt for Codex — superseded by the 2026-09-25 review; do not run

> Read `CLAUDE_HANDOFF.md` ("Clearing/refund contract review (2026-09-23, 17:40 UTC)"), `ARCH_PLAN.md` §4.2–§4.4a, and `IMPLEMENTATION_TIMELINE.md`. Goal: the **fixture stage**. Prove that genuine Fidel Test-mode auth and clearing deliveries credit a **dedicated test account** at a **dedicated test shop** correctly. No refund leg: Test mode doesn't deliver refunds. Never print, log or write secrets, raw bodies, header values, card numbers or auth codes. Write ids and UUIDs as their last 4 characters only. Don't change secrets, Fidel webhook settings or function code, and don't replay deliveries or send requests to the webhook yourself. Touch no real customer's or real shop's data.
>
> 1. **Confirm the inputs.** The product owner named the test shop and test shopper account and approved up to three Playground actions. If any is missing, stop and ask.
> 2. **Read-only pre-checks.**
>    - The test account has exactly one membership, at the test shop, with `reward_progress_pence = 0`.
>    - The test shop has no other members, or record how many and confirm with the product owner that they are test accounts.
>    - Fidel test card `...a8c6` isn't in `linked_cards`.
>    - Program `...0b95` / Location `...4944` isn't in `business_fidel_locations`.
>    - `fidel_webhook_events` still holds only auth `ecb9` and clearing `ecb9`. If a late refund or negative clearing has appeared, stop and report it.
>    - Record the test shop's current `reward_model` and `reward_threshold_pence`, for the handoff and a later restore.
> 3. **Insert the fixtures** in one SQL transaction, service role, data only (no migration). Commit only if each statement affects exactly one row:
>    - update the test shop: `reward_model = 'spend_threshold'`, `reward_threshold_pence = 1000`;
>    - insert `business_fidel_locations` (test shop, program id, location id, `fidel_mid` null);
>    - insert `linked_cards` (test account, Fidel card id, account id, scheme, last numbers from the Dashboard's masked display; `unlinked_at` null).
>
>    Take the full Fidel ids from the Test-mode Dashboard. Don't write them into any file.
> 4. **Auth 1.** Ask the product owner to create one Playground transaction: test card, test Location, **£6.00**. Confirm:
>    - one `?event=auth` delivery, 200, `processed`;
>    - a `fidel_transactions` row: `authorized`, original 600, credited 600;
>    - one `transactions` row: `spend`, 600, note `fidel:auth:…`;
>    - membership progress 600, no reward, `visit_count` up by 1.
> 5. **Auth 2.** Ask for one more Playground transaction at **£5.00**. Confirm:
>    - 200, `processed`;
>    - progress **100**;
>    - **exactly one** new `rewards` row at the test shop;
>    - one new `notifications` row (push isn't expected: checkpoint 6 isn't built).
> 6. **Clearing.** Ask the product owner to **Clear** the auth 1 transaction (Programs → The Loyalty Loop → Transactions → ⋯ → Clear). Confirm:
>    - one `?event=clearing` delivery, 200, `processed`;
>    - that `fidel_transactions` row is `cleared`;
>    - progress, rewards and `transactions` are unchanged.
> 7. **Isolation (read-only).** No other membership, reward, notification or transaction changed outside the test account and test shop. `unknown_*`, `unresolved_*` and `malformed` outcomes: 0. Record each delivery's execution time from the gateway logs (budget: under 20 s).
> 8. **If any delivery isn't 2xx, or any count is off, stop.** No retry, replay, cleanup or code change. Report the step, status, function-log line and read-only counts.
> 9. **Leave the fixtures in place and stop.** Don't restore the shop or delete anything. Claude reviews, then decides cleanup, the next checkpoint (6, notifications) and the live-refund gate.
>
> Update `CLAUDE_HANDOFF.md` after each step, at the end of the file. Then replace this section with the single copy-ready prompt for Claude Code. Product-owner input: steps A–C before starting, then three Playground/Dashboard actions (steps 4–6).


## Fidel policy review (2026-09-23) - Codex

User requested privacy, data-use and related policy updates. Reviewed legal/generate.js, the six served PDFs, web Help/consent/acceptance code, ARCH_PLAN sections 0a/0b and CARD_LINKING_PLAN P1-P7 and deletion design. Existing text omits Fidel, uses a placeholder legal email and describes only legacy rewards. The card-linking and account-deletion promises must remain conditional on rollout; deletion and unlink are not verified live. Official Fidel privacy, SDK and FAQ pages checked. Current v4 SDK documentation describes Single.id and differs from CARD_LINKING_PLAN's configuration contract; do not change architecture in this copy task, and recheck CL-1 against the actual chosen SDK before release. Product-owner legal identity/contact requested; existing Help page uses developer@the-loyalty-loop.com. No code checks or PDF regeneration completed yet. No deployment or provider changes.


## Fidel policy source updates (2026-09-23) - Codex

Updated legal/generate.js across all six policies: optional card consent and data flow, spend/refund rules, rollout qualification, unlink versus deletion, merchant enrolment permission, provider roles, analytics separation and misuse. Generator now synchronises all six PDFs to apps/web/public/legal. Help privacy/deletion answers updated; new web terms/privacy acceptance rows use version 2026-09-23 (existing acceptances are not rewritten). Used the existing Help support address developer@the-loyalty-loop.com instead of the fictitious .example email, pending owner confirmation. No automatic merchant consent, SDK consent or reacceptance flow was implemented. Regeneration and validation are next; no deployment.


## Policy PDF generation/check stage (2026-09-23) - Codex

All six PDFs regenerated and byte-identical served copies checked; date and removal of placeholder contact verified. First smoke-check failed because it incorrectly required the word Fidel in the acceptable-use policy (which describes card-linked misuse); corrected the assertion to accept that heading, then passed. Poppler rendered all pages but emitted missing display-font warnings for Symbol/ArialUnicode; visual inspection follows. node --check legal/generate.js passed. Web build is still running.


## Policy build and visual review (2026-09-23) - Codex

Web production build passed (TypeScript + Vite; existing large-chunk advisory only). All 14 PDF pages inspected in rendered contact sheets: no clipping/overlap, but paragraph spillovers were untidy. Generator now keeps ordinary paragraphs and bullets together; final re-render follows. Compared previous served privacy/cookie/terms PDF text with source: served PDFs already used developer@the-loyalty-loop.com, so this update preserves their public contact rather than introducing a new address. Native shopper/retailer legal rows use the same web URLs and need no copy changes. No live deployment.


## Policy release documentation (2026-09-23) - Codex

Added legal/README.md with sources, regeneration instructions and concrete unresolved release items (legal entity/contact, actual provider contract/roles/transfers/retention, merchant acceptance, existing-user notification, selected SDK consent and working unlink/deletion). IMPLEMENTATION_TIMELINE.md now records this release dependency without moving backend milestones. Final PDF regeneration and content/copy checks pass; final visual review next.


## PDF pagination correction (2026-09-23) - Codex

Final visual review caught headings separated from their first paragraph after the paragraph-keeping improvement. Fixed the generator to reserve heading plus first paragraph together. Re-rendering affected pages before delivery; prior content checks remain valid but layout is being rechecked.


## Fidel policy update complete locally (2026-09-23) - Codex

Changed paths: legal/generate.js, legal/README.md, all six legal/*.pdf and matching apps/web/public/legal/*.pdf, apps/web/src/pages/Help.tsx, apps/web/src/lib/engagement.ts, IMPLEMENTATION_TIMELINE.md and this handoff. Final 14 rendered pages visually checked after pagination fixes: readable, no clipping, overlaps or orphan headings. PDF date/contact checks and byte-identical public-copy checks passed for all six; generator syntax and scoped git diff --check passed. Web TypeScript/Vite production build passed before the final PDF-only pagination changes. Poppler's display-font warnings did not produce visible defects. No native build or live browser/deployment check run. No deployment, emails, provider configuration, database or consent-record mutation performed.

Confirmed requirement: reflect Fidel in privacy/data-use and related policies. Agent choices: keep rollout conditional, preserve current public support contact, separate card consent from analytics and general legal acceptance. Still unresolved: legal entity/contact confirmation, actual provider roles/contracts/transfer and retention validation, existing-user notice and merchant consent collection, selected SDK contract, and end-to-end unlink/deletion readiness. These are release dependencies, not claims that controls are already shipped. Other contributors' changes were preserved.


## Policy production deployment preparation (2026-09-23) - Codex

User explicitly authorised Vercel production deployment. Connected project is loyalty-loop (prj_V2chVllrYdj7ACGIfqMxuk2RcRhR), team loyalty-loop. Latest production is READY at GitHub main commit 70df65a9de04d468e50fa5722f597a8a1ebfc23f, deployment dpl_2X59qtKQe2xv5C8cNFTstbXyyhrH. Main workspace is divergent (ahead 3/behind 16), so deployment will use an isolated checkout of origin/main with only the policy update. Read-only connector project-detail calls failed due to incompatible projectId/idOrName schemas; list-deployments confirmed the Git integration. Initial sandbox git fetch could not write FETCH_HEAD; approved elevated fetch passed. No production mutation yet.

## Isolated policy release prepared (2026-09-23) - Codex

Created .codex-policy-release on codex/fidel-policy-release from current origin/main (70df65a). Copied exactly 16 policy source/PDF/Help/version files; affected source files are identical between local HEAD and production baseline before applying our edits, so no newer edits were overwritten. Scoped whitespace check passed. Isolated full web build underway using the unchanged existing dependency installation. Vercel CLI bootstrap failed with sandbox npm EACCES; proceeding through the existing GitHub-to-Vercel deployment integration. No production mutation yet.

## Isolated policy release build passed (2026-09-23) - Codex

Production-baseline checkout plus the 16 policy files passed TypeScript/Vite build (2308 modules, only a large-chunk advisory). The release does not include native, database, backend or unrelated local edits. Next: commit only those files and fast-forward GitHub main to trigger its established Vercel production deployment, as explicitly authorised.

## Policy release commit (2026-09-23) - Codex

Committed exactly 16 policy files as e07e648 on codex/fidel-policy-release, parent current production 70df65a. Cached whitespace check passed. Shared root workspace and other contributors' edits unchanged. Production push is next.


## Policy production push (2026-09-23) - Codex

GitHub main fast-forward push succeeded: 70df65a to e07e648. This triggers the existing Vercel production integration. Vercel completion and live policy URLs are not verified yet.


## Vercel production deployment ready (2026-09-23) - Codex

Vercel deployment dpl_7eMEVzyLKFz4U6hWaRSbHndSFqxR is READY, target production, commit e07e648a147b3200ad51be9307e5c52d4957a065. Build duration about 15.4 seconds. Both www.the-loyalty-loop.com and the-loyalty-loop.com are assigned with no alias error. Live HTTP/content verification follows.


## Live policy verification (2026-09-23) - Codex

All six live PDFs returned HTTP 200 application/pdf and SHA-256 matched the release exactly; live Help chunk contains the new Fidel text. Vercel runtime-error scan for the last hour returned none. Initial sandbox HTTP check failed with socket permission denied; elevated read-only check succeeded for these checks. Additional engagement chunk version assertion failed and is being investigated before final handoff; no claim of acceptance-version live verification yet.


## Policy deployment verification complete (2026-09-23) - Codex

Production deployment READY: https://loyalty-loop-jxyw30kb3-loyalty-loop.vercel.app, dpl_7eMEVzyLKFz4U6hWaRSbHndSFqxR, commit e07e648a147b3200ad51be9307e5c52d4957a065. Live https://www.the-loyalty-loop.com/legal/ paths for all six policies returned HTTP 200 application/pdf and SHA-256 identical to the approved local PDFs. /help returned HTTP 200 and its live JS chunk contains the updated Fidel data-use text. Vercel runtime error scan over the previous hour returned no errors; drains/monitoring configuration was not inspected and no interactive browser session was run.

Resolved the extra JS assertion: acceptLegal is an unused exported helper in apps/web/src/lib/engagement.ts and Vite removes it from production output. There are no call sites anywhere in web source. Its source version is updated to 2026-09-23, but it does NOT currently record new signup acceptances. Earlier wording that new web acceptance rows use that version was too strong; the helper would do so only when wired. This pre-existing acceptance-flow gap is separate from the successful policy publication and must be addressed before relying on recorded user/merchant consent. No signup or consent records were created during verification.

Main shared workspace remains on its original divergent branch with other contributors' edits intact. Release worktree .codex-policy-release is clean, branch codex/fidel-policy-release, and GitHub main now includes e07e648. Prior production rollback reference: 70df65a / dpl_2X59qtKQe2xv5C8cNFTstbXyyhrH. Native/backend changes were not published.

## 2026-09-25 remaining-work review — Codex

Documentation-only review: later entries supersede stale opening summaries. Android linking/unlinking/relinking and shared-card refusal are tested; manual-spend database work and app OTA updates shipped; the test shop has a £10 threshold; policies are deployed and verified. No fresh runtime checks were run.

Remaining: implementation review; device tests of manual spend/undo; isolated Fidel earning-to-reward test using current mappings; remaining card-linking cases (iOS, cancel, Amex, account deletion), deletion-sweep scheduling; refund delivery/correlation investigation and reconciliation backstop; notification dispatch/recovery; merchant enrollment/status and cutover; spend-aware Home/Favourites/widgets/wallet passes/analytics; full migration replay, concurrency and pilot checks; consent recording and legal release items. The unused acceptLegal helper does not record signup consent. Refund configuration was subsequently inspected, but missing delivery remains unexplained; do not assume Test mode cannot emit refunds. Plans must respect the recorded constraint that the owner cannot contact Fidel. No code, provider settings, secrets or database changes.

## 2026-09-25 Codex independent review and provider research — complete; fixes required

User requested independent review of all Claude implementation while Codex was unavailable. Scope includes CL-2/3/4/5, card deletion, manual-spend database and app work, deployments and recorded device evidence through the first automatic credit. Review and tests only; no live mutations are implied. Current files contain later work than the earlier status summary. The Supabase changelog reader again rejected its markdown content type; current Edge Function authentication documentation was accessible.

At the user's explicit request, started a separate ChatGPT cloud research task covering UK SumUp/Solo, Square and Zettle/PayPal integrations, identity, webhooks/refunds, permissions/terms, pricing, testing and coexistence with Fidel. Official sources only; no registrations, messages, provider actions or code changes. Queued task reference: local-chatgpt:f20340d7-3b7a-4cd0-9fa6-54da694c4521. No findings returned yet.

### Review item: existing tests

Existing pure card/webhook suites completed; three focused disposable-PostgreSQL suites passed (card linking, manual spend, spend/refund/redemption). The first database attempt could not start under the Windows sandbox (`uv_os_get_passwd` ENOMEM); the approved local-only rerun passed 3/3. These are minimal-schema fixture suites, not a full migration-history replay. Source review and targeted missing-case reproductions continue; passing existing tests is not yet approval.

### Review item: targeted local reproductions — defects confirmed

`tmp/claude-review/regressions.test.mjs` ran against disposable PostgreSQL with synthetic card/provider data only. It reproduces six gaps: (1) refund after unlink returns `unknown_card`; after re-link, clearing/refund cannot resolve the original purchase; (2) recovery reactivates a deliberately removed card when Fidel deletion failed; (3) failed over-cap provider deletion creates no durable retry record and is missed by account deletion; (4) manual-spend idempotency accepts a changed customer/amount under an old reference; (5) concurrent identical retry at an active linked-card shop is rejected by P5 as `manual_too_soon`; (6) webhook still credits a mapped `syncing` Location while P5/badges consider it inactive. Assertions describe observed defects, not fixes. Shopper and retailer TypeScript checks passed. No live mutation occurred. Final severity, remediation and integration review follow.

### Review item: additional lifecycle and retry checks

Extended the same disposable local reproducer to nine observed scenarios. It also confirms recovery can race a successful provider deletion, leaving an active local card whose provider card was deleted; the concurrent manual-spend duplicate branch returns a different caller/customer's entry without the ordinary ownership/request checks; and deleting the recording staff account clears `recorded_by`, preventing an otherwise eligible owner undo. The one aggregate reproducer test passed all nine observed-defect assertions. These are review evidence, not repaired behavior or genuine provider tests. No deployed code or database data changed.

### Review item: deployed sources, access boundary and current data

Read-only Supabase checks: `fidel-webhook` reports version **6**, ACTIVE, `verify_jwt: false` (historical version 3 remains delivery evidence, not current metadata). Its six source modules match local files after newline normalization. Card session reports v5; claim/unlink/sweep v4; account deletion v18, all JWT-enabled. Their entrypoints/active helper logic match local code; bundled older helpers differ only in an unused session tester-allowlist branch. Reviewed live claim, unlink, pending-delete, manual-spend and webhook SQL bodies match the migrations. Service-only card identity/claim/deletion RPCs remain inaccessible to ordinary clients; manual-spend RPCs require authenticated permission, and direct client spend inserts remain denied. This validates the intended boundary, not lifecycle correctness.

Final read-only snapshot on 2026-09-25: auth events **3**, clearing **1**, refund **0**; purchases **2**, suffixes `3c7c` and `450b`, each authorized/637p originally and credited, no refunded pence; active cards **1**, pending deletes **0**. The purchase membership currently has **-726p**, 3 visits, 3 rewards and a redemption hold; threshold 1000p. These totals include prior manual/undo activity and do not establish a clean threshold-crossing test. Do not reuse the historical zero-balance fixture prompt. `pg_cron` is not installed; no scheduled deletion retry was verified. No provider dashboard or payment action was taken. These observations do not explain the still-missing refund delivery.

### Research item: provider comparison complete

Cloud task **Payment Integration Comparison** (`6ab64010-51d0-83eb-9779-7b5010a9639c`) finished. Saved its report and official-source appendix to `docs/PAYMENT_PROVIDER_RESEARCH_2026-09-25.md`; corrected its Fidel `cardId` wording to this project's verified nested `card.id`, and labelled its product proposal as a recommendation. Square is the strongest additional pilot candidate because it documents POS payment webhooks and a card fingerprint; scope, wallets, first-link ownership, refunds and contractual permission still require verification. SumUp/Solo and Zettle have merchant transaction access, but the reviewed fields do not establish safe repeat-shopper recognition. No blanket exclusion of SumUp merchants from Fidel follows from this research. Keep the confirmed spend model, with manual spend where automatic coverage is unavailable; one earning source per merchant unless non-overlap is proven. No provider actions or production changes were made.

### Research item: independent pricing/terms corrections

Updated the report after independent official-source checks. Square UK advertises free APIs/SDKs and Zettle's FAQ explicitly says APIs are free (processing/optional products are separate). Square UK Developer Terms §2.2 restrict services substantially the same as a Square service, and §3 requires seller consent for retained seller content; whether The Loyalty Loop is permitted remains a material unresolved contract question. Zettle's registration names its Developer Platform Agreement, but its substantive permission was not verified. SumUp integration pricing/permission remains unverified. Added official Zettle partial-refund evidence while preserving uncertainty about passive Purchase/Pusher correlation. Recommendation is a conditional Square technical pilot, not launch approval, and initially one earning source per merchant. No company was contacted or account registered.

### Review item: independent review complete — changes requested

Saved `docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md` with nine prioritized findings R1–R9, source locations, acceptance criteria, deployed evidence and scope limits. R1–R4 block the next automatic-payment stage: recovery/removal races, historical clearing/refund correlation, provider-only cleanup, and missing activation enforcement. R5–R7 cover manual command binding/concurrent retries/undo after staff deletion; R8–R9 cover misleading shopper states. Existing checks pass: 33/33 pure helper tests, 3/3 disposable database suites and both app TypeScript checks. Nine additional local scenarios demonstrate defects. This is approval of the tested routing/access boundary only, not overall launch approval. Next: Claude design review, then additive local repairs before another device/payment test. No production implementation was changed.

## Stamps removed and spend switchover (2026-09-25) — Claude implementing, product owner asked

Request: "owners set the reward amount … get rid of the stamp/points/visits setup in the apps and website and onboarding, and do the switchover". Product-owner decisions (ARCH_PLAN §4.11 T1–T5): several rewards at different £ amounts; £20 default; progress restarts at £0 at stamp shops; earned rewards stay valid; switch without Fidel registration.

What changed:
- **Retailer app** (`apps/retailer/App.tsx`, `src/owner-pages.tsx`): the loyalty-type/stamps setup is gone. Setup wizard and Rewards page take a £ amount per reward (default £20, distinct amounts, £1–£10,000); members list shows £ progress; dashboard counts purchases (`type='spend'`, not voided). OTA published: production android `400fe57a-db44-4fdd-b8e6-254d7a6e42c1`, ios `53332904-1713-4b11-bd85-457bd6629acc`.
- **Shopper app** (`apps/shopper/App.tsx`, `src/widgets/state.ts`, `src/widgets/android.tsx`): shop screen shows £ progress towards the next tier (mirrors `spend_next_tier`), join card lists "Spend £X" per reward, copy no longer mentions stamps. Widget shows whole pounds at spend shops (iOS widget prints "12 / 20 pounds" with no native change; Android renders "£12 of £20"). OTA published: production android `6eb61dcb-…`, ios `66f2547b-…`; preview android `b9168a17-…`, ios `ad994198-…`.
- **Website** (`apps/web`): owner Settings "Loyalty & rewards" is now brand colour + sign-up reward + £ rewards; onboarding rewards step takes £ amounts; Scan page records £ purchases (`SpendPanel`, with undo); customer shop page shows £ progress and every tier; analytics count purchases; member directory shows £ towards the next reward; WhatsApp card, Activity, Help, Landing, Profile, Tutorial copy updated. `simulateStamp` removed. **Not deployed** — see remaining issues.
- **Edge Functions deployed**: `create-wallet-pass`, `update-wallet-pass`, `create-apple-wallet-pass` use new `_shared/wallet-progress.ts` (Google/Apple passes show "Spent £X" and "Spend £Y more for <reward>"); `whatsapp-handoff` also returns `reward_progress_pence`.
- **Migration `20260925190000_spend_switchover.sql` — APPLIED LIVE.** Prices every reward (lowest → £20, others proportional in whole pounds, a shop already on spend keeps its amount), gives rewardless shops "Free reward" at £20, moves every shop to `spend_threshold`, resets progress to £0 at shops that were on stamps, and defaults new shops to spend at £20. Acts as service role only inside its own transaction (the membership guard otherwise blocks progress changes).

Checks actually performed:
- New `apps/api/test/integration/spend-switchover.test.mjs` (spend shop kept, lowest £20, proportional + distinct amounts, empty shop gets £20, block cleared, rewards untouched, new-shop default, stamps refused) — pass. New `_shared/wallet-progress.test.mjs` — 3/3 pass.
- Fixed the shared test fixture and `fidel-supabase-spend.test.mjs`: `20260925172000_fidel_member_spend_progress.sql` drops `get_business_members`, which neither fixture had, so every database suite failed at setup and then hung (the database was never stopped). Added a stand-in function/`profiles` table and made the fixture stop the database on setup failure.
- Full run: 48/49 pass; `fidel-spend-tiers.test.mjs` passed its test but its process did not exit within the run's time limit when all database suites ran in parallel; run alone it passes and exits in 4 s. Treat as a parallel-shutdown flake to watch, not a logic failure.
- `tsc -b` + `vite build` for web, `tsc --noEmit` for retailer and shopper, `expo export --platform android` for both apps — clean. `deno check` for the three wallet functions + `whatsapp-handoff`: only error is the pre-existing `Response(zipBytes)` TS2345 in `create-apple-wallet-pass` (present at HEAD, runtime unaffected).
- Live read after the push: all 10 shops `spend_threshold`; Pure Elegant £10 "£5 Off" (progress kept), all others one tier at £20; no stamp-shop membership has non-zero progress; unredeemed rewards 27 + 5 + 3 = 35, unchanged.

Prototype vs production: the switchover and functions are production changes; the apps are live via OTA. No on-device check of the new screens yet, and no wallet pass was regenerated to look at.

Remaining issues:
1. **(Resolved — see next entry.) Website not deployed.** It deploys from GitHub `main` via the Vercel Git integration; local `main` is 9 ahead / 17 behind `origin/main`. The live website still has the old stamp Settings/Scan — its Scan page will now be refused (`shop_uses_spend_rewards`) if an owner tries to award a stamp there. Needs a merge of `origin/main`, a build, and a push — **awaiting product-owner OK to push**.
2. Codex review findings R1–R9 (`docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md`) are still open and untouched by this work.
3. Owner-side "simulate stamp" on the website is removed; there is no equivalent test-purchase shortcut (owners can record a small manual purchase on their own account).
4. `brand_rollup.stamps_30d` still counts stamps (will read 0).

Next actions:
- Product owner: approve merging `origin/main` into local and pushing to deploy the website; smoke-test retailer setup, a £ purchase and the shopper shop screen on a device.
- Claude: after approval, merge/build/push and verify the live site; then the R1–R9 design review below.

## Website deployed with spend rewards (2026-09-25) — Claude, product owner asked

Product owner said "do the next step". Merged `origin/main` (17 commits) into local `main`; 3 conflicts (`Activity.tsx`, `Landing.tsx`, `owner/Tools.tsx`) resolved by taking GitHub's redesigned versions and re-applying the £ wording (landing FAQ/hero card now "Spend £20. One coffee on the house", Activity shows purchases in £, member directory shows £ towards next reward). GitHub's removal of the Growth-tools WhatsApp toggle was kept. `tsc -b` + `vite build` clean; outgoing diff scanned — only synthetic test keys. Merge commit `85b79e6` pushed to GitHub `main` (fast-forward from `e07e648`). Vercel production deployment `dpl_EWJhEkyhZrWEHkaGaSb7ppHxe2rJ` READY; www.the-loyalty-loop.com returned 200 and its bundle contains the new landing text. Owner pages were not clicked through in a browser.

Remaining: device/browser smoke test of owner Settings → Rewards, Scan → record £ purchase, and a customer shop page. Remaining issue 1 in the previous entry is resolved.

## Copy-ready prompt for Claude Code

Read CLAUDE_HANDOFF.md, ARCH_PLAN.md §2/§4.2, CARD_LINKING_PLAN.md, IMPLEMENTATION_TIMELINE.md and docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md. Review and disposition R1–R9; design additive fixes and give Codex the exact first local implementation task for R1–R3. Acceptance: recovery cannot undo removal; claim/unlink/sweep/account deletion cannot race; historical clearing/refunds retain purchase ownership after unlink/relink; rejected provider cards have durable cleanup. Address activation, manual retry/undo and UI findings in subsequent tasks. Review docs/PAYMENT_PROVIDER_RESEARCH_2026-09-25.md as a conditional proposal, not approval to integrate. Update the handoff after each item. No product-owner input is required for this review. Do not deploy, change secrets/settings/live data, create fixtures, contact providers or trigger/replay transactions.
