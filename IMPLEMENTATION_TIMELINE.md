# The Loyalty Loop — implementation timeline

Status (2026-09-25): card linking and manual spend/undo are deployed and partly device-tested; the first genuine Fidel Test-mode automatic £6.37 credit is recorded. Independent Codex review is complete with **changes requested**: see `docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md` R1–R9. Existing checks pass, but targeted local tests reproduce lifecycle, refund-correlation, activation and manual-entry defects. **Next: Claude reviews repair contracts, then Codex makes additive local fixes before the next payment test.** No product-owner input is required for the design review. Do not reuse old zero-balance fixture instructions. Current webhook metadata is version 6, JWT verification disabled; routing source matches the reviewed implementation. Genuine auth/clearing are verified historically; refund delivery/signature/correlation remain unverified, and the missing Test-mode delivery has no established cause.

**People:** You = product owner. Claude Code = architect and reviewer. Codex = builder and test runner (the assistant in this chat).

## Where we are now

- **Milestones 1 and 2 are complete.** The current product model is cumulative
  spend toward each merchant's reward threshold, with the shipped stamp system
  retained for legacy businesses. Fidel's current docs confirm double HMAC,
  decimal major-unit amounts, a separate negative refund transaction and
  `originalTransactionId` when a refund matches a purchase. Signed auth/clearing
  deliveries verified their subscription-specific URL/secret mapping; genuine refund
  delivery and correlation remain unverified.
- A standalone Express/Prisma prototype exists in `apps/api`. Its 20 tests, lint, type checks, build and Prisma validation passed during its implementation. It is not deployed, does not update existing Supabase accounts, and is **not** the production direction (decision #9 in `ARCH_PLAN.md` §1 stands) — its tests are reference only, not its architecture.
- The production direction is the existing Supabase database and Edge Functions, with Fidel card linking and a new purpose-built notification dispatch function (§4.6) rather than the original `send-user-push` reuse idea.
- Current sequence: review R1–R9 → additive lifecycle/correlation/cleanup fixes R1–R3 →
  activation/manual retry/undo/UI fixes R4–R9 → review and authorized deployment →
  a newly scoped owner-assisted verification using current balances and mappings.
  Full migration-history replay, refund/reconciliation evidence, cleanup scheduling,
  notifications, remaining spend surfaces, merchant enrollment/cutover and consent
  readiness remain pre-pilot gates. Passing the existing minimal database suites is
  not a full-history or production acceptance test.
- Provider research is complete in `docs/PAYMENT_PROVIDER_RESEARCH_2026-09-25.md`.
  Square is the leading technical candidate for a later additional pilot, conditional
  on UK terms applicability and physical-device evidence. No new provider integration
  is approved or inserted ahead of the current correctness work; manual spend remains
  the fallback where verified automatic coverage is unavailable.
- No extra chat uploads are required. Both agents read the latest files from this same project folder and update `CLAUDE_HANDOFF.md` after every completed item.

## Milestones and owners

| Order | You do | Claude Code does | Codex does | Complete when |
| --- | --- | --- | --- | --- |
| **1. Correct the architecture — DONE (2026-09-22)** | Asked Claude to review the current plan. | Corrected provider facts (double HMAC, decimal amounts, card.id); reconciled carry/refund mathematics; added server-side redemption blocking and a working notification dispatch design. Updated `ARCH_PLAN.md` and the handoff. | Next: read the corrected files, start milestone 4. | Met — see `ARCH_PLAN.md` §2.1 and `CLAUDE_HANDOFF.md` for what changed and what's still sandbox-unverified (refund correlation, card.id spot-check). |
| **2. Agree the rules and capacity target — DONE (2026-09-22)** | Supplied ~100 payments/day platform-wide (provisional, revisable). | Turned it into a worked burst example and a concrete test target: 10 concurrent distinct transactions within 1s, p95 latency under 3s — see `ARCH_PLAN.md` §8. Carry/refund/threshold rules were already confirmed in milestone 1's planning pass. | Next: write the concurrency + latency tests in checkpoint 7, parametrized so the number is cheap to raise later. | Met — see `ARCH_PLAN.md` §8. |
| **3. Prepare Fidel sandbox — can run alongside 1–2** | Obtain Fidel sandbox access. Complete any provider/account steps only you can perform. Put credentials into agreed secret settings when requested; do not paste secrets into handoff files. | Verify product/subscription contracts, card identifiers, refund correlation and representative payloads. Resolve provider questions or identify what must be asked of Fidel. | Prepare local fixtures, environment templates and a secure test configuration; help configure the sandbox once access is available. | Required IDs, secrets and merchant/card enrollment mappings are available securely; refund behavior is verified before refund implementation. |
| **4. Build the Supabase database stage — APPLIED; LIVE REVIEWED** | Arrange a Docker/preview-branch full-history replay before milestone 9. | Keep the live role-detection verification recorded. | Reconciled migration history and applied the four Fidel migrations plus the role-detection correction. | Met for this stage; full-history replay remains a pre-pilot gate. |
| **5. Build the Fidel webhook — AUTH + CLEARING VERIFIED 2026-09-23; FIXTURE STAGE NEXT; REFUND GATED ON LIVE** | Before the fixture stage: create a dedicated test shopper account and choose a dedicated test shop (handoff steps A–C); approve three Playground/Dashboard actions. At go-live, replace all three webhook secrets with the Live-mode keys; the Test keys pasted into chat are an accepted risk until then. | Done: approved auth and clearing contracts; diagnosed the missing refund webhook. Next: review the fixture stage; design the refund reconciliation backstop (now required, since Fidel can’t be asked). | Next: fixture stage on the dedicated test account and shop (£6 auth, £5 auth crossing a £10 threshold, clearing). No refund leg; leave fixtures in place. | Auth and clearing: met. Fixture stage: spend, reward and clearing correct and isolated. Refund: one genuine live refund verified end to end before any real shopper links a card (pre-pilot gate). |
| **6. Handle refunds and protect redemption** | Confirm any new edge-case policy only if the plan does not already cover it. | Audit full/partial refunds, out-of-order events, consumed rewards and negative balances using worked examples. | Implement reviewed reconciliation and server-side redemption checks. Add the agreed customer explanation and recovery behavior. | Refund/redeem/concurrency tests pass; unsafe redemption cannot bypass the UI through an API. |
| **7. Connect the Fidel card-linking flow — DESIGN AGREED 2026-09-23 (product decisions P1–P7); CL-2 applied, CL-3 Edge Functions deployed and CL-4 app screens coded by Claude 2026-09-23 (test keys set; not yet built or run on a device); next: a native test build to run the CL-1 device checks; see `CARD_LINKING_PLAN.md` (build steps CL-1…CL-6)** | Try the sandbox enrollment flow when ready. Supply only test data supported by Fidel's sandbox. | Review how an enrolled card becomes securely associated with the signed-in user. | Integrate Fidel's SDK, persist the Card `id` through a server-verified flow, and implement agreed unlink behavior. | An enrolled test card maps to the correct user; a client cannot claim another user's card. |
| **8. Add immediate notification dispatch — spend/reward pushes DEPLOYED 2026-09-25 by Claude (immediate send after Fidel credits and manual entry; retry sweep still deferred)** | Test on a device with notifications enabled; confirm the wording is clear. | Review service authentication, exact notification selection, preferences, retries and duplicate handling. | Build the dedicated service-role `send-stamp-notification` function with immediate post-commit dispatch and durable recovery, per ARCH_PLAN.md §4.6. | Spend/reward notifications are dispatched within the agreed target; push failures never undo or duplicate awards. |
| **8a. Every shop spend-based; Fidel wherever it can work (added 2026-09-23, revised the same day; release-blocking; see `ARCH_PLAN.md` §0b). SWITCHOVER APPLIED 2026-09-25 by Claude without the Fidel-submission gate (product-owner decision T4, §4.11): every shop on £ tiers, stamp setup removed from both apps (OTA) and the website (deployed 2026-09-25). Fidel enrollment/Location tracking still to do.** | Keep the SumUp Solo for the live pilot, where SumUp matching is measured directly (no Fidel contact). Decide shortly before release what happens to the current test shops. | Research Fidel's Brands API and settle the brand mapping (§6a), including how Location status is stored and refreshed. Design manual spend entry (RPC, retailer amount UI, the daily limits) and the release cutover migration. | Build automatic enrollment plus a backfill, Location-status tracking, manual spend entry, required thresholds at shop setup, and the cutover migration. The cutover refuses to run unless every shop has a threshold, has been submitted to Fidel, and manual spend entry is live. It does **not** require an Active Location. | Every live shop has a threshold and has been submitted to Fidel. Staff can record any purchase as spend. Card-linked earning, and its badge, is on exactly for shops with an Active Location. The cutover has switched every shop to spend-based rewards. |
| **9. Run a complete sandbox pilot and burst test** | Perform the agreed customer/merchant acceptance scenarios and confirm they match the intended experience. | Review end-to-end evidence, financial correctness, security and remaining risks. | Test linking → payment event → stamps → notification → refund → redemption enforcement. Run agreed burst tests, monitor failures, fix issues and document results. | Acceptance checks and load tests pass; any remaining limitations are explicit. |
| **10. Prepare and release a limited live pilot** | Complete Fidel live onboarding and merchant enrollment; configure live secrets through secure settings. Authorize the concrete release when required and choose pilot merchants. | Review release readiness and any remaining architecture/security findings. | Prepare reviewed migrations, deployment configuration, monitoring and rollback instructions. Deploy within authorization, verify live integration and monitor the pilot. | Approved pilot works with real provider data, alerts/recovery are in place, and the handoff records deployment evidence. |

Claude reviews each major stage; Codex fixes findings before dependent stages proceed. Routine implementation details do not need your approval. Sandbox access and live provider onboarding are separate: local work can start before production credentials exist. Card linking and notification work may overlap after the database contract is stable, but the agents should not edit the same files simultaneously.

## Ready-to-send instructions

Each milestone has one instruction for Claude Code and one for Codex. Send the
instruction for the stage that is actually ready; the agents read these shared project
files directly, so no uploads are needed. The current stage is the implementation-defect review, so
use the copy-ready prompt at the end of `CLAUDE_HANDOFF.md`.

### 1A · Claude Code — architecture review (complete; reference only)

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md directly from this project. Complete milestone 1: review and correct the architecture before Codex implements it. Resolve the documented Fidel contract errors, carry/refund accounting, secure redemption and immediate-but-recoverable notifications. Preserve decisions we already confirmed; ask me only for missing product choices. Update the plan and handoff with your conclusions and the exact next task for Codex.

### 1B · Codex — implement reviewed architecture stage (complete; reference only)

> Read the latest project timeline, handoff and architecture plan from disk. Implement the next reviewed stage, run its checks, fix any failures, and update CLAUDE_HANDOFF.md after each completed item. Leave a concrete review request for Claude Code. Do not deploy to production as part of this instruction.

### 2A · Claude Code — rules and capacity

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Complete milestone 2: turn the confirmed loyalty rules into worked purchase, carry, full-refund, partial-refund and post-redemption examples. Define measurable burst, latency and notification-dispatch acceptance criteria; do not treat “unlimited” as a capacity target. Record the required product-owner inputs and the exact next Codex task in CLAUDE_HANDOFF.md.

### 2B · Codex — rules and invariants

> Read the latest project timeline, handoff and architecture plan from disk. Complete the Codex portion of milestone 2: translate the agreed accounting examples and capacity criteria into test cases and database invariants. Do not change production data or deploy. Update CLAUDE_HANDOFF.md after each completed item and leave Claude Code a concrete review request.

### 3A · Claude Code — Fidel sandbox contract

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Complete the Claude Code portion of milestone 3 once sandbox access is available: verify the subscribed event contract, card.id versus accountId, signature headers, decimal amounts and the real refund payload/correlation fields. Do not put credentials in project files. Update ARCH_PLAN.md and CLAUDE_HANDOFF.md with verified facts, unresolved provider questions and the exact next Codex task.

### 3B · Codex — sandbox test setup

> Read the latest project timeline, handoff and architecture plan from disk. Complete the Codex portion of milestone 3: prepare redacted local fixtures, environment-variable documentation and a secure sandbox test configuration. Never commit or paste Fidel credentials. Update CLAUDE_HANDOFF.md after each completed item and leave Claude Code a concrete review request. Do not deploy to production.

### 4A · Claude Code — database checkpoint 1 review (current)

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review milestone 4 checkpoint 1 in supabase/migrations/20260922171734_fidel_stamp_foundation.sql. Confirm the schema constraints, RLS and privilege boundary, redemption trigger behavior, refund idempotency key and missing-membership policy. Record approval or exact fixes in CLAUDE_HANDOFF.md. Do not approve checkpoint 2 until the migration is reviewed.

### 4B · Codex — database checkpoint 2

> Read the latest project timeline, handoff and architecture plan from disk. Only after Claude Code records checkpoint 1 approval, implement the next reviewed milestone 4 database checkpoint. Run applicable local database checks, fix failures, update CLAUDE_HANDOFF.md after each completed item and leave a concrete review request for Claude Code. Do not deploy to production.

### 5A · Claude Code — webhook review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review the next Fidel webhook checkpoint in isolation before implementation: raw-body handling, double-HMAC signature verification, timestamp tolerance, event validation, acknowledgement behavior and failure safety. Reconcile it with verified sandbox evidence. Update the plan and handoff with approval or precise fixes and the next Codex task.

### 5B · Codex — webhook implementation

> Read the latest project timeline, handoff and architecture plan from disk. After Claude Code approves the relevant webhook checkpoint, implement the Fidel webhook stage: raw-body verification, trusted mapping resolution, exact pence conversion and atomic event processing. Test invalid signatures, malformed payloads, retries, concurrent duplicates and unresolved mappings. Update CLAUDE_HANDOFF.md after each completed item, request Claude review and do not deploy to production.

### 6A · Claude Code — refund and redemption review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review the refund and redemption stage using verified sandbox payloads and worked examples. Audit full/partial refunds, out-of-order deliveries, consumed rewards, negative balances, block reasons and recovery. Record approval or exact fixes and the next Codex task in CLAUDE_HANDOFF.md.

### 6B · Codex — refund and redemption implementation

> Read the latest project timeline, handoff and architecture plan from disk. After review approval, implement the refund reconciliation and redemption-protection stage exactly to the verified provider contract. Add recovery behavior and tests for refunds, redemptions and concurrency. Update CLAUDE_HANDOFF.md after each completed item, leave Claude Code a concrete review request and do not deploy to production.

### 7A · Claude Code — card-linking review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review the Fidel card-linking design before implementation. Confirm that an enrolled Fidel Card id is associated to the authenticated user through a server-verified flow, that clients cannot claim another card and that unlink behavior is safe. Record approval or exact fixes and the next Codex task in CLAUDE_HANDOFF.md.

### 7B · Codex — card-linking implementation

> Read the latest project timeline, handoff and architecture plan from disk. After design approval and sandbox access, integrate Fidel card linking, persist the verified Fidel Card id, and implement the agreed unlink flow. Test authenticated ownership and cross-user claim prevention. Update CLAUDE_HANDOFF.md after each completed item, request Claude review and do not deploy to production.

### 8A · Claude Code — notification review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review the immediate notification-dispatch design: service authentication, exact job selection, preferences, retries, duplicate prevention and durable recovery. Confirm that a webhook cannot rely on an end-user JWT. Record approval or exact fixes and the next Codex task in CLAUDE_HANDOFF.md.

### 8B · Codex — notification implementation

> Read the latest project timeline, handoff and architecture plan from disk. After review approval, implement immediate stamp and adjustment notification dispatch with durable recovery. Test successful sends, retry behavior, duplicate prevention and failures that must not undo stamp awards. Update CLAUDE_HANDOFF.md after each completed item, request Claude review and do not deploy to production.

### 9A · Claude Code — sandbox pilot review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review the sandbox-pilot acceptance plan and test evidence across linking, payment, stamps, notification, refund and redemption. Evaluate financial correctness, security and agreed burst criteria. Record findings, required fixes and release prerequisites in CLAUDE_HANDOFF.md.

### 9B · Codex — sandbox pilot and burst test

> Read the latest project timeline, handoff and architecture plan from disk. Run the reviewed sandbox pilot and agreed burst tests end to end. Diagnose and fix failures, collect reproducible evidence and update CLAUDE_HANDOFF.md after each completed item. Leave Claude Code a concrete final review request. Do not deploy to production.

### 10A · Claude Code — live-pilot readiness review

> Read IMPLEMENTATION_TIMELINE.md, CLAUDE_HANDOFF.md and ARCH_PLAN.md from disk. Review limited live-pilot readiness: approved migrations, secrets configuration, observability, alerts, rollback and unresolved financial/security risks. Record a clear go/no-go recommendation in CLAUDE_HANDOFF.md. Do not deploy or authorize a release on the product owner’s behalf.

### 10B · Codex — live-pilot preparation

> Read the latest project timeline, handoff and architecture plan from disk. Prepare the reviewed limited live-pilot release: deployment configuration, monitoring, rollback instructions and final validation evidence. Do not deploy until the product owner explicitly authorizes a concrete release. Update CLAUDE_HANDOFF.md after each completed item and leave Claude Code a concrete readiness review request.

Neither agent automatically wakes the other. Send the relevant instruction after the
previous review gate is complete; if an agent is editing a shared file, let that edit
finish before the other agent starts.

## Architecture corrections to carry into milestone 1

- Use Fidel Card `id` / transaction `card.id` as the card identity, not provider `accountId`.
- Use Fidel's documented double HMAC-SHA256 with Base64 at each pass, signed raw body + registered URL + timestamp.
- Convert Fidel major-unit decimal amounts exactly into integer pence; do not treat `12.50` GBP as 12 pence.
- Verify refund event IDs and `originalTransactionId` correlation; do not assume auth, clearing and every refund share one ID. Define event routing and subscription secret handling explicitly.
- Reconcile carry with refunds and threshold changes so refunded spend cannot leave unearned stamps. Audit reward issuance/consumption and grant-size constraints in the existing engine.
- Protect privileged RPCs and enforce redemption rules on the server, not only the screen.
- Design durable reprocessing for unknown mappings and failed notification dispatch. The current push function requires merchant/staff user authentication and selects only the latest pending notification; it needs adaptation for reliable server dispatch.
- Set a measurable peak and notification-dispatch target. Capacity, provider throttling and device delivery remain real constraints.

These corrections reflect earlier verification in this conversation. Claude must verify provider-specific details against current official documentation and available sandbox evidence before finalizing the implementation contract.

## Keeping this artifact current

`ARCH_PLAN.md` owns the design. `CLAUDE_HANDOFF.md` owns current work, checks, blockers and the exact next action. This timeline owns milestone order and responsibilities. After each completed work item, update the handoff; update this timeline when a milestone completes or its scope/order changes. Preserve the other agent's work and do not create a separate changelog for this workflow.

## Fidel policy release dependency (23 September 2026)

Codex completed the local policy-copy update: six regenerated PDFs, web Help
privacy/deletion wording and versioned new web acceptance records. See
`legal/README.md` for review items. Before merchant enrolment under milestone 8a,
record acceptance of the new merchant permission; before live card linking,
verify SDK consent, unlink/deletion and the provider data-processing contract.
The product owner still confirms legal entity/contact information. Claude reviews
the wording and operational fit; publication completed on Vercel (e07e648), with all six live PDFs verified. The
web acceptLegal helper is currently unused; recording acceptance is still a
release dependency. Existing
backend milestone order and gates remain unchanged.
