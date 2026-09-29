# Independent review of Claude's Fidel and spend work — 25 September 2026

**Verdict: changes requested before the next payment test or live pilot.** The existing tests pass and the main access boundary is sound, but card lifecycle and manual-entry integration cases fail. No production code, secrets, provider settings, database rows or fixtures were changed during this review. No delivery was replayed and no payment/refund was triggered.

Scope: the work recorded during Codex's absence in CLAUDE_HANDOFF.md, including CARD_LINKING_PLAN CL-2–CL-5, account deletion, manual spend/undo, shopper and retailer UI, recorded Android/OTA evidence, and the first automatic credit. Reviewed current source and the newly committed groups cc3359f, 7008e94, ccd7ea5 and planning updates through 9e20fe5. Some engine code was earlier Codex work; the findings below concern its integration with Claude's changes, not attribution of every line to Claude. Legal publication remains the earlier Codex work, not a new Claude feature.

## Actionable findings

### R1 — P1: recovery can reverse removal or race provider deletion

Locations: `supabase/functions/_shared/fidel-cards.ts:239`, `supabase/migrations/20260923182000_fidel_card_linking.sql:174`, `apps/shopper/src/card-linking.ts:146`.

Claim recovery lists all cards under the user's stable metadata identity. The claim RPC looks only for an active local row, so a card deliberately unlinked locally is eligible for a new row while Fidel still holds it. Reproduced: provider DELETE returns 503; unlink reports Removed and zero active cards; ordinary recovery immediately returns claimed and restores the card. Also reproduced: recovery runs while a successful DELETE is in flight, leaving an active local row for a provider card that has just been deleted. Filtering active cards when the sweep selects work cannot close that race.

Required contract: durable enrollment/removal state shared by claim, recovery, unlink, account deletion and sweep. Background recovery must not undo withdrawal. Explicit fresh enrollment must still work when Fidel reuses a card ID, as recorded in the Android evidence. Serialize lifecycle operations and use a verified enrollment generation or equivalent evidence; permanently banning every historical ID is not a solution.

### R2 — P1: later clearing/refunds stop resolving after unlink or relink

Locations: `supabase/migrations/20260922233331_fidel_service_role_detection.sql:71`, `:127`, `:146`; new partial uniqueness in `20260923182000_fidel_card_linking.sql:21`.

Every event first requires a currently active card. Refund/clearing then require the purchase's local linked-card row to be that same row. Reproduced: authorize 600p, unlink, refund 100p → unknown_card. Relink the same provider card ID → clearing unresolved_clearing and refund unresolved_refund; the original 600p remains. These outcomes commit the event ledger and are acknowledged, so ordinary retry will not repair them.

Required contract: use current consent/active eligibility for NEW awards; correlate follow-up events to the originally recorded purchase and historical card ownership, with provider/program/location/business and user checks. A new owner or enrollment must not inherit someone else's purchase. Preserve withdrawal of future earning while allowing adjustments to already awarded spend. ARCH_PLAN §4.2's blanket active-card resolution is itself incomplete and must be corrected before implementation.

### R3 — P1: rejected provider cards can escape both retry and account deletion

Locations: `supabase/functions/_shared/fidel-cards.ts:252`, `:334`; `supabase/functions/delete-my-account/index.ts:30`.

If a sixth provider card is rejected by the local cap and provider DELETE fails, the code only logs the failure. No local linked-card or cleanup row is created. Account deletion and the sweep enumerate local rows, so neither can find it. Reproduced with five active cards and a sixth DELETE returning 503: no durable row; subsequent account deletion helper never attempts that sixth card.

Required contract: persist retryable cleanup for provider-only/rejected enrollments before an account can lose its identity mapping. Account deletion must also prevent concurrent enrollment/claim from creating a new orphan after its snapshot. Schedule and monitor cleanup only after R1's race is fixed. The current absence of a verified scheduler is separately an already-known unfinished stage.

### R4 — P1: automatic earning ignores the Location activation state

Locations: `supabase/migrations/20260922233331_fidel_service_role_detection.sql:63`; new status contract in `20260923182000_fidel_card_linking.sql:46`.

The badge and linked-card manual-entry restrictions use fidel_status = active. The award RPC checks only the mapping, without status. Reproduced: set the disposable Location to syncing; its badge/status reports inactive but a signed-event-equivalent RPC auth still awards 100p. A delayed delivery for an inactive location can therefore award alongside unrestricted manual spend.

Required contract: one explicit eligibility rule for new automatic awards, used by the engine and UI/manual restrictions. Historical clearing/refunds must remain processable after a location or card stops accepting new awards. Define how ineligible/delayed events are recorded and reconciled; do not silently promise that replay will recover an acknowledged event.

### R5 — P2: a retry key is not bound to its original command

Locations: `supabase/migrations/20260923231109_fidel_manual_spend_entry.sql:81`, `:114`; `apps/retailer/App.tsx:787`, `:807`.

Sequential duplicate handling checks caller/business but not customer, amount or payment method. The concurrent unique-violation branch does not repeat even those ownership checks. Reproduced: a 600p entry for one customer and a 500p request for another with the same key return the first transaction as duplicate success. A concurrent different-caller request also returns the original entry without the ordinary rejection.

The UI preserves the key after an uncertain network failure but allows amount editing; its success message prints the edited amount instead of the server's amountPence. Thus a legitimate retry can show that a new amount was added although only the old amount was recorded.

Required contract: immutable pending command, complete request binding and authorization in all duplicate paths, deterministic response from the stored command, and UI messages based on that response. Resolve an uncertain submission before allowing it to become a new purchase. Catch only the intended uniqueness conflict.

### R6 — P2: simultaneous identical retries fail the linked-card throttle

Locations: `supabase/migrations/20260923231109_fidel_manual_spend_entry.sql:106`; `20260923182000_fidel_card_linking.sql:417`.

The duplicate lookup happens before the insert. At an active linked-card shop, a concurrent identical request waits in the before-insert P5 membership lock; after the first commits it fails manual_too_soon, before the unique-index handler can return duplicate success. Reproduced with two database connections and one uncommitted first entry.

Required contract: serialize a command's idempotency key before P5 and re-read the committed result, with consistent lock ordering. Identical retries should return the one recorded purchase; genuinely different purchases must still obey the method, interval and daily limits.

### R7 — P2: deleting staff makes their manual entries impossible for the owner to undo

Locations: `supabase/migrations/20260923182000_fidel_card_linking.sql:57`; `20260923231109_fidel_manual_spend_entry.sql:156`.

recorded_by is both a nullable foreign key with ON DELETE SET NULL and the only manual-origin test in undo. Reproduced: delete the recording staff user in the disposable database; the owner is refused undo for that manual entry even inside the seven-day window.

Required contract: an immutable, server-controlled origin independent of the continued existence of the staff account. Preserve owner/admin undo of manual rows; never allow Fidel rows to enter this path.

### R8 — P2: a non-member is promised automatic earning

Location: `apps/shopper/App.tsx:1248`.

The shop auto-earn panel is shown independently of membership. Its Link a card action performs global card enrollment, while joining the shop is a separate action. A shopper can follow this panel and pay without joining; the database acknowledges unknown_membership and makes no award.

Required contract: require membership before promising earning, or provide an explicit shop-join flow with the appropriate consent. Do not silently enroll users. Source-confirmed; not reproduced on a handset in this review.

### R9 — P2: the duplicate-card error can falsely say the card belongs elsewhere

Location: `apps/shopper/src/card-linking.ts:188`.

The cardAlreadyExists branch accepts only recovery status claimed. Recovery returns already_linked for a card already linked to the same user, and the UI then reports ELSEWHERE. The normal success branch already handles already_linked.

Required contract: show the truthful state without weakening proof of ownership. Finding another unrelated card during recover-all is not proof that the attempted card belongs to this user. Use available verified identity, or a neutral message when the attempted card cannot be identified. Source-confirmed; not freshly device-tested.

**2026-09-29 cross-reference — R1–R4 approval input for R9:** see [the implementation approval in CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md) and [the deployment runbook's owner smoke test](DEPLOY_R1-R4_RUNBOOK.md#5-separately-authorized-owner-assisted-smoke-test). In `supabase/functions/_shared/fidel-cards.ts`, `claimCards` ranks `removal_in_progress` and `removal_pending` above `claimed`. A recover-all call can therefore claim one card but return a removal status because a different card is still being removed. In `apps/shopper/src/card-linking.ts`, the `cardAlreadyExists` branch accepts only `claimed` and otherwise returns ELSEWHERE, including for `already_linked` and removal statuses. Review status aggregation and that branch together in R9; preserve ownership proof, avoid treating an unrelated recovered card as proof of the attempted card's ownership, and give truthful or neutral copy. This is a non-blocking R9 follow-up from the approved R1–R4 review, not an R1–R4 code change or a completed UI fix.

## Verification and approved portions

- Existing pure helper/webhook suites: **33/33 pass**. This includes selector, raw-body/signature, parser and card helper cases. The historical 16/16 webhook-stage result is not a count of the whole current suite.
- Disposable PostgreSQL integration suites: **3/3 pass** (card linking, manual spend, spend/refund/redemption). The first sandbox attempt failed at Windows user lookup with ENOMEM; the approved local-only rerun passed.
- Shopper and retailer TypeScript no-emit checks: **both pass**.
- Additional review script: `tmp/claude-review/regressions.test.mjs`, **one aggregate test / nine observed-defect scenarios pass**. These assertions demonstrate failures; they are NOT acceptance tests proving the implementation correct. It uses fake HTTP and an isolated PostgreSQL instance only.
- Live permissions inspected read-only: sensitive identity/claim/delete RPCs service-only; manual RPCs authenticated with business permissions; no direct client spend insertion, transaction update or delete path found in the reviewed policies. The identity table is not client-readable. The service role boundary and empty search_path definitions are retained.
- Routing contract approved: one recognized event selector chooses a server configuration; event type comes from that configuration; the exact configured URL and that event's own secret authenticate the raw body. No client parameter alone authenticates an event. The runtime proxy URL is not used as the signed URL. Historical six unsigned probes and genuine auth/clearing evidence remain valid evidence of those stages; no new probes were sent.
- Native-module lazy loading/gating and verified provider metadata matching are sound in the reviewed source. Android link/unlink/relink, shared-card refusal, and manual keypad/undo/cap evidence are recorded by Claude/the owner; this review did not repeat handset actions.

Commands used:

```powershell
node --test supabase/functions/_shared/fidel-cards.test.mjs supabase/functions/fidel-webhook/*.test.mjs
node --test --test-concurrency=1 apps/api/test/integration/fidel-card-linking.test.mjs apps/api/test/integration/fidel-manual-spend.test.mjs apps/api/test/integration/fidel-supabase-spend.test.mjs
node ./node_modules/typescript/bin/tsc --noEmit -p apps/shopper/tsconfig.json
node ./node_modules/typescript/bin/tsc --noEmit -p apps/retailer/tsconfig.json
node --test tmp/claude-review/regressions.test.mjs
```

## Deployed evidence and remaining limits

Current read-only Edge Function metadata: webhook **v6 / JWT false**; session **v5 / JWT true**; claim, unlink and sweep **v4 / JWT true**; delete-my-account **v18 / JWT true**. The webhook's six modules match local source after newline normalization. Other entrypoints and active helpers match; an older shared helper bundled in non-session functions differs only in an unused session tester-allowlist branch. Version 3 is historical; no unsupported explanation is assigned to the later version counter. Retrieved claim, pending-delete, unlink, manual-entry and event-processing SQL bodies match their local migrations.

Final read-only data snapshot: **3 auth, 1 clearing, 0 refund events; 2 purchases, each 637p, authorized, 0 refunded; 1 active card, 0 pending local deletions.** Purchase suffixes are 3c7c and 450b. Their membership currently has -726p, three visits, three rewards and a redemption hold, against a 1000p threshold. Historical manual entries and undo activity coexist with this data; these totals do not prove a new isolated threshold/reward test passed. No record was altered to make the snapshot fit an old fixture instruction.

A genuine signed auth and positive clearing were verified historically. The negative Test-mode creation returned a candidate refund with originalTransactionId but produced no observed signed refund or negative-clearing delivery. Refund signature, live delivery, correlation and timing remain unverified. A simulated transaction object and a local parser test cannot establish these. Do not state that Test mode cannot send refunds or that the cause is known. The user says it can; the missing delivery in this account remains unexplained.

No pg_cron extension was installed in the inspected database. No external scheduler was verified. No full migration-history replay, new native build, iOS/cancel/Amex/account-deletion device verification or new OTA delivery verification was run. No notification dispatcher/recovery, merchant enrollment/status refresh, universal spend cutover, all remaining spend displays/analytics/wallet paths or actual legal-acceptance recording is approved as complete by this review.

## Required next sequence

1. Claude reviews/dispositions R1–R9 and corrects the lifecycle/eligibility contract before dependent work. Product-owner input is not required for that design review.
2. First Codex implementation task: an additive, local-only card-lifecycle repair for R1–R3, including historical purchase correlation and durable cleanup. Convert the review reproductions into desired-behavior tests; add concurrent claim/remove/sweep/account-delete cases and cross-user isolation. Do not edit applied migrations or deploy.
3. Repair new-award eligibility R4, manual command/undo R5–R7, and UI R8–R9; review each stage and update the handoff after every completed item.
4. After review and authorized deployment, prepare a test from the actual current balances/mappings. Do not recreate the old zero-balance fixtures or replay old events. Owner participation is required for device/provider actions.
5. Keep refund evidence/reconciliation, cleanup scheduling, notifications, full-history/security/capacity checks, merchant activation/cutover, remaining spend surfaces and consent/legal readiness as release gates.
6. Provider integration research is a proposal, not a replacement milestone: Square is the leading technical candidate after contract eligibility is resolved; preserve manual spend and per-shop Fidel eligibility meanwhile. See the separate provider report.

Other contributors' deleted documents, untracked worktrees and unrelated edits were preserved.
