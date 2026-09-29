# Card lifecycle and award eligibility repair: R1–R4 design

Author: Claude (architecture review), 2026-09-29. Implementer: Codex.
Source findings: `docs/CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md` R1–R4 and the
reproducer `tmp/claude-review/regressions.test.mjs`.

This is the contract to build against. It replaces the "active card for every event"
rule in `ARCH_PLAN.md` §4.2 steps 7–9. Everything here is **additive**: a new migration,
new or replacement functions, and Edge Function changes. Applied migrations are not
edited. Nothing is deployed until Claude has reviewed the implementation and the
product owner has authorised it.

## 0. The two rules everything follows

1. **New earning needs current permission. Adjusting old earning needs only the
   original facts.** An auth (new spend) requires an active linked card, an Active
   Location and a membership *now*. A clearing or refund is about a purchase we
   already credited. It is matched to that purchase and to the user and card row that
   earned it, even if the card has since been unlinked or relinked. It never needs a
   currently active card or an Active Location.
2. **A removal is a durable fact until Fidel has confirmed the deletion.** Every card
   we asked to remove, or refused to keep, has a database row whose state says so.
   Background processes (recovery, the sweep, account deletion) must respect that
   row. Only an explicit new link by the shopper can cancel it, and only when no
   deletion is running.

## 1. Schema changes (one new migration)

### 1.1 `linked_cards`: deletion state machine

Add:

| Column | Type | Meaning |
|---|---|---|
| `fidel_delete_state` | text, nullable | `null` while active. For unlinked rows: `pending`, `in_progress`, `deleted`, `failed` or `superseded`. |
| `fidel_delete_lease_until` | timestamptz, nullable | Set while `in_progress`. A deleter that crashes loses its lease when this passes. |
| `fidel_delete_attempts` | integer not null default 0 | Incremented by each `begin`. |

Constraints:
- `(unlinked_at is null) = (fidel_delete_state is null)`.
- `fidel_delete_state = 'deleted'` ⇔ `fidel_deleted_at is not null`. Keep
  `fidel_deleted_at` for compatibility.
- `fidel_delete_lease_until is not null` only when `in_progress`.

Backfill in the same migration: unlinked rows with `fidel_deleted_at` →
`deleted`. Unlinked rows without it → `failed` if `fidel_delete_error` is set,
otherwise `pending`.

State meanings:
- `pending` / `failed`: Fidel may still hold the card, and a delete is owed.
- `in_progress`: a deleter holds the lease and may be calling Fidel right now.
- `deleted`: Fidel confirmed (2xx or 404). If the same `card.id` shows up at Fidel
  again later, that is a **new enrollment**, not the old one coming back.
- `superseded`: the shopper explicitly relinked this card before the delete ran. No
  delete is owed. The new active row now owns the card.

Reason `cap_exceeded` (already allowed by `linked_cards_unlink_reason_check`) is now
actually used: see §2.1.

### 1.2 `fidel_link_identities`: account-deletion tombstone

Add `deleting_at timestamptz`. While it is set and less than 1 hour old:
`fidel_link_identity`, the session and every claim refuse with `account_deleting`.
The one-hour limit stops an abandoned deletion from blocking linking forever.

### 1.3 New table `fidel_retired_metadata_ids`

`metadata_id text primary key`, `retired_at timestamptz not null default now()`. There
is **no user id** in this table. It outlives the account (the identity row cascades
away with the user) so the orphan sweep (§4.3) can recognise cards enrolled under a
deleted account. RLS on, no client privileges.

### 1.4 `fidel_webhook_events`: record what happened

Add `outcome text` (nullable for old rows). Every path in the webhook RPC sets it
before returning: `processed`, `duplicate` (not stored, since the insert failed),
`ignored_zero_amount`, `ignored_negative_clearing`, `unknown_merchant`,
`unknown_card`, `unknown_membership`, `ineligible_location`,
`unresolved_clearing`, `unresolved_refund`, `refund_membership_missing` or
`invalid_refund`. This is the reconciliation record R4 asks for: acknowledged but
unawarded events can be listed and investigated. No card or payment details go in
this column.

## 2. Card lifecycle functions (R1, R3)

Serialization: every function below that reads or changes lifecycle state for a
Fidel card id first takes
`pg_advisory_xact_lock(hashtextextended('fidel-card:' || fidel_card_id, 0))`.
Functions that act on a user also keep the existing `fidel_link_identities ... for
update` lock. **Lock order is always identity row first, then card lock.** When one
call touches several cards, take the card locks in sorted `fidel_card_id` order.

### 2.1 Claim: `claim_linked_card_v2(_user_id, _fidel_card_id, _fidel_account_id, _card_scheme, _last_numbers, _explicit boolean)`

Service role only. Replaces the use of `claim_linked_card`. Keep the old function
until the Edge Functions are redeployed, then revoke it in a later migration.

1. Lock the identity row. Missing → `no_identity`. `deleting_at` less than 1 hour old
   → `account_deleting`.
2. Take the card lock.
3. Active row for this card id: same user → `already_linked`. Another user →
   `already_linked_elsewhere`. (The partial unique index stays as the backstop.)
4. Find this user's **most recent** unlinked row for this card id:
   - `in_progress` with an unexpired lease → return `removal_in_progress`. Insert
     nothing.
   - `pending` or `failed`:
     - `_explicit = false` (background recovery) → return `removal_pending`. Insert
       nothing. **This fixes R1:** opening the Linked cards screen can no longer bring
       back a card the shopper removed.
     - `_explicit = true` → set that row to `superseded` (clear its lease), then
       continue.
   - `deleted`, `superseded`, `in_progress` with an expired lease, or no row →
     continue. An expired lease is treated like `failed`: under `_explicit = false`
     return `removal_pending`; under `_explicit = true` supersede.
5. Count active cards. At the limit (5): insert an **unlinked** row with reason
   `cap_exceeded` and state `pending`, then return `limit_reached` with its
   `linked_card_id`. **This fixes R3's cap case:** the refused card now has a durable
   row that the sweep and account deletion can find.
6. Otherwise insert the active row and return `claimed`.

Edge Function `claimCards`:
- `_explicit` is **true only when the client sends a `cardId`** from the SDK's
  successful enrollment result. Recovery with no `cardId` is always `false`.
  Ownership is still proven only by listing under the user's metadata id, so
  `_explicit` can't claim someone else's card. It only lets a shopper deliberately
  re-add their own card.
- On `limit_reached`, delete at Fidel through §2.2 using the returned row id,
  **not** a bare `deleteFidelCard` call.
- Pass `removal_in_progress` and `removal_pending` through to the client as
  statuses. The UI copy for these belongs to R9. Until then, show the neutral
  "This card is still being removed. Try again in a minute."

### 2.2 Delete protocol: `begin_fidel_card_delete(_linked_card_id)` / `finish_fidel_card_delete(_linked_card_id, _error)`

Every deletion path uses both calls. That means unlink, the cap refusal, the sweep
and account deletion for rows we hold. **No code calls Fidel's DELETE for a card
that has a local row without first holding the lease.**

`begin` (service role):
- Card lock.
- Acquire only when the row is unlinked and its state is `pending`, `failed`, or
  `in_progress` with an expired lease, **and** there is no active row for the same
  `fidel_card_id`. If there is an active row, set this row to `superseded` and
  return `not_acquired`.
- On success: state `in_progress`, lease `now() + 5 minutes`, `attempts + 1`, commit.
  Return `fidel_card_id`.

`finish` (service role):
- Card lock.
- Only if the row is still `in_progress`: with no error → `deleted` +
  `fidel_deleted_at = now()`; with an error → `failed` + `fidel_delete_error`.
  Clear the lease either way.
- If the state is anything else, change nothing and log it.

**Why this closes the R1 race.** A claim that runs while a DELETE is in flight sees
`in_progress` and inserts nothing. A claim that commits first sets the row to
`superseded`, so the following `begin` fails and no DELETE is sent.

Required HTTP rule: Fidel DELETE calls must time out well inside the lease. Use 20
seconds with `AbortSignal.timeout`. A timeout is recorded as an error. Deleting
again later is safe, because 404 counts as done.

`unlink_linked_card` sets the state to `pending` in the same update that sets
`unlinked_at`. `mark_fidel_card_deleted` becomes a compatibility wrapper that behaves
like `finish` on an `in_progress` row and like the old code on `pending`/`failed`
rows. Revoke it once no deployed function uses it.

`fidel_cards_pending_delete` returns rows in `pending` or `failed`, plus
`in_progress` rows with an expired lease. The sweep then calls `begin` per row and
skips any it doesn't acquire.

### 2.3 Account deletion: `begin_fidel_account_deletion(_user_id)` / `complete_fidel_account_deletion(_user_id)` / `abort_fidel_account_deletion(_user_id)`

`begin` (service role, identity lock):
- Set `deleting_at = now()`.
- Unlink every active row with reason `account_deleted`, state `pending`.
- Return the metadata id and every row id whose state is not `deleted` or
  `superseded`. If there is no identity row, return that. The user never started
  linking, so there is nothing to do at Fidel.

Edge Function (`delete-my-account`), after `begin`:
1. For each returned row: `begin_fidel_card_delete` → DELETE → `finish`. A row that
   isn't acquired because its lease is still running is a failure for this attempt.
2. **Then list every card at Fidel under the metadata id** (full pagination), and
   delete each listed card in our program and environment. These are provider-only
   cards with no local row, for example enrolled but never claimed because the app
   closed. 404 counts as done.
3. If the listing is **truncated** (more pages than the page cap), treat it as a
   failure. Never act as if a partial list were complete. `listCardsByMetadata`
   must report truncation instead of silently returning.
4. Everything succeeded → `complete`: insert the metadata id into
   `fidel_retired_metadata_ids`. Then carry on with the existing deletion (the
   `fidel_transactions` and `linked_cards` rows, then the rest).
5. Anything failed → `abort` (clears `deleting_at`) and return the existing
   "couldn't finish removing your linked cards" error. The shopper's cards stay
   unlinked. They asked to delete the account, so they don't earn in the meantime.

**Why this fixes R3.** Account deletion no longer relies only on local rows, and
the tombstone stops new claims while it runs. The one remaining gap: a client that
already holds the metadata id could enroll a card at Fidel after step 2's listing.
The orphan sweep (§4.3) covers that, because the metadata id is retired.

## 3. Webhook resolution (R2, R4)

Replace `process_fidel_webhook_event` with a new version. Same signature, same
single transaction, and the ledger insert and zero-amount handling are unchanged.
Then:

### 3.1 Merchant

Resolve `business_fidel_locations` by `(fidel_location_id, fidel_program_id)` as
today. Not found → `unknown_merchant`.

### 3.2 `transaction.auth` (new earning)

All of these must hold **now**:
- the Location row's `fidel_status = 'active'`, otherwise outcome
  `ineligible_location` and no award (**R4**)
- an **active** `linked_cards` row with this `fidel_card_id`, otherwise
  `unknown_card`
- a membership for that user at the mapped business, locked `for update`, otherwise
  `unknown_membership`

Then record the purchase against that active row, exactly as today.

The eligibility rule is decided when the event is processed, not when the payment
happened. A delayed auth for a Location that has since stopped being Active earns
nothing, and its ledger outcome says why. That is deliberate. It keeps the webhook,
the badge and the P5 manual-entry rule in agreement. Put the auth rule in one SQL
function `fidel_location_accepts_new_awards(_location_row)` so later changes happen
in one place. P5 and the badge keep using `business_has_active_fidel_location`,
which applies the same `active` test per business.

### 3.3 `transaction.clearing` (positive)

- Find `fidel_transactions` by `fidel_transaction_id` (verified 2026-09-23: clearing
  reuses the auth id).
- Require **all** of the following, otherwise `unresolved_clearing`:
  - `purchase.business_id` equals the business the event's Location maps to
  - the purchase's own `linked_cards` row (joined by `purchase.linked_card_id`,
    whether active or not) has `fidel_card_id` equal to the event's card id
  - that row's `user_id` equals `purchase.user_id`
- Do **not** require an active card or an Active Location.
- Update the status as today. The negative-clearing rule is unchanged.

### 3.4 `transaction.refund`

- As today, a missing `originalTransactionId` → `unresolved_refund`.
- Find the purchase by `originalTransactionId`, locked `for update`, with the same
  three checks as §3.3. Again, no active-card or Active Location requirement.
- Lock the membership of **`purchase.user_id`** at `purchase.business_id`. Missing
  (the shopper left the shop) → `refund_membership_missing`. Nothing changes and it
  is left for reconciliation.
- The amount checks, clawback and status update are unchanged.

**Why this fixes R2 without letting anyone inherit a purchase.** Follow-up events
resolve through the purchase row, and the purchase is permanently bound to the user
and the exact card row that earned it. The following cases all adjust the original
purchaser only:
- unlink then refund
- relink then clearing or refund
- the same physical card later linked by a different user who happens to get the
  same Fidel `card.id`

A new owner's active row is never consulted for an old purchase.

## 4. Cleanup and orphan sweep (R3 follow-through)

### 4.1 Sweep

`sweepPendingDeletes`: for each row from `fidel_cards_pending_delete`, call `begin`,
DELETE, then `finish`. Skip rows it doesn't acquire. Keep the 24-hour overdue alert.

### 4.2 Scheduling

This is still a separate, already-known gate: `pg_cron` isn't installed. Don't
schedule anything in this task. The sweep must stay safe to run concurrently with
itself, which the leases guarantee.

### 4.3 Orphan sweep (new, same function, separate pass)

List the program's cards at Fidel (program card listing endpoint, full pagination,
fail closed on truncation). Delete a card when:
- its `metadata.id` is in `fidel_retired_metadata_ids`, or
- its `metadata.id` matches no identity row **and** the card was created more than
  24 hours ago.

Leave cards whose metadata belongs to an existing identity. They are either active,
owed a delete (they have a row), or waiting for that user's recovery.

Before relying on this pass, verify the endpoint shape and whether the card includes
a created timestamp in Fidel's API reference. If the reference doesn't confirm
them, implement only the retired-metadata rule and record the other rule as
unverified. Test mode only. Never run it against live keys during this task.

## 5. Tests Codex must add (disposable PostgreSQL and fake HTTP only)

First, convert `tmp/claude-review/regressions.test.mjs` scenarios 1–4 and 6 into
**desired-behaviour** tests in `apps/api/test/integration/`. Leave the originals
untouched as the historical reproducer. Then add:

1. Unlink → refund 100p on a 600p purchase: processed, progress 500.
2. Unlink → relink the same card id (explicit) → clearing processed, refund processed
   against the **original** purchase. The new row gets nothing it didn't earn.
3. User A unlinks, then Fidel deletion is confirmed. User B claims the same card id
   and makes a new purchase. A late refund of A's purchase adjusts only A. B's auth
   credits only B.
4. DELETE fails (503), then recovery with no `cardId` returns `removal_pending`. No
   active row is created. The sweep later deletes it (state `deleted`).
5. The same as 4, but with an explicit claim with `cardId`: the old row becomes
   `superseded` and the new active row is created. The sweep never deletes it at
   Fidel.
6. Race: a DELETE is in flight (lease held) during recovery and during an explicit
   claim. Both return `removal_in_progress`, and there is no active row afterwards.
   Run it both ways:
   - DELETE succeeds → `deleted`
   - DELETE fails → `failed`, then a later explicit claim supersedes it
7. Race: an explicit claim commits before `begin`. `begin` returns `not_acquired`
   and no DELETE request is sent (assert the fake HTTP call count).
8. Lease expiry: `begin`, then no `finish`, then after the lease expires the sweep
   acquires and completes it.
9. Cap: 5 active cards, and a sixth listed card gets `limit_reached`. A
   `cap_exceeded` row exists and DELETE is attempted through the lease. When DELETE
   fails, the row stays `failed` and account deletion finds it.
10. Account deletion:
    - the tombstone blocks a concurrent claim (`account_deleting`)
    - provider-only listed cards are deleted
    - truncated listing → abort and the tombstone is cleared
    - success → metadata id retired, then the rest of the deletion proceeds
11. Orphan sweep deletes a card under a retired metadata id and leaves a card under
    a live identity alone.
12. R4: Location `syncing` / `idle` / `not_found` / `null` → auth outcome
    `ineligible_location`, no award, ledger outcome stored. `active` → processed. A
    clearing and a refund for an existing purchase still process when the Location
    is no longer active.
13. Every webhook return path stores its `outcome` (one assertion per status).
14. Cross-user isolation: the event card id matches one user's purchase but the
    Location maps to a different business → `unresolved_*`, no change.
15. Lock-order smoke test: concurrent unlink, explicit claim, sweep and account
    deletion for the same user complete without deadlock. Run it several times.

Keep the existing 33 pure tests and 3 integration suites passing. Keep both apps'
TypeScript checks passing.

## 6. Out of scope for this task

R5–R9 (manual-spend command binding, concurrent retry, undo after staff deletion,
and the two shopper UI issues) are the next tasks. Also out of scope: deployment,
secrets, provider dashboard actions, scheduling the sweep, live data and new
fixtures.

## 7. Acceptance, to be checked by Claude's review

- Recovery can't undo a removal. Only an explicit relink can, and never while a
  delete is running.
- No DELETE is sent for a card that has an active row. No active row survives a
  confirmed delete of the same enrollment.
- Every card we refuse or remove has a durable row until Fidel confirms deletion.
- Account deletion covers local rows and provider-only cards, and blocks new claims
  while it runs.
- Clearings and refunds resolve to the original purchase and purchaser after
  unlink, relink or reuse of the card id by another user. Nothing moves to another
  user.
- Auth earns only at an Active Location with an active card and a membership, and
  every unawarded event has a stored outcome.
- All new functions are service-role only with `search_path = ''`, and existing
  client privileges are unchanged.
- The new migration is additive. The old Edge Functions keep working against it
  until they are redeployed, so deployment can be done in stages.
