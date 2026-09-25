# ARCH_PLAN.md — Fidel Card-Linked Reward Engine

Architecture spec for the real-time, card-linked reward system. Author: Claude (Master
Architect). Implementer: Codex, against this document. Provider: **Fidel API**
(https://fidelapi.com). Stack decision and all open design questions below were
confirmed with the product owner on 2026-09-22 — see "Confirmed decisions." **Renamed
from "Stamp Engine" the same day** — see §0a: the reward model moved from discrete
stamps to a cumulative spend threshold, platform-wide.

## 0. Why this fits into the existing schema, not beside it

**Historical stamp proposal below is superseded by §0a.** The production Fidel
path now inserts spend transactions; the existing stamp trigger stays available
only for businesses explicitly using the legacy model.

This repo already runs a working stamp/reward engine on Supabase Postgres:

- `businesses` (has `loyalty_config jsonb`, currently `{"stamps_required": N}`)
- `memberships` (`stamp_count`, `points_balance`, one row per user+business)
- `transactions` (`type` enum incl. `'stamp'`, `value integer check (value > 0 and value <= 50)`)
- `public.handle_stamp_transaction()` — `AFTER INSERT` trigger on `transactions` where
  `type = 'stamp'`: locks the membership row (`FOR UPDATE`), walks reward-catalog tiers
  or the legacy single-threshold config, increments `stamp_count`, inserts `rewards`
  and `notifications` rows.
- `notifications` + `send-user-push` Edge Function — push dispatch, gated by
  `user_settings.notify_stamps`.

**Original decision: reuse this pipeline for stamp *grants*.** The Fidel webhook
handler would compute how many stamps a transaction earns and insert a row into
`public.transactions` (`type = 'stamp'`) — the existing trigger does the rest (tier
logic, reward issuance, notification row).

**Superseded by §0a (2026-09-22):** the reward model changed from stamp counts to a
cumulative spend threshold, for every business — not deleting `handle_stamp_transaction`
(hide, don't delete), but the Fidel webhook now feeds a **new**, parallel trigger,
`handle_spend_transaction` (§4.3), on a **new** `transactions.type = 'spend'`, mirroring
this same pipeline's structure (lock → threshold logic → reward issuance → notification
row) rather than reusing the stamp-specific one. The core lesson below still holds,
just against the new trigger instead:

**Conflict this surfaces:** a stamp/reward-granting trigger only supports *positive*
grants by construction. Our confirmed refund-clawback design (§4.3/§4.4) needs to
*decrease* a balance, sometimes below zero. That cannot go through the same
INSERT-triggered path used for grants. §4.4 defines a separate clawback function that
does not reuse either trigger.

## 0a. Reward model pivot: spend-threshold replaces stamps (2026-09-22)

**Decision**: the discrete "stamp" concept is replaced, for every business, by a
**cumulative spend-threshold** model — a business sets one £ amount a customer must
spend in total (across any number of visits, any size purchase) to earn one reward.
There's no longer a "how many pence per stamp" calculation, no per-transaction stamp
count, no carry-pool math — just a running pence balance compared against a threshold.
This resolves the earlier per-visit/per-amount inconsistency directly: there's only
one rule now, and both manual entry and Fidel use the same arithmetic.

**Hide, don't delete**: the existing stamp system (`memberships.stamp_count`,
`reward_catalog.stamp_threshold`, `businesses.loyalty_config`'s `stamps_required`, the
`handle_stamp_transaction` trigger) is **not removed or repurposed** — it's real,
shipped functionality with real customer data in it. Everything below is **additive**:
new columns and a new trigger sit alongside the old ones. A `businesses.reward_model`
flag controls which system is active per business. **Decided 2026-09-22, reversing an
earlier default**: this defaults to `'stamp_legacy'`, not the new model — flipping
every business to spend-threshold on day one would silently break manual staff
stamping for every business not yet Fidel-enrolled (the manual entry UI still inserts
the old kind of record, which the new model doesn't read). A business moves to
`'spend_threshold'` deliberately, tied to actual Fidel enrollment (§6a) or once manual
entry is adapted — never as a platform-wide default flip.

**What this does NOT change**: card linking (§1 #7), merchant resolution (§1 #6),
idempotency (§1 #5), currency (§1 #8), stack (§1 #9), notification approach (§1 #10),
signature verification (§2), amount conversion (§4.1a), or server-side redemption
enforcement (§4.4a) — all of that is unaffected by what "balance" actually represents.
**What this does change, superseding earlier sections**: §3.3's carry-pool design
(`pool_pence_in`/`pool_pence_out`, `pending_pence`), §4.3's pence-per-stamp math, the
>50-stamp chunking problem (§4.3's correction — moot, there's no discrete stamp cap to
hit), and §4.9's per_visit/per_amount toggle (moot — the new model is uniformly
amount-based, there's only one mode). Those sections are marked superseded below rather
than deleted, so the reasoning that led here stays visible.

**Not built here — flagged as future work, not guessed**: tiered spend rewards (the
old system supports multiple reward tiers via `reward_catalog`; the new model as
described is a single repeating threshold — "cross £30, get a reward, repeat"). If
multiple different rewards at different spend levels are wanted later, that's a
`reward_catalog`-equivalent for the spend model, not designed now.

## 0b. Release scope: every shop spend-based at release; Fidel wherever it can work (2026-09-23, revised the same day)

**Product owner decisions (2026-09-23):**
- **Every shop is enrolled with Fidel by release.** Today's shops are all test shops.
  **Revised later on 2026-09-23 (product owner):** every shop is still *submitted* to
  Fidel automatically. But an Active Fidel Location is no longer a release requirement,
  because payment-facilitator shops (SumUp, Square, Zettle) may never become matchable
  (see item 5). Card-linked earning switches on per shop once that shop's Location is
  Active **and** real payments have been seen to match. Until then, and permanently for
  shops Fidel can't isolate, staff record purchases through manual spend entry (item 2).
  There is one reward model for everyone. No shop is sent back to stamps, and the rule
  never depends on the shop's card-machine provider.
- **Every shop runs `reward_model = 'spend_threshold'` at release.** The stamp system
  stays in the schema, switched off, per §0a's hide-don't-delete rule. Letting each shop
  choose was offered and declined.
- **What happens to the current test shops** (replace, or keep and correct their details)
  is deferred until shortly before release.

**Why the `'stamp_legacy'` default stays for now:** it only protects against switching
shops before staff can record a spend by hand (the manual path still inserts `'stamp'`).
It is not a product choice. It changes as part of the release cutover below, not before.

**What this makes release-blocking (previously optional follow-up work):**
1. **Automatic Fidel enrollment (§6a), plus a backfill.** Every approved shop gets a
   Fidel Location automatically. Any shop that exists at release and has no Location is
   backfilled by the same function. The §6a Brand-mapping question must now be answered,
   from Fidel's Brands API docs, before building.
2. **Manual spend entry.** Staff need a server-validated way to record a cash or
   unlinked-card payment as `'spend'`. Today only the service role can insert `'spend'`
   (checkpoint 1), and the retailer app only has "add a stamp". This needs its own design
   pass: an RPC, the retailer amount-entry UI, and CARD_LINKING_PLAN P5's per-day limits.
   It doesn't exist yet.
3. **A threshold for every shop.** `reward_threshold_pence` becomes required at shop
   setup, and every shop has one before cutover. The spend trigger already rejects a
   missing threshold at transaction time.
4. **A release cutover migration**, run only once items 1–3 are live. It sets every
   business to `'spend_threshold'` and changes the column default to `'spend_threshold'`.
   It must refuse to run if any business lacks a threshold, or if manual spend entry
   isn't live. **Revised 2026-09-23:** it no longer requires an active Fidel Location.
   Every shop must have been *submitted* for enrollment (a Location exists, or an
   enrollment failure is recorded for follow-up), but an Idle, Syncing or Not-found
   Location doesn't block release.
5. **Fidel go-live lead time — partly verified 2026-09-23.**
   - Per Fidel's MID management docs (https://docs.fidelapi.com/docs/select/mid-management),
     a Location only receives transactions once its card-network merchant IDs are linked.
   - These are handled as **MID requests** that go Pending → Processing → Successful or
     Failed, and "typically take up to 7 days to complete due to card network
     constraints."
   - The docs list where MIDs can come from: Fidel looking them up through the card
     networks; the merchant providing them; the payment processor or acquirer (Stripe and
     Adyen are named); a third-party service; or actual transaction data.
   - Each network uses its own identifiers: Visa uses acquiring MID, BIN, VMID and VSID;
     Mastercard uses acquiring MID and location ID; Amex uses an SE number, which can be
     sent when a Location is created (API only).
   - **Verified from Fidel's locations docs and FAQ (2026-09-23)** — this corrects
     Claude's earlier "supplying a MID probably doesn't speed it up":
     - Location statuses are Idle, Syncing, Active and Not found, and "Location Sync can
       take 1-2 weeks."
     - "Adding MIDs during Location creation will speed up the onboarding process."
       Providing a MID "can also reduce the onboarding of the merchant to a single day."
       Per network: Visa typically about 1 day; Mastercard up to 10 business days.
     - **Consent:** a Location must belong to a Brand whose consent status is declared
       before its Locations can be created. The widely used option is **auto-approve**,
       where we set the brand's consent to approved ourselves. §6a's silent enrollment
       therefore works technically. **But auto-approve means we are asserting each
       shop's consent, so the merchant terms must include that consent.** That's legal
       wording, owned by the product owner.
     - **Payment facilitators (Square, SumUp, iZettle/Zettle, Toast, Clover):** Fidel
       says they "may be using shared merchant IDs that have an impact on how
       transactions are monitored", and that shared MIDs "do not always have unique
       identifiers which are necessary to differentiate which merchant locations the
       transactions were made at." Merchants on these often can't see their MIDs.
       Fidel asks to be contacted about such merchants. **Coverage is per shop and not
       guaranteed.**
     - **Phone wallets:** "Fidel can track spend through digital wallets as long as the
       full PAN from the front of the card is enrolled." A virtual card number enrolled
       instead can't be tracked. CARD_LINKING_PLAN's copy must tell shoppers to enter
       the number from the front of their physical card.
     - **Ownership:** Fidel's loyalty business (platform, customers and the Fidel brand)
       was sold to Enigmatic Smile on 2024-04-25. The original company became Astrada.
       The docs and tooling we use are that business, and still actively developed.
     - **Pricing is not published.** The relevant product is **Select Transactions**,
       not Offers as a Service; we run our own reward logic.
   - **Consequences:**
     - ~~the release cutover (item 4) must check that each shop's Location is **Active**~~
       (withdrawn 2026-09-23; see item 4). Instead, the app's "earns automatically" check
       must use Location status: only **Active** Locations count, never merely created
       ones. The §6a enrollment design must store and refresh that status;
     - collect the shop's payment provider and MID (or Amex SE number) at shop signup,
       optionally, and pass them at Location creation — this is the documented way to
       cut onboarding from 1–2 weeks to about a day;
     - register real shops at least 2–3 weeks before release, because Mastercard can
       take up to 10 business days;
     - merchant terms need a consent clause before enrollment goes live;
     - in the pilot, measure the real match rate for shops on each payment provider,
       especially Square, SumUp and Zettle.
   - **Unknown, and to be answered by our own evidence (the product owner can't
     contact Fidel, 2026-09-23):**
     - pricing and minimums;
     - how well Fidel isolates individual Square, SumUp and Zettle shops, measured
       per shop in the live pilot; manual spend entry covers any shop that doesn't match;
     - whether supplied MIDs also speed up Mastercard, measured from Location status
       timings.

**Knock-on for card linking (CARD_LINKING_PLAN.md):** the "⚡ earns automatically" badge and
the enrolled-shop prompt apply **only to shops whose Fidel Location is Active** (revised
2026-09-23). That may be well short of every shop, where payment-facilitator shops can't
be isolated. The per-shop check (`card_linked_business_ids()`) is therefore essential,
not a formality, and it must be based on Active status (see the consequences above). During rollout a shop's
Fidel Location may still be pending, and the check stops the app from promising
automatic earning where it won't happen yet.

**Unchanged:** manual entry stays available for cash and unlinked cards (CARD_LINKING_PLAN
P5). An enrollment failure still never blocks a shop from being approved (§6a point 4).
Enrollment becomes a release criterion, not a runtime gate.

## 1. Confirmed decisions (from planning discussion, 2026-09-22)

| # | Decision |
|---|---|
| 1 | Credit cumulative spend progress on `transaction.auth` (real-time). Claw back on `transaction.refund`. |
| 2 | Spend above a reward threshold carries forward in `memberships.reward_progress_pence`. |
| 3 | Refund clawback: **negative balance allowed, redemption blocked while negative**, with a customer-facing reason shown in-app (not just "redemption unavailable"). |
| 4 | Partial refunds: **proportional** — reduce progress by the exact refunded pence on every distinct, correlated refund event. |
| 5 | Idempotency key: unique on **`(fidel_transaction_id, event_type)`**. Fidel documents refund transactions with their own `id` and an `originalTransactionId` when matched; the refund `id` identifies its delivery, and `originalTransactionId` links the purchase. |
| 6 | Merchant resolution: match incoming `location.id` → our stored Fidel location id. **Do not** resolve by `identifiers.MID` (network-assigned, not guaranteed unique/stable, no audit trail we control) — store it for support/audit only. |
| 7 | Card linking: via **Fidel's own card-linking flow/SDK**. We store Fidel's `card.id` as the `linked_cards` resolution key (corrected 2026-09-22 — see §2; `accountId` is retained only as an audit field). We do not manage card tokens/PANs ourselves. |
| 8 | Currency: **GBP/pence only.** No multi-currency support in this schema yet. |
| 9 | Stack: **Supabase** (Postgres + Deno Edge Function), reusing existing auth and RLS. Capacity and delivery latency must pass the measured §8 target; no unlimited-throughput claim is made. |
| 10 | Notifications: a service-role `send-stamp-notification` function dispatches immediately after commit, with a durable retry sweep (§4.6). |

## 2. Fidel API facts this plan relies on

**Current evidence, 2026-09-25:** signed Test-mode auth and positive clearing have
been verified against their own registered URLs/secrets, and the first automatic
test-account credits are recorded. No genuine refund or negative-clearing delivery
has been verified. Missing delivery is unexplained; do not assert that Test mode
cannot emit refunds. See the latest handoff and independent implementation review.

**Read-only sandbox observation (2026-09-22):** an existing authorization in the
account's Demo Program displayed a bare transaction object with GBP amount in
major units, separate accountId and card.id, and location.id. The Loyalty Loop
test Program itself has no location yet and only an authorization webhook
subscription to an external test collector. This is not a signed delivery
vector for the planned Edge Function, and does not verify refund behavior.

Sourced from https://docs.fidelapi.com/docs/select/webhooks and
https://docs.fidelapi.com/docs/webhooks, **re-verified 2026-09-22** after milestone-1
review caught errors in the first pass (see §2.1). Re-verify against Fidel's current
docs before implementation regardless — APIs change and these excerpts are not the full
reference:

- **Signature headers:** `x-fidel-signature` (double HMAC-SHA256, base64-encoded at
  each pass — see exact construction below), `x-fidel-timestamp`. Also
  `fidel-message-id` (stable per logical event across retries) and
  `fidel-attempt-number`.
- **Signature construction (verbatim from Fidel's docs, corrected 2026-09-22):**
  1. Concatenate: raw request body + registered webhook URL + `x-fidel-timestamp`
     header value, in that order, no separators.
  2. **Hash that string twice** with HMAC-SHA256 using the webhook's `secretKey`,
     base64-encoding the result **at each pass** (hash → base64 → hash again → base64).
  3. Compare the final value against `x-fidel-signature` using a constant-time
     comparison.
  Our first draft of this plan specified a *single* HMAC pass — that was wrong and
  would have rejected every genuine Fidel webhook. Codex's review caught this; verified
  independently against Fidel's docs before accepting the correction.
- **Retries:** up to 3 attempts (immediate, +1 min, +2 min). Must ack 2xx within 20s.
- **Event types relevant here:** `transaction.auth`, `transaction.clearing`,
  `transaction.refund` (also `*.qualified` variants tied to Fidel's own offers engine,
  which we are not using — **ignore `.qualified` events**, act only on the base event
  type).
- **Transaction object fields, corrected:**
  - `id` — the identifier of this transaction event. Fidel's current Transactions
    and Webhooks docs show a refund as a distinct transaction with a negative
    `amount` and an `originalTransactionId` pointing to the purchase when the
    provider can match it. If Fidel cannot match it, that field is absent. A refund
    also emits a negative `transaction.clearing` event with `auth: false`; this
    must not be treated as a positive purchase clearing or clawed back twice.
    Confirm the exact sandbox delivery shape before enabling refund processing.
  - `amount` — **a decimal major-unit number (e.g. `5.44` for £5.44), not integer
    pence.** Refund events use a **negative** amount. Convert the raw numeric token
    exactly to signed integer pence; require a positive amount for authorizations and
    a negative amount for refunds. See §4.1a.
  - `card.id` — a distinct field inside the nested `card` object. **This, not
    `accountId`, is the identifier we resolve a linked card by** (see below).
  - `accountId` — present on the transaction, but evidence from Fidel's own docs
    describes it as identifying *our* Fidel platform account, not the customer's
    specific card. Using it as a per-customer resolution key (our first draft's
    assumption) risks resolving transactions to the wrong customer, or failing to
    distinguish customers at all. **Corrected: resolve by `card.id`; retain `accountId`
    only as an audit/support field, never for identity resolution.**
  - Also present: `currency`, `auth`/`cleared` (booleans), `card.{lastNumbers,scheme}`,
    `location.id`, `identifiers.MID`, `programId`, `created`, `updated`.

### 2.1 What changed in this review pass (2026-09-22, milestone 1)

Codex's independent review (`IMPLEMENTATION_TIMELINE.md`) flagged the signature
algorithm, amount units, and card identity field as likely wrong, plus the refund
correlation assumption as unverified. I re-fetched Fidel's docs directly rather than
accepting the correction on trust: signature and amount-units are now confirmed correct
above; card identity is corrected on the strength of the evidence found (see above) but
should still be spot-checked against a real sandbox payload alongside the refund
question. The rest of this document (schema in §3, event lifecycle in §4, points math
in §5) has been updated to match. Decisions #1–#6, #8–#10 in §1 are unaffected — they
were product/business decisions, not provider-fact assumptions, and are preserved.

## 3. New schema

All new tables live in `public`, follow existing repo conventions (uuid PKs via
`gen_random_uuid()`, `created_at`/`updated_at` + `set_updated_at` trigger, RLS enabled,
service-role-only writes for anything the webhook touches).

```sql
-- 3.1 Linked payment cards (Fidel card-linking output)
-- Corrected 2026-09-22: resolution key is `card.id`, not `accountId` (see §2/§2.1).
create table public.linked_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fidel_card_id text not null unique,               -- Fidel's `card.id` — resolution key
  fidel_account_id text,                             -- Fidel's `accountId` — audit/support only, NOT unique, NOT used for resolution
  card_scheme text,                                -- visa / mastercard, from Fidel
  last_numbers text,                                -- last 4 digits, display only
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,                          -- soft revoke; keep row for audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One active card -> one user. Fidel card ids are globally unique per their docs;
-- enforce it at the DB level regardless (rule 4 of the project's core engineering rules).

-- 3.2 Merchant <-> Fidel location mapping (extends `businesses`, doesn't replace it)
create table public.business_fidel_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  fidel_program_id text not null,
  fidel_location_id text not null unique,           -- resolution key (decision #6)
  fidel_mid text,                                    -- audit/support only, NOT used for resolution
  created_at timestamptz not null default now()
);
create index business_fidel_locations_business_id_idx on public.business_fidel_locations(business_id);

-- Reward-model config (§0a) — additive columns on `businesses`, existing
-- `loyalty_config`/`loyalty_type`/stamp columns untouched, left dormant per-business:
alter table public.businesses
  add column reward_model text not null default 'stamp_legacy'
    check (reward_model in ('spend_threshold', 'stamp_legacy')),
  add column reward_threshold_pence integer
    check (reward_threshold_pence is null or reward_threshold_pence > 0);
-- reward_threshold_pence is required (not null) whenever reward_model = 'spend_threshold'
-- — enforced at the application layer during business setup, not a DB constraint here,
-- since a business mid-onboarding may not have set it yet. Codex should validate this
-- before allowing a business to go live with reward_model = 'spend_threshold'.

-- 3.3 Per-Fidel-transaction running state (idempotency + proportional refund math).
-- Superseded from the original pence-per-stamp design (§0a): no carry-pool columns —
-- the spend-threshold model's `memberships.reward_progress_pence` (§3.5) already
-- carries any remainder past a threshold crossing, so there's nothing separate to pool.
create table public.fidel_transactions (
  id uuid primary key default gen_random_uuid(),
  fidel_transaction_id text not null unique,        -- Fidel's stable `transaction.id`
  business_id uuid not null references public.businesses(id),
  linked_card_id uuid not null references public.linked_cards(id),
  user_id uuid not null references auth.users(id),  -- denormalized for fast lookups
  original_amount_pence integer not null check (original_amount_pence >= 0),
  total_refunded_pence integer not null default 0 check (total_refunded_pence >= 0),
  progress_credited_pence integer not null default 0, -- net pence this txn has contributed to reward_progress_pence (can go negative via refund clawback)
  status text not null default 'authorized'
    check (status in ('authorized', 'cleared', 'refunded', 'partially_refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fidel_transactions_refund_not_exceed_original
    check (total_refunded_pence <= original_amount_pence)
);
create index fidel_transactions_linked_card_id_idx on public.fidel_transactions(linked_card_id);

-- 3.4 Webhook delivery idempotency ledger
create table public.fidel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  fidel_message_id text not null,                   -- stable per logical event, across retries
  fidel_transaction_id text not null,
  event_type text not null,                          -- 'transaction.auth' | 'transaction.clearing' | 'transaction.refund'
  received_at timestamptz not null default now(),
  constraint fidel_webhook_events_txn_event_key unique (fidel_transaction_id, event_type)
);
-- Deliberately NOT unique on fidel_message_id alone: a retried delivery of the SAME
-- event carries the same message id AND lands on the same (transaction_id, event_type)
-- pair, so the composite constraint already absorbs pure retries. A second, distinct
-- event_type for the same transaction is allowed through, per decision #5.
```

```sql
-- 3.5 Spend-threshold progress + redemption hold (extends `memberships`).
-- Superseded from the original carry-pool design (§0a) — `reward_progress_pence` IS
-- the balance now, not a side pool; it can go negative via refund clawback, same
-- semantics as the old `stamp_count` clawback, just in pence. `stamp_count` itself is
-- untouched — dormant, not deleted, per the hide-don't-delete decision (§0a).
alter table public.memberships
  add column reward_progress_pence integer not null default 0,
  add column redemption_blocked_reason text;
```

RLS: all four tables are written only by the Edge Function's service-role client
(bypasses RLS). Add `select`-only policies mirroring `memberships`
(`user_id = auth.uid()` / business owner / admin) so the shopper and retailer apps can
read `linked_cards` and `business_fidel_locations` respectively. No `insert`/`update`
policies for `authenticated` — card linking and merchant mapping are written by
trusted server-side flows (the Fidel linking callback, merchant onboarding admin flow),
not directly by client apps.

## 4. Webhook lifecycle — `POST /functions/v1/fidel-webhook`

New Edge Function, `supabase/functions/fidel-webhook/index.ts`, modeled on the existing
`whatsapp-webhook` function's structure (raw-body signature verification before JSON
parsing, `Deno.serve`, `admin` service-role client).

### 4.1 Request handling
**Provider verification (2026-09-22):** Fidel's current official webhook examples
show a bare transaction object for `transaction.auth`, `transaction.clearing`
and `transaction.refund`; they do not show an `event` property in those
payloads. Each webhook subscription has its own `secretKey`. The event type must
therefore come from the registered, signed webhook URL (for example distinct
`?event=transaction.auth` and `?event=transaction.refund` URLs served by the
same Edge Function) or another provider-confirmed delivery field. Do not infer the
type from `auth`/`cleared` booleans alone: a refunded transaction also emits
a negative clearing event. Use the exact registered URL and its own subscription
secret in the signature check. Verify the configured URL/subscription pairing in
the sandbox before processing any live transaction.

**Route selection (revised 2026-09-23, see `CLAUDE_HANDOFF.md` "Route-selection
design review"):** never compare `request.url` with the registered URL. Supabase
strips `/functions/v1` before the function runs, so the two strings never match. The
request's single `event` query value (`auth`, `clearing` or `refund`, exact lower
case) only chooses a server-side entry. That entry supplies the event type, the
registered URL and the secret. The configured registered URL must be canonical https,
and its query must be exactly `?event=<the same value>`. Otherwise the route counts as
unconfigured. The query value is never used as the event type. A request is accepted
only if its signature verifies. The signature covers the configured URL, which names
the event, and uses that event's own secret.

**Verified 2026-09-23 (auth only):** a genuine Fidel Test-mode `transaction.auth` delivery verified.
Fidel signs `raw body + registered URL including ?event=auth + x-fidel-timestamp`, where the
timestamp is 13-digit milliseconds, with that webhook’s own key. The body is a bare transaction
object that `transaction.ts` accepts.

**Clearing verified the same way (2026-09-23):** a genuine Test-mode clearing verified on
its own URL and key. It reuses the auth `id`, with `auth=true` and `cleared=true`.

**Refunds are NOT verified.** Test mode sent no refund or negative-clearing webhook for a
negative test transaction. The Test API's refund object carried `originalTransactionId`
set to the auth id, but that isn't delivery evidence. **Pre-pilot gate:** one genuine
live refund must be verified end to end (signed `?event=refund` delivery, correlation,
clawback) before any real shopper links a card. See `CLAUDE_HANDOFF.md` "Clearing/refund
contract review (2026-09-23, 17:40 UTC)".

1. Reject non-`POST` (405).
2. Read raw body via `request.text()` — **must** happen before any JSON parsing; the
   signature is computed over the raw bytes, not a re-serialized object.
3. Verify `x-fidel-signature` per §2's **double**-HMAC construction (corrected
   2026-09-22 — see §2.1): `base64(HMAC_SHA256(secretKey, base64(HMAC_SHA256(secretKey,
   rawBody + webhookURL + timestamp))))`, constant-time compare (mirror the existing
   `crypto.subtle` pattern already in `whatsapp-webhook`, but apply the HMAC step
   twice with a base64 encode after each pass — a single-pass implementation will
   reject every genuine Fidel webhook). Reject with 401 on mismatch, *without* touching
   the database.
4. Check `x-fidel-timestamp` within 5 minutes of now; reject stale/future requests (401).
5. Parse JSON. Validate required fields exist and are the expected types (`id`,
   `amount`, `currency`, `card.id`, `location.id`, signed URL event type) — reject malformed
   payloads (400) before touching the DB. **Never trust payload data before this
   validation passes** (core rule #6). Note `card.id` replaces `accountId` here per §2.

### 4.1a Amount conversion (decimal → integer pence, corrected 2026-09-22)

`amount` arrives as a **decimal major-unit number** (e.g. `5.44`), not integer pence —
see §2. Converting it without floating-point arithmetic (core rule #1):

Refunds carry a negative amount (e.g. `-5.44`). The converter must accept a
leading minus sign and return signed pence; the event handler checks the expected
sign and uses the refund magnitude for clawback.

Read the top-level `amount` number token from the signed raw JSON and pass it to
`supabase/functions/fidel-webhook/amount.ts`. The token reader ignores nested
`amount` fields and rejects duplicate top-level keys. The converter uses BigInt,
accepts a leading minus for refunds, rejects more than two decimal places and enforces
the PostgreSQL integer range. Do not use `Math.round(amount * 100)` as a fallback;
that would reintroduce floating-point monetary arithmetic.

### 4.2 Idempotency + resolution (single DB transaction from here on)

**2026-09-25 review correction required:** steps 7–9 below describe the original
implementation, not a complete lifecycle contract. Requiring an active card for
every event loses clearing/refund correlation after unlink/relink; new Location
status is also not enforced by the award RPC. R1–R4 in
`docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md` require a reviewed distinction
between eligibility for new awards and historical purchase adjustments. Claude
must specify that repair before implementation; do not weaken historical ownership
checks or claim the current code is safe merely because the original suites pass.

6. Insert into `fidel_webhook_events (fidel_message_id, fidel_transaction_id, event_type)`.
   On unique-violation (`23505`) on `(fidel_transaction_id, event_type)`: this exact
   event was already processed — return 200 immediately, do nothing else. This is the
   DB-enforced idempotency guarantee (core rule #4/#5) — not just an application-level
   check.
7. Resolve merchant: `business_fidel_locations` by `location.id`. Not found → log,
   return 200 (ack so Fidel stops retrying) but do **not** process further; this is an
   "unknown merchant" case that needs alerting, not a retry loop.
8. Resolve customer: `linked_cards` by `fidel_card_id = card.id` (corrected 2026-09-22
   — not `accountId`, see §2) where `unlinked_at is null`. Not found → same treatment
   as unknown merchant (ack, log, alert; do not retry-loop a webhook for a card we
   don't recognize).
9. Resolve/lock the customer's `memberships` row for `(user_id, business_id)`
   `FOR UPDATE` — same locking pattern `handle_stamp_transaction` already uses, extended
   to cover the new balance math in this handler.

### 4.3 Per-event-type processing (rewritten 2026-09-22 for the spend-threshold model, §0a)

**Prerequisite — new `transactions` machinery** (touches the existing, shipped
`transactions` table; additive, does not affect the `type = 'stamp'` path used by
`stamp_legacy` businesses):
- Add `'spend'` to the `transaction_type` enum (`alter type transaction_type add value
  'spend'`). **Postgres sequencing note for Codex**: a newly added enum value can't be
  used in the same transaction/migration statement that adds it on all supported
  Postgres versions — sequence this as its own migration step before anything
  references `'spend'`.
- The existing `transactions.value` check (`> 0 and <= 50`) was sized for stamp counts,
  not pence — a real purchase can easily exceed 50p. Replace it with a type-conditional
  check: `check ((type != 'spend' and value > 0 and value <= 50) or (type = 'spend' and
  value > 0))`.
- The existing owner/staff transaction INSERT policy must exclude `type='spend'`.
  Otherwise a merchant browser client could fabricate arbitrary pence and mint
  rewards through the new trigger. Only the service-role webhook may insert
  `spend` until a separate, server-validated manual spend path is reviewed.
- New trigger `handle_spend_transaction`, `AFTER INSERT ON transactions WHERE type =
  'spend'`, mirroring `handle_stamp_transaction`'s structure (lock membership `FOR
  UPDATE`, same visit-count/last-activity bookkeeping) but with pence-threshold logic
  instead of stamp-tier logic:
  ```sql
  _threshold := (select reward_threshold_pence from businesses where id = new.business_id);
  -- defensive: reward_threshold_pence must be set for a reward_model='spend_threshold'
  -- business; raise if null rather than silently never issuing a reward.
  _new_progress := _membership.reward_progress_pence + new.value;
  if _new_progress >= _threshold then
    insert into rewards (user_id, business_id, title) values (new.user_id, new.business_id, 'Free reward');
    insert into notifications (user_id, business_id, kind, title, body)
      values (new.user_id, new.business_id, 'reward', 'Reward earned!', 'Free reward is ready to redeem.');
    _new_progress := _new_progress % _threshold;  -- remainder carries forward, same modulo semantics the legacy single-threshold stamp mode already uses
  else
    insert into notifications (...) values (..., 'stamp', 'Progress updated', 'You are £' || to_char((_threshold - _new_progress) / 100.0, 'FM999999990.00') || ' away from your next reward.');
  end if;
  -- clear a stale block if this grant brought the balance back to >= 0 (see §4.4)
  if _new_progress >= 0 then update memberships set redemption_blocked_reason = null where id = _membership.id; end if;
  update memberships set reward_progress_pence = _new_progress, visit_count = visit_count + 1, last_visit_date = ..., last_activity_at = now() where id = _membership.id;
  ```
  (Sketch, not final code — Codex implements against this logic, matching the existing
  `handle_stamp_transaction` function's exact conventions for locking/timestamps.)

**`transaction.auth`** (progress grant):
- Convert `amount` to `amount_pence` per §4.1a — **not** the raw decimal value.
- Upsert `fidel_transactions` (new row, `status = 'authorized'`, `original_amount_pence
  = amount_pence`, `progress_credited_pence = amount_pence`).
- Insert `public.transactions (user_id, business_id, membership_id, type='spend',
  value=amount_pence, note='fidel:auth:<fidel_transaction_id>')`. `handle_spend_transaction`
  fires automatically (reward issuance, notification row) — **no chunking/cap problem**
  here, unlike the old per-stamp design: there's no discrete unit being capped, just an
  integer pence amount, so the >50 issue from the original stamp-based draft doesn't
  apply to this model at all.
- Skip the insert only if `amount_pence = 0` (a zero-value verification auth is
  a no-op, not an error).
  Record its event in `fidel_webhook_events` first, then return a 200
  `ignored_zero_amount` result without resolving mappings or changing balances.

**`transaction.clearing`**: per decision #1, progress was already granted at `auth`.
Clearing does not re-grant. Update `fidel_transactions.status = 'cleared'` only, for
audit/reporting. If `clearing.amount != auth.amount` (rare, e.g. tip adjustment) — flag
as an unresolved provider edge case; this plan does not invent reconciliation logic for
amount drift between auth and clearing. Log a warning row for manual review rather than
silently adjusting progress. A negative clearing event with `auth: false` is part
of a refund and must never mark the original purchase cleared or trigger a second
clawback; record/ignore it by its own event identity.
An exact-zero clearing is likewise a ledgered 200 `ignored_zero_amount` no-op.

**`transaction.refund`** (proportional clawback, decision #4):
- Fidel's documented refund is a distinct transaction. Look up the purchase by
  `originalTransactionId`; use the refund's own `id` for event idempotency.
  Confirm this with a real signed sandbox refund before enabling processing.
  1. If `originalTransactionId` is missing, or does not resolve to an existing
     `fidel_transactions` row, **do not guess**.
     Log the full event for manual reconciliation, alert, ack with 200 (this is a
     data-integrity gap to investigate, not a request Fidel should retry).
- Convert the **negative** `refund.amount` to signed pence per §4.1a, require it
  to be below zero, then use its positive magnitude as `refund_amount_pence`.
- `new_total_refunded = total_refunded_pence + refund_amount_pence` (validate
  `<= original_amount_pence`, the CHECK constraint backstops this at the DB level too).
  If the provider sends an over-refund, retain the delivery-ledger entry, log an
  `invalid_refund` reconciliation outcome and return 400. Do not raise an
  exception that rolls the ledger back; retain the ledger so any replay is
  recognized as a duplicate.
- `new_progress_credited = original_amount_pence - new_total_refunded` (the net pence
  this transaction should have ever contributed).
- `delta = new_progress_credited - progress_credited_pence` (≤ 0 for a refund).
- If `delta < 0`: call `public.apply_spend_clawback` (§4.4) with that delta — this
  directly decrements `memberships.reward_progress_pence`, no division/threshold math
  needed for the clawback itself (only the *original* grant needed threshold math, and
  even that was just one modulo, not per-stamp division).
- Update `fidel_transactions`: `total_refunded_pence = new_total_refunded`,
  `progress_credited_pence = new_progress_credited`, `status = new_total_refunded >=
  original_amount_pence ? 'refunded' : 'partially_refunded'`.

### 4.4 Clawback function (new, does not reuse `handle_spend_transaction`)

```sql
create or replace function public.apply_spend_clawback(
  _membership_id uuid, _delta integer, _reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_balance integer;
begin
  update public.memberships
    set reward_progress_pence = reward_progress_pence + _delta,   -- _delta is negative
        updated_at = now()
    where id = _membership_id
    returning reward_progress_pence into _new_balance;

  if _new_balance < 0 then
    update public.memberships
      set redemption_blocked_reason = _reason
      where id = _membership_id;
  end if;
end;
$$;
```

(The original `apply_stamp_clawback`, operating on `stamp_count`, stays defined and
usable for any business still on `reward_model = 'stamp_legacy'` — not deleted, per
§0a. Both functions can coexist; only one is ever called for a given business,
depending on its `reward_model`.)

Uses `memberships.redemption_blocked_reason` (§3.5). Suggested reason text pattern:
`"A £{refund_amount} refund reduced your reward progress. Spend £{n} more to redeem
again."` — exact copy is a product/implementation decision for Codex + design, not
architecture.

Clearing `redemption_blocked_reason` (once balance recovers to ≥ 0): clear it inline,
in the same statement, wherever `reward_progress_pence` changes and the new value is
≥ 0 — already included in `handle_spend_transaction`'s sketch above. No separate
scheduled job needed.

### 4.4a Server-side redemption enforcement (corrected 2026-09-22 — no longer out of scope)

Milestone-1 review corrected this: a UI-only check (hiding the redeem button while
`redemption_blocked_reason` is set) is not enforcement — a client could still call the
`rewards` update endpoint directly and redeem anyway. This must be enforced in the
database, alongside the app UI, not instead of it.

`public.enforce_rewards_update_scope()` (existing trigger function,
`supabase/migrations/0004_core_loop.sql`) already gates what a non-privileged caller
may change on a `rewards` row and already rejects re-redeeming an already-redeemed
reward. Extend it (via `create or replace function` in the new migration — do not edit
the old migration file) with one more check: when `new.redeemed_at is not null and
old.redeemed_at is null` (i.e. this update is *performing* a redemption) and the caller
is not privileged (not the business owner/admin — matching the function's existing
privilege check), look up the reward's membership
(`memberships` row for `(rewards.user_id, rewards.business_id)`) and raise an exception
if its `redemption_blocked_reason is not null`. Owner/admin-initiated redemptions
(e.g. a merchant manually honoring a reward despite the hold, at their discretion)
remain unblocked, consistent with the function's existing privilege split.
Lock the matching membership row `FOR UPDATE` while checking the reason, so a
concurrent refund clawback and staff redemption serialize on the same balance.

### 4.5 Atomicity

Steps 4.2–4.4 run inside one Postgres transaction from the Edge Function (Supabase's
`admin` client does not auto-wrap multiple `.from()` calls in a transaction — Codex must
either use a single `plpgsql` function callable via `admin.rpc(...)` that does steps
6–9 + 4.3/4.4 atomically, or use `postgres.js`/direct connection with explicit
`BEGIN`/`COMMIT`). **Recommendation: wrap the entire post-idempotency-check body in one
`SECURITY DEFINER` Postgres function, called once via `admin.rpc()`** — this matches the
existing codebase's pattern of pushing transactional logic into Postgres functions
(`handle_stamp_transaction`, `enforce_membership_update_scope`) rather than
multi-round-tripping from Deno, and guarantees the two-simultaneous-duplicate-webhook
race (core rule: no double credit) is closed by the `FOR UPDATE` lock + the unique
constraint on `fidel_webhook_events`, both inside the same transaction.

### 4.6 Notification dispatch (corrected 2026-09-22 — original design didn't work)

**Why the original plan was wrong:** it said "call `send-user-push` directly." Reading
`send-user-push`'s actual implementation
(`supabase/functions/send-user-push/index.ts`) shows it (a) requires an
`Authorization: Bearer <end-user JWT>` and authenticates that caller as a business
owner/staff member with `can_scan_stamps`/`can_redeem_rewards` permission — a
service-role Edge Function has no end-user JWT to present, so this call would 401 every
time; and (b) selects only the single row where
`push_sent_at is null` ordered by `created_at desc limit 1` — it has no concept of
"send this specific notification," so it's unsafe to call when multiple notifications
might be pending. This function was built for a merchant manually nudging one customer,
not for our use case. It needs a new, purpose-built dispatch path, not a direct call to
the existing one.

**New design: immediate dispatch + durable recovery sweep** (matches "immediate but
recoverable" — a synchronous fast path is not itself durable, so it needs a backstop):

1. **New Edge Function `send-stamp-notification`**, service-role only: authenticates
   the caller by comparing the `Authorization` header against the project's own
   service-role key (constant-time compare — the same key our webhook function already
   holds via `SUPABASE_SERVICE_ROLE_KEY`, so this is an internal function-to-function
   call, not exposed to end users or merchants). Takes `{ notification_id }`, loads
   that *specific* row (not "latest pending"), applies the existing
   `user_settings.notify_stamps`/`notify_rewards` preference gate, sends via Expo push,
   and updates `push_sent_at`/`push_error` on that exact row — same delivery logic as
   `send-user-push`, different auth model and explicit targeting.
2. **`fidel-webhook` calls `send-stamp-notification` synchronously**, immediately after
   its DB transaction commits, once per notification row the commit produced (normally
   one; a clawback also inserts its own `kind='system'` row per §4.4). This is the
   "immediate" path.
3. **Durable recovery: a `pg_cron` job** (this project already has `pg_net` enabled,
   per `0001_foundations_auth.sql` — `pg_cron` needs enabling alongside it via
   `create extension if not exists pg_cron;`), running every minute, that finds any
   `notifications` row with `push_sent_at is null` and
   `created_at < now() - interval '30 seconds'` (giving the synchronous path a window
   to succeed first, so the sweep only ever catches genuine failures — a crashed
   function invocation, a transient Expo API error, a webhook that errored after DB
   commit but before the notification call) and calls `send-stamp-notification` for
   each via `pg_net.http_post`. This is the "recoverable" half — a failed immediate
   send is never silently lost, just picked up within roughly a minute.
4. **This never risks a duplicate stamp/clawback**, per core rule #5 — notification
   delivery is fully decoupled from the balance-changing transaction, which already
   committed by the time any notification call happens. A failed or retried
   notification send can at worst double-send a push message, never double-credit
   stamps. (A cheap strengthening, not required given that tradeoff is already
   accepted: an atomic claim — `update notifications set push_sent_at = now() where id
   = $1 and push_sent_at is null returning *` — before actually sending, would remove
   even the double-push-message risk under a concurrent immediate+sweep race. Optional.)

**Two real gaps, corrected 2026-09-22 (found reviewing before checkpoint 6 is built):**

5. **Unbounded retry for cases that will never succeed.** `send-user-push`'s existing
   logic — which `send-stamp-notification` otherwise correctly mirrors — leaves
   `push_sent_at` as `null` when it skips a send because the recipient opted out via
   `user_settings` or has no registered `push_tokens` row. If copied as-is, the
   recovery sweep (step 3) will re-attempt those exact same rows every single minute,
   forever — not hypothetical, a guaranteed, growing accumulation of wasted cron
   invocations as more such notifications pile up. **Fix**: both cases must still mark
   the row as resolved — set `push_sent_at = now()` with `push_error` recording the
   reason (e.g. `'recipient opted out'` / `'no registered device'`) — so the sweep
   naturally stops retrying it. This is a deliberate behavior *change* from
   `send-user-push`'s original logic, not a bug to inherit silently.
6. **No retry cap for genuine transient failures either.** Even a real, temporary Expo
   API error gets retried every minute indefinitely, with no backoff or maximum
   attempt count. Add a bound: e.g. stop retrying (mark `push_error` with a terminal
   reason) after a fixed number of attempts or a fixed age (24h is reasonable — a push
   notification about a reward is no longer useful much later than that anyway),
   whichever Codex finds simpler to implement against `notifications`' existing
   columns without a new counter column if possible.
7. **Secret handling for the cron→function call**: the `pg_cron` job's `pg_net.http_post`
   call needs the service-role key as an `Authorization` header to pass
   `send-stamp-notification`'s privilege check (step 1) — this **must** come from
   Supabase Vault (`vault.decrypted_secrets` or equivalent), never embedded as literal
   text in the cron job's SQL definition, since `cron.job` definitions can be more
   broadly readable within the database than the Vault secret itself. Not previously
   specified here.

### 4.7 Response

Return 200 for: success, "already processed" (idempotent replay), unknown
merchant/card (logged, not retried), `.qualified` event types (ignored by design).
Return 401 for signature/timestamp failures. Return 400 for malformed payloads. Return
5xx only for genuine transient failures (DB unavailable) where a Fidel retry is actually
useful — do not 5xx on business-logic "unknowns," or Fidel will retry something that
will never succeed.

## 5. Reward-progress calculation (integer arithmetic only, core rule #1) — rewritten 2026-09-22

```
new_progress = memberships.reward_progress_pence + amount_pence   -- amount_pence via §4.1a conversion
if new_progress >= reward_threshold_pence:
  issue reward
  new_progress = new_progress % reward_threshold_pence             -- remainder carries forward
memberships.reward_progress_pence = new_progress
```

No floating point, no division except the single modulo on threshold-crossing (simpler
than the superseded pence-per-stamp design, which needed division on every transaction
— see §0a). `reward_threshold_pence` is a positive integer on `businesses`, validated
as `> 0` before use (a misconfigured `0`/null would make every transaction "cross the
threshold" instantly or divide-by-zero — Codex must guard this explicitly and treat a
missing/invalid threshold as a business-config error, not crash the handler).

## 4.8 Preventing dual-earning (manual stamp + Fidel, added 2026-09-22)

**Amended 2026-09-23 by product decision P5. See [CARD_LINKING_PLAN.md](CARD_LINKING_PLAN.md) §3.6.**
The blanket block below is replaced. Manual entries for a card-linked customer at an
enrolled shop are allowed when staff confirm cash or an unlinked-card payment. They are
limited to 3 per customer per shop per London day and must be at least 30 minutes
apart. A `BEFORE INSERT` trigger enforces this, not the RLS policy. Admin override is
unchanged. The text below is kept for the reasoning trail.

**The gap**: the Fidel webhook (§4) and the existing manual staff "add stamp" flow
(pre-existing `transactions` insert by owner/staff) are two fully independent paths
into the same `transactions` table. Nothing today stops a customer earning a stamp
both automatically (their linked card was used) *and* manually (staff also scans/taps
"add stamp" for the same visit) — a real double-credit risk, not hypothetical, given
staff won't reliably know whether Fidel already fired for this exact purchase.

**Fix: block it structurally, not with a UI hint.** Once a customer has an active
`linked_cards` row *and* the business they're at has a `business_fidel_locations` row,
that customer's stamps for that business should only ever come from Fidel — manual
stamping for that specific (customer, business) pair must be rejected at the database
level, not just discouraged in the retailer app's UI (a hidden button doesn't stop a
rushed tap through an older cached screen or a direct API call).

**Required change (updated 2026-09-22 for the spend-threshold model, §0a)**: extend the
existing `transactions_insert_owner_or_admin` RLS policy
(`supabase/migrations/0004_core_loop.sql`) so a `type in ('stamp', 'spend')` insert by
a non-admin (owner or staff) is additionally rejected when:
```sql
exists (
  select 1 from public.linked_cards lc
  where lc.user_id = transactions.user_id and lc.unlinked_at is null
)
and exists (
  select 1 from public.business_fidel_locations bfl
  where bfl.business_id = transactions.business_id
)
```
**Admin keeps an override** (consistent with the bypass pattern already used
throughout this schema, e.g. `enforce_rewards_update_scope`) — for the rare case
Fidel genuinely misses a transaction (webhook failure, card network delay), an admin
can still manually correct a customer's stamps through a support process. Owners and
staff do not get this bypass, precisely to prevent routine "just in case" double
stamping rather than only the rare genuine miss.

**When this needs to ship**: the schema this depends on (`linked_cards`,
`business_fidel_locations`) already exists from checkpoint 1, so this can be built
any time — but it only has real effect once customers can actually link cards, i.e.
once the card-linking flow (§6 item 6, still out of scope) ships. **Must land before
or alongside the card-linking flow goes live** — shipping card-linking without this
RLS change first would open exactly the double-credit window described above from day
one. Not required for the current webhook checkpoint sequence (§7) to proceed, since
no real `linked_cards` rows will exist until then regardless.

## 4.10 Manual spend entry by staff (designed 2026-09-24; release-blocking, §0b item 2)

**Purpose:** at spend-threshold shops, staff record a purchase in £ for anyone Fidel
doesn't count: cash, an unlinked card, a customer with no linked card, or a shop Fidel
can't match. This replaces "award stamps" at those shops.

**Product owner decisions (2026-09-24):**
- **M1 Cap:** each entry is capped at **£200 by default**. The owner can change the cap
  per shop between **£1 and £1,000**, the platform ceiling. The database enforces the cap.
- **M2 Undo:** staff can undo **their own** entry for **10 minutes**. The shop owner (or
  an admin) can undo **any manual** entry for **7 days**. Fidel-credited spend can never
  be undone here; refunds handle it.
- **M3 Who:** anyone with the existing **scan stamps** permission (`can_scan_stamps`),
  plus the owner and admins. No new permission.

**Unchanged:**
- The customer is still identified by **QR scan or short code**.
- Customers who pay with a linked card at an Active shop need no entry at all.

### Staff flow (retailer app, spend-threshold shops only)

1. Scan the QR or type the code, as today.
2. The screen shows the customer's name and progress, e.g. "£18.00 of £30.00".
3. **Amount keypad, till-style:** digits fill from the pence end, so typing `4 5 0`
   shows **£4.50**. There's no decimal key, so there's no £450-for-£4.50 ambiguity. The
   keypad shows the shop's cap and won't accept more.
4. **Linked-card customer at an Active shop:** the §3.6 "how did they pay?" sheet
   appears first. "They used their linked card" records nothing.
5. **Confirm:** "Add £4.50 for Sam?"
   - Amounts at or above half the cap get a second, larger confirmation: "£150.00 —
     is that right?"
6. **Success:** the existing check, then "£4.50 added. Sam is £7.50 from a reward." or
   "🎉 Sam earned a reward".
7. **Recent entries:** this staff member's entries from the last 10 minutes, each with
   **Undo** and a countdown. Owners see all manual entries from the last 7 days in the
   shop dashboard, each with **Undo**.

Entry needs a connection; there is no offline queue. A failed request can be retried
safely (see idempotency).

### Server design (new migration; nothing edited in applied migrations)

**Columns:**
- `businesses.manual_spend_max_pence integer not null default 20000`, with
  `check (between 100 and 100000)`. Owners edit it through the existing
  business-update path; the check enforces the ceiling.
- `transactions.client_ref uuid`, with a unique partial index `where client_ref is not
  null`. This makes entries idempotent.
- `transactions.voided_at timestamptz`, `voided_by uuid references auth.users on delete
  set null`, `void_reason text`, with the check: all three are null, or `voided_at`
  and `void_reason` are both set.

**RPC `record_manual_spend(_business_id, _customer_id, _amount_pence integer,
_payment_method text, _client_ref uuid) returns jsonb`**. It is `security definer`,
`search_path=''`, and granted to `authenticated` only.
1. **Caller check:** owner of the business, or `staff_has_permission(..., 'scan_stamps')`,
   or admin; otherwise `not_allowed`.
2. **Shop check:** `reward_model = 'spend_threshold'` and a positive threshold;
   otherwise `shop_not_spend_based`.
3. **Amount check:** `1 ≤ _amount_pence ≤ manual_spend_max_pence`; otherwise
   `amount_out_of_range`, with the cap in DETAIL.
4. **Membership check:** the customer must be a member (same rule as stamps);
   otherwise `not_a_member`.
5. **Idempotency:** if `_client_ref` already exists **for this caller and business**,
   return that entry's result with `status: 'duplicate'`. A retry never double-credits.
6. **Insert** `transactions(type 'spend', value, membership_id, manual_payment_method,
   client_ref)`. The existing triggers do the rest:
   - the §3.6 P5 trigger (method required, 3 a day, 30 minutes apart) applies unchanged,
     because `auth.role()` is still `authenticated` inside the definer function;
   - it also stamps `recorded_by`;
   - `handle_spend_transaction` updates progress, issues rewards and writes
     notifications.
7. **Return** `{status, transactionId, amountPence, progressPence, thresholdPence,
   rewardsEarned}`.

The client insert policy keeps refusing `type='spend'`, so this RPC is the **only**
client path for manual spend.

**RPC `undo_manual_spend(_transaction_id uuid, _reason text) returns jsonb`**, also
`security definer` and authenticated only.
- **Allowed:** a `spend` row with `recorded_by is not null` (so manual, never Fidel) that
  isn't voided yet, where the caller is either:
  - the `recorded_by` user within 10 minutes of `created_at`; or
  - the business owner or an admin within 7 days.

  Otherwise it returns `not_allowed`, `too_late` or `already_undone`.
- **Effect, in one transaction:**
  - lock the membership;
  - `reward_progress_pence -= value`;
  - if the result is negative, set `redemption_blocked_reason` (the refund mechanism,
    ARCH_PLAN §4.4, so an unredeemed reward earned from the mistaken entry can't be
    redeemed until it's covered again);
  - set `voided_at`, `voided_by` and `void_reason`;
  - add a customer notification: "A purchase of £X at Shop was corrected."

  The logic is written inline, because `apply_spend_clawback` is service-role only.
- **Voided rows still count** towards the P5 daily limit, so undo can't be used to get
  around it.

**RPC `scanned_member_spend_summary(_customer_id, _business_id) returns jsonb`**, same
caller check. It returns `{progressPence, thresholdPence, manualMaxPence, linked,
manualToday, nextAllowedAt}`, one call after a scan. `customer_card_link_status` stays
for compatibility.

### Shopper app (part of the same release item)

- At spend-threshold shops, the loyalty card shows **"£18.00 of £30.00"** and the
  progress bar uses pence.
- Negative progress after a refund or undo shows "£0.00 of £30.00", plus a short note
  that redemption is paused.
- Stamp shops are unchanged until the cutover.

### Tests required before build approval

Disposable PostgreSQL, focused fixture:
- **Callers:** staff with and without `can_scan_stamps`, owner, admin, customer (refused),
  stranger (refused);
- **Shop:** a stamp shop is refused;
- **Amount:** 0 refused, 1p allowed, cap allowed, cap+1 refused; a cap edit above
  £1,000 is refused by the check;
- **Membership:** a non-member is refused;
- **Idempotency:** the same `client_ref` twice gives one row and a `duplicate` status;
  two concurrent calls with the same ref give one row;
- **Rewards:** a threshold crossing issues exactly one reward; the P5 rules still apply
  through the RPC;
- **Clients:** a direct client `insert type='spend'` is still refused;
- **Undo:** own entry at 9 minutes allowed and at 11 minutes refused; another staff
  member's entry refused; owner at 6 days allowed and at 8 days refused; a Fidel row
  refused; a double undo refused; negative progress blocks redemption; a voided row
  still counts toward P5.

Retailer and shopper: TypeScript and bundle checks, then a device test on the test shop.

### Build order

1. Migration and tests.
2. Retailer keypad, confirm, recent entries and undo.
3. Owner cap setting and 7-day undo list.
4. Shopper £ progress.
5. Device test on the dedicated test shop and account.

## 4.11 Tiered £ rewards, push dispatch and the switchover (designed 2026-09-25)

**Product owner decisions (2026-09-25):**
- **T1:** each shop can have **several rewards at different £ amounts**, e.g. "£20 = free
  coffee, £50 = free lunch".
- **T2:** shops without an amount default to **£20**.
- **T3:** at the switchover everyone's progress starts at **£0**; earned but unredeemed
  rewards stay valid, and stamp counts are kept but hidden.
- **T4:** the switchover goes ahead **without** the Fidel-submission requirement (§0b
  item 4 is relaxed). Fidel stays built and is enabled per shop by an Active Location.
- **T5:** the stamps/points/visits setup is removed from the retailer app, website and
  onboarding.

**How tiers work (mirrors the old stamp-tier semantics):**
- `reward_catalog.spend_threshold_pence` holds each reward's £ amount.
- Progress climbs through the tiers in order; crossing a tier issues **that tier's
  reward** (title plus `catalog_id`).
- Crossing the **highest** tier completes a cycle: progress restarts at £0 and any excess
  carries over.
- `businesses.reward_threshold_pence` is kept equal to the highest tier (the cycle
  length) by a trigger on `reward_catalog`.
- A shop with no tiers falls back to a single "Free reward" at `reward_threshold_pence`.
- Negative progress (after a refund or undo) must first be covered before the first tier
  is reached again.
- The "next reward" shown to customers and staff is the lowest tier above current
  progress.

**Stamps after the switchover:** a `BEFORE INSERT` guard refuses `type='stamp'` at
spend-threshold shops with `shop_uses_spend_rewards`, so an out-of-date app or page can't
silently award meaningless stamps.

**Push dispatch:**
- A shared `_shared/push.ts` sends **all** of a customer's unsent notifications for a
  shop from the last 30 minutes, respects `user_settings`, and marks them sent.
- `send-user-push` (staff-triggered) uses it.
- `fidel-webhook` calls it in the background after a `processed` event, looking the
  customer up from `fidel_transactions`.
- A retry sweep for failed sends is deferred (ARCH_PLAN §4.6).

**Switchover migration (run after the apps and website are updated):**
- every business → `spend_threshold`; the column default → `spend_threshold`;
  `reward_threshold_pence` defaults to 2000;
- catalog rewards converted: the first (lowest) tier becomes £20, and any others are
  scaled proportionally, rounded to whole pounds;
- a shop already on spend rewards (Pure Elegant) keeps its amount;
- a shop with no rewards gets a "Free reward" tier at £20;
- every membership's `reward_progress_pence` → 0 and the redemption block is cleared;
- existing `rewards` rows are untouched.

**Applied 2026-09-25** as `20260925190000_spend_switchover.sql`, after the retailer and
shopper OTA updates. As built, progress is reset only at shops that were on stamps; a shop
already on spend (Pure Elegant) keeps its customers' £ progress. Equal stamp counts get
distinct £ amounts (+£1 each). The website update is built but not yet deployed (GitHub
`main` diverged; awaiting the product owner's OK to merge and push).

## 6z. Analytics: a new capability this plan enables but doesn't wire up (added 2026-09-22)

**Context**: today's analytics (`analytics-summary`, `deep-business-report` Edge
Functions, and whatever the retailer app computes client-side) are built entirely from
counts and timestamps — `transactions.value` for a stamp is a *stamp count*, not money.
There is no monetary amount anywhere in the existing schema, so revenue-based metrics
from the original product vision (Customer Lifetime Value, revenue trends) have never
actually been computable, regardless of Fidel.

**What this plan changes**: `fidel_transactions.original_amount_pence` (§3.3, already
in the approved checkpoint-1 migration) is the **first real monetary data** this
platform will ever have — a genuine £ amount per purchase, with a real transaction
timestamp, for any customer who's linked a card at an enrolled merchant. This is new
capability, not a replacement for anything existing — customers on the manual
staff-scan fallback still have no spend data, exactly as today, no regression.

**What this plan does *not* do**: neither `analytics-summary` nor `deep-business-report`
queries `fidel_transactions` — they don't know it exists. So this capability sits
unused in the database until something is built to read it. **Flagged as a required
follow-up, not scoped or designed here**:
- A revenue/CLV/hourly-pattern query layer over `fidel_transactions`, scoped to the
  business owner (mirroring the RLS pattern already used elsewhere — owner/staff/admin
  only, never cross-business).
- A sensible blended view for a business with a mix of Fidel-linked and manual-fallback
  customers — e.g. "revenue trends" can only reflect the Fidel-covered subset of
  transactions, and the dashboard needs to say so rather than silently presenting a
  partial number as if it were total revenue.
- Whether this feeds the same `analytics-summary` AI-written summary (would need new
  stats fields in its `stats` payload) or becomes its own dashboard section.

**When**: not before the webhook itself ships and `fidel_transactions` has real data to
query — sequenced after §7's checkpoints, alongside or after §6a/§4.8/card-linking.

## 4.9 One earning rule, not two — SUPERSEDED by §0a (2026-09-22)

This section originally proposed a per-business `earning_mode` toggle (`per_visit` vs
`per_amount`) to reconcile manual stamping's "1 tap = 1 stamp" behavior with Fidel's
spend-based math. **The reward-model pivot (§0a) resolves this more directly**: the new
spend-threshold model is uniformly amount-based on *both* channels by product decision
— there is no `per_visit` mode to toggle to, and manual entry capturing an amount is
now just how the (new, default) system works, not an opt-in tradeoff. The toggle
proposed here is unnecessary and not being built. Kept in the document, struck through
in spirit rather than deleted, so the reasoning trail stays visible — this is exactly
the kind of "hide, don't delete" instinct §0a itself applies to the schema.

## 6a. Merchant location enrollment (onboarding, added 2026-09-22) — RELEASE-BLOCKING since 2026-09-23 (§0b)

**2026-09-23:** every shop must be enrolled by release (§0b). A backfill for shops that
exist at release uses this same function. Point 4 below still holds: a Fidel failure
never blocks a shop's approval. Enrollment is checked as a release criterion instead.

**Goal**: a merchant's Fidel Location (the thing `business_fidel_locations.fidel_location_id`
stores) is created automatically by our backend when they onboard — no merchant-facing
Fidel step, no Fidel account or dashboard access for them. Distinct from customer card
linking (§6 item 6, still out of scope) — this is a backend-only addition to retailer
onboarding, no SDK, no client UI beyond maybe a toggle.

**New secret this introduces**: a Fidel **API key** (server-side, for calling Fidel's
REST API directly to create Locations) — distinct from the webhook `secretKey` already
covered in §4.1, and from the SDK key (customer card-linking, still not needed). Stored
as a Supabase secret (e.g. `FIDEL_API_KEY`), never in code, chat, or `CLAUDE_HANDOFF.md`.

**Trigger**: when a business's `approval_status` transitions to `'approved'` (not at raw
signup — avoids enrolling spam/rejected businesses as Fidel Locations) **and** no
`business_fidel_locations` row exists yet for it.

**Mechanism**:
1. New Edge Function `enroll-fidel-location`, service-role only (internal call, never
   client-facing). Given a `business_id`, reads the name/address/postcode/lat/lng
   already collected at onboarding — **no new form fields needed**.
2. Resolves or creates a Fidel **Brand** for it (see open question below), then calls
   Fidel's Locations API to create a Location under that Brand, in our Program.
3. On success: insert into `business_fidel_locations` (`business_id`,
   `fidel_program_id`, `fidel_location_id`; `fidel_mid` stays null — Fidel may not
   return a MID until real transactions start flowing).
4. On failure: log for manual retry, **do not block business approval on this
   succeeding**. A business must stay approved and usable even if Fidel enrollment
   fails or Fidel's API is down — the manual staff-scan stamp flow stays a permanent
   fallback regardless (confirmed in this session's product discussion), so Fidel
   enrollment failing is degraded automation, not a broken business.
5. **Trigger mechanism, consistent with existing repo conventions**: an `AFTER UPDATE`
   trigger on `businesses` (fires when `approval_status` changes to `'approved'`) using
   `pg_net.http_post` to call `enroll-fidel-location` asynchronously — the same
   async-side-effect pattern already available in this project (`pg_net` already
   enabled, per `0001_foundations_auth.sql`).

**Open design question, not invented — needs a short design pass before this is built**:
this repo already has a `brand_id` grouping on `businesses` for multi-location
franchises (`0023_brands_and_franchises.sql`). How that maps onto Fidel's own
Brand/Location hierarchy — one Fidel Brand per Loyalty-Loop-brand group for franchises,
falling back to one dedicated Fidel Brand per standalone business otherwise — wasn't
researched this session and shouldn't be guessed. Flagging it here rather than picking
an approach without checking Fidel's Brands API constraints first (e.g. whether a Brand
can be created/reused idempotently by name, or needs its own dedup tracking table).

**Explicitly out of scope for this addendum**: re-enrollment when a business updates its
address after initial approval (would need Fidel's update-location endpoint, not just
create) — future work, not required for launch.

## 6. Assumptions & unresolved items (explicit, not invented)

1. **Refund event correlation**: Fidel's official docs confirm a separate refund
   `id`, negative `amount`, and `originalTransactionId` when a purchase is
   matched. Obtain a real signed sandbox refund before enabling the branch, and
   verify whether `originalTransactionId` points to the auth ID or a distinct
   clearing ID in this program. If no stored purchase resolves, ack and alert without
   changing a balance.
2. **Event routing and secrets**: transaction examples contain no `event` field,
   while each subscription has its own `secretKey`. Register event-specific signed
   URLs or confirm an equivalent provider field and secret mapping in the sandbox.
   Negative clearing deliveries must not cause a second clawback.
3. **Superseded by §0a**: the pence-carry-pool precision tradeoff no longer applies —
   the spend-threshold model's refund clawback (§4.3/§4.4) is exact, no pooling
   involved. Left here for the historical record rather than deleted.
4. Default `reward_threshold_pence` when a merchant hasn't configured one — this plan
   assumes it must always be explicitly configured per merchant during setup (no
   platform-wide default is invented); Codex should treat a missing/invalid threshold
   as a setup error, not silently default to any value (§5).
5. Auth-vs-clearing amount drift (tips, adjustments) — logged for manual review, not
   auto-reconciled. Revisit if this proves common in practice.
6. Card-linking UI/flow itself (the Fidel SDK integration in the shopper app, the
   `linked_cards` insert path) is **out of scope for this plan** — this document only
   covers the webhook/points engine consuming already-linked cards. A follow-up plan is
   needed for the linking flow before it can ship end-to-end. (Corrected 2026-09-22:
   whatever that follow-up implements must write `fidel_card_id`, not `fidel_account_id`
   — see §2/§3.1.) **2026-09-23: that follow-up plan is
   [CARD_LINKING_PLAN.md](CARD_LINKING_PLAN.md)** (draft, awaiting product-owner
   confirmation). It amends §3.1 (partial unique index on active cards, Fidel-deletion
   columns), defines the server-verified claim path this section's RLS note refers to,
   and flags a new defect: the `on delete restrict` FKs on `fidel_transactions` will make
   `delete-my-account` fail for any user with a Fidel transaction (its §3.4).
7. Peak transaction volume / expected merchant+customer scale, needed to turn "handles
   bursts without rate-limiting us" into a measurable test target — this is a genuine
   product question, not an architecture one. Per `IMPLEMENTATION_TIMELINE.md`
   milestone 2, this is deliberately deferred to that milestone rather than asked here;
   not needed to finish milestone 1's architecture correction.
8. `apps/api` (a standalone Express/Prisma prototype built earlier) is **not** the
   production direction — decision #9 (Supabase) stands. Its passing tests may be
   useful reference for business-logic edge cases, but its architecture is not reused;
   this plan's §3/§4 is the implementation contract.
9. Merchant location enrollment (§6a) is a separate, smaller piece of work from both
   the webhook engine (§4, the current build target) and the customer card-linking
   flow (item 6 above) — not part of the §7 checkpoint sequence. It needs the
   Brand-mapping question in §6a resolved before Codex builds it. **2026-09-23: now
   release-blocking, plus a backfill. See §0b.** Revised the same day: every shop must be
   *submitted*; an Active Location is not a release requirement.
10. **Manual spend entry** is designed in §4.10 (2026-09-24, decisions M1–M3). The
    **release cutover (§0b)** is still to be designed.

## 7. Review checkpoints (revised 2026-09-22, again for the reward-model pivot §0a)

Codex should implement and request review in this order, each against this document.
**Checkpoint 1 needs revision from what was previously approved** — the already-applied
review approved a migration built around stamp counts; §0a changes what checkpoint 1
must contain. That migration has not been applied to any database, so revising it in
place is correct, not a new corrective migration.

1. **Revised migration**: §3 schema (`linked_cards`, `business_fidel_locations`,
   `fidel_transactions` — now *without* the pool columns, `fidel_webhook_events`),
   `businesses.reward_model` / `reward_threshold_pence`, `memberships.reward_progress_pence`
   / `redemption_blocked_reason`, the `transaction_type` enum addition (`'spend'`) and
   the relaxed `transactions.value` check (§4.3's prerequisite), **plus** the
   `enforce_rewards_update_scope` extension from §4.4a, in the same migration set. The
   original `stamp_count`/`stamp_threshold`/`handle_stamp_transaction` machinery is
   untouched — nothing to migrate there, per §0a's hide-don't-delete decision.
2. New `handle_spend_transaction` trigger (§4.3's prerequisite) + `apply_spend_clawback`
   function + its interaction with `enforce_rewards_update_scope` clearing/checking the
   block reason (§4.4, §4.4a). The original `apply_stamp_clawback` stays defined,
   untouched, dormant for `stamp_legacy` businesses.
3. `fidel-webhook` Edge Function: **double-HMAC** signature verification + timestamp
   tolerance only (§4.1), reviewed in isolation before any DB logic — this is the
   security-critical surface. Include a test vector: a genuine Fidel sandbox request
   (or Fidel's own documented example, if they publish one) verified to pass, not just
   synthetic data generated by the same code under test.
4. Amount conversion (§4.1a) as an isolated, unit-testable function — decimal string in,
   integer pence out, before it's wired into the webhook body. Test boundary cases
   (`"5"`, `"5.4"`, `"5.44"`, `"0.01"`, malformed precision).
5. Full webhook body (§4.2–4.4a) wired to the atomic RPC function (§4.5). No
   chunked-insert concern under the spend-threshold model (§4.3) — that was specific to
   the superseded per-stamp design. Refund correlation fail-safe (§4.3) still applies.
6. `send-stamp-notification` + `pg_cron` recovery sweep (§4.6) — new components, review
   the service-role auth model specifically (it must not be callable by end users).
7. Mock payload generator + full test suite: valid/invalid signature (with the
   corrected double-HMAC), duplicate delivery, unknown merchant, unknown card,
   malformed payload, auth→clearing→refund sequence, partial refund proportional math,
   concurrent duplicate delivery, threshold-crossing with carry-forward remainder,
   notification dispatch + recovery sweep firing after a simulated immediate-send
   failure, and the burst-concurrency + latency targets from §8.

## 8. Capacity & test target (milestone 2, added 2026-09-22)

Product input: ~100 payments/day platform-wide, for now — **explicitly provisional,
revisit once real merchant counts exist.** Nothing in this design hardcodes a volume
assumption (Edge Functions scale per-request, per decision #9), so raising this number
later doesn't require an architecture change — only the test target below would be
re-derived.

**Worked example, average → worst-case burst:** 100/day averages ~4/hour, but real
spend clusters around meal times, not evenly across 24 hours. A conservative worst case:
half the day's volume (50 payments) lands inside a 2-hour lunch/dinner peak, and within
that peak, transactions cluster further — assume up to 10 could arrive within the same
1-second window (several merchants' customers paying simultaneously). That's the number
worth testing against, not the flat daily average — a system that only survives 4/hour
evenly spaced would fail the very first real lunch rush.

**Test target (for §7 checkpoint 7's test suite):**
- **Concurrency**: 10 distinct `transaction.auth` webhooks (different
  `fidel_transaction_id`s, different customers) delivered within 1 second must all
  process correctly — no lock timeouts, no lost updates, no double-credits. This is in
  addition to the already-planned "concurrent duplicate delivery" test (same event,
  arriving twice), which tests idempotency rather than throughput.
- **Latency**: p95 end-to-end (webhook received → DB commit → notification dispatch
  attempted) under 3 seconds, so a customer's phone buzzes close to when they tap their
  card, not minutes later.
- **These are starting numbers, not contractual** — cheap to raise once a real capacity
  estimate exists (more merchants, higher daily volume). Codex should write the
  concurrency test parametrized on transaction count, not hardcoded to 10, so raising
  the target later is a one-line test change.
