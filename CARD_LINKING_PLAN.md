# CARD_LINKING_PLAN.md: Fidel card linking in the shopper app

Architecture and UX plan for customer card linking. Author: Claude (architect).
Implementer: Codex, against this document, **only after the product owner confirms it**.
Companion to [ARCH_PLAN.md](ARCH_PLAN.md). That plan covers the webhook and reward
engine that uses cards once they are linked. This plan covers how cards become
linked, how they are verified, how they are unlinked, and what the shopper sees.
It closes ARCH_PLAN.md §6 item 6 and ships together with ARCH_PLAN.md §4.8.

**Status: product decisions D1–D3 answered 2026-09-23 (§1 P5–P7). CL-1 (spike) may
start. CL-2 onward need Claude to review CL-1's findings first.**

**2026-09-23 progress (Claude implementing while Codex is unavailable):**
- CL-2 is written and tested (`20260923182000_fidel_card_linking.sql`) but not applied.
  It went ahead before CL-1 because its design holds whatever CL-1 finds (see the
  handoff).
- **Refinement:** the ⚡ list, the P5 rule and `customer_card_link_status` count only
  shops whose Fidel Location is **active** (a new `business_fidel_locations.fidel_status`
  column), not any Location row.
- **U7 answered from source:** iOS presents Fidel from the root view controller, so the
  app must close our sheet before `Fidel.start()` (see §5.7).

**2026-09-23 release scope (ARCH_PLAN.md §0b, revised the same day):** every shop is
spend-based by release and is submitted to Fidel. But card-linked earning applies only
where that shop's Fidel Location is **Active**. Shops on SumUp, Square or Zettle may take
longer or never become matchable. The ⚡ "earns automatically" badge and the
enrolled-shop prompt (§5.2, §5.5) therefore show **only** for Active shops, through the
per-shop `card_linked_business_ids()` check, which must be based on Active status. Every
other shop earns through staff manual spend entry, using the same rewards.

**2026-09-23, Fidel FAQ:** phone-wallet payments (Apple Pay, Google Pay) are tracked only
if the **full card number from the front of the physical card** is enrolled; a virtual
card number isn't tracked. CL-4 must say this plainly next to "Link a card", for example
"Use the long number on the front of your card, not a virtual card number."

Each claim carries one of these labels:
- **[doc]**: stated in Fidel's official docs (URL in §2).
- **[src]**: read directly from the published `fidel-react-native@3.2.1` package source.
- **[repo]**: read from this repository.
- **[assumption]**: my inference. It must be verified before it is relied on.
- **[unknown]**: I could not verify it. It is listed in §8 with how to resolve it.

---

## 1. Product decisions (confirmed with the product owner, 2026-09-23)

| # | Decision |
|---|---|
| P1 | **Entry points:** a "Linked cards" section in the existing *Your account* sheet, a prompt on the detail page of Fidel-enrolled shops, **and** a one-time intro after sign-in (see note). |
| P2 | **Card limit:** up to **5 active linked cards** per shopper. The server enforces this. |
| P3 | **Shared cards:** a card belongs to one account only. If a card is already linked to another account, the link is refused with a generic message that does not identify the other account. The current holder must unlink it first. |
| P4 | **Account deletion:** delete everything. Every linked card is deleted at Fidel, and all of the person's `linked_cards` and `fidel_transactions` rows are deleted. This matches how `delete-my-account` already removes all of a person's `transactions` [repo]. |
| P5 | **(D1) Cash and unlinked-card visits:** a customer with a linked card can still get a **manual** entry at a Fidel-enrolled shop when staff confirm they paid by cash or with a card that isn't linked. The limit is **3 manual entries per customer per shop per day**, and each must be **at least 30 minutes after the previous one**. This replaces ARCH_PLAN §4.8's blanket block (§3.6). |
| P6 | **(D2)** The "onboarding step" is the one-time post-sign-in intro sheet (§5.4). The pre-sign-in slides are unchanged. |
| P7 | **(D3)** Amex is supported on our program (product owner, 2026-09-23). Visa, Mastercard and Amex are all enabled. |

P1 note: the existing `ShopperOnboarding` slides run **before** sign-in [repo: `AppRoot`
in `App.tsx`]. Linking needs a signed-in user so the server can bind the card (§3).
That is why P6 puts the step after sign-in.

Inherited, unchanged: ARCH_PLAN.md decision #7. Linking goes through Fidel's SDK,
Fidel's `card.id` is the resolution key, and we never handle card numbers.

## 2. Provider facts (researched 2026-09-23)

Sources:
- React Native guide v2: https://docs.fidelapi.com/docs/select/sdks/react-native/guide-v2
- React Native reference v2: https://docs.fidelapi.com/docs/select/sdks/react-native/reference-v2
- v1→v2 migration: https://docs.fidelapi.com/docs/select/sdks/react-native/migration-guide
- SDK security guidelines: https://docs.fidelapi.com/docs/select/sdks/security-guidelines
- iOS guide: https://docs.fidelapi.com/docs/select/sdks/ios/guide-v2
- Android guide: https://docs.fidelapi.com/docs/select/sdks/android/guide-v2
- Cards: https://docs.fidelapi.com/docs/select/cards
- Select webhooks: https://docs.fidelapi.com/docs/select/webhooks
- API reference: https://reference.fidel.uk/reference/get-card, `/delete-card`, `/list-cards-from-metadata-id`
- npm package `fidel-react-native` 3.2.1 (published 2026-07-23). I inspected the tarball
  directly. GitHub: https://github.com/FidelLimited/rn-sdk

### 2.1 There is an official React Native SDK. No custom bridging needed.

- `fidel-react-native` bridges Fidel's native iOS and Android SDKs [doc][src]. We do
  **not** write our own Swift/Kotlin bridge.
- **The docs lag the package.** The docs describe "v2". npm's latest is **3.2.1**
  (releases 3.0.4 in Dec 2025 through 3.2.1 in Jul 2026). I found no v3 docs. I read
  the v3 package source to confirm the API below still matches the v2 docs [src].
- **iOS:** CocoaPods dependency `Fidel`, podspec `platform :ios, "15.1"` [src]. That
  matches Expo SDK 54's iOS minimum [assumption, confirm in the spike].
- **Android:** depends on `com.github.Enigmatic-Smile:android-sdk:3.1.6` plus
  `kotlin-multiplatform-analytics:1.4.0`, with `minSdkVersion 24` and `compileSdk 36`
  [src]. These are **JitPack** coordinates. Fidel's Android guide says to add
  `maven { url 'https://jitpack.io' }` [doc]. The library's own `build.gradle` only
  declares `mavenCentral` [src], so **our app has to add the JitPack repository**. In
  Expo that means config (`expo-build-properties` extra Maven repos, or a small config
  plugin). Codex must check the exact key against the Expo docs for the installed SDK.
- **No Expo config plugin ships with the package, and it will not run in Expo Go** [src].
  It needs a dev client and EAS builds.
- **It uses the legacy bridge** (`NativeModules` + `NativeEventEmitter`), not a
  TurboModule [src]. This app runs React Native 0.81 with the New Architecture on
  (the Android map-pin issue in memory confirms New Arch is active). Legacy modules run
  through React Native's interop layer. That usually works, but **it has not been
  verified for this package** [unknown U1].

### 2.2 How the flow works [doc][src]

```js
import Fidel, { ENROLLMENT_RESULT, ERROR } from 'fidel-react-native'

Fidel.setup({
  sdkKey,                       // fetched from our server at runtime, never bundled
  programId,
  programType: Fidel.ProgramType.transactionSelect,  // the only value in v3 [src]
  options: {
    bannerImage, allowedCountries, defaultSelectedCountry,
    supportedCardSchemes, metaData,  // metaData: { id: <required index>, ...custom }
  },
  consentText: {
    companyName,              // required, max 60 chars
    termsAndConditionsUrl,    // required if US/CA allowed; we set it anyway
    privacyPolicyUrl, programName, deleteInstructions, // deleteInstructions max 60 chars
  },
}, (result) => { /* result.type === ENROLLMENT_RESULT | ERROR */ })

Fidel.start()   // presents Fidel's own full-screen card-entry + consent UI
```

What the shopper sees is **Fidel's native screen**. It shows card number, expiry,
country and Fidel's consent text. We can customise only a 100pt banner image, the
consent strings, and the allowed countries and schemes [doc]. We do not build the
card-entry form ourselves, and we must not, because that would bring us into PCI scope.

**Enrollment result fields** (iOS adapter source; the docs list the same set) [src][doc]:
`cardId`, `accountId`, `programId`, `enrollmentDate` (epoch seconds on iOS [src]),
`cardScheme`, `isLive`, `cardExpirationYear`, `cardExpirationMonth`,
`cardIssuingCountry`, `cardFirstNumbers?`, `cardLastNumbers?`, `metaData?`.

**Error result:** `{ type, subtype?, message, date }`.
- Documented `type` values [doc]: `sdkConfigurationError`, `userCanceled`,
  `deviceNotSecure` (jailbroken or rooted device), `enrollmentError`.
- The source also has `genericError` [src], which the docs do not list.
- `enrollmentError` subtypes [doc][src]: `cardAlreadyExists`, `invalidProgramId`,
  `invalidSdkKey`, `inexistentProgram`, `unauthorized`, `unexpected`.
- The source also has undocumented subtypes: `issuerProcessingError`,
  `duplicateTransactionError`, `insufficientFundsError`, `processingChargeError`,
  `cardDetailsError`, `cardLimitExceededError` [src]. These look like card-verification
  or charge failures. Treat them as a generic "card couldn't be linked" (§5.3).

### 2.3 Security guidance from Fidel [doc]

- "Do NOT store the SDK key in your client-side application's codebase or commit it in
  your repository." Fidel recommends a server endpoint that hands the SDK key to the app
  at runtime, because it also makes key rotation easy.
- Card type, last four digits and expiry are "not subject to PCI compliance" and may be
  stored.
- The SDK itself detects jailbroken or rooted devices (`deviceNotSecure`).

### 2.4 Server-side Card API [doc]

- `GET /v1/cards/{cardId}`, header `Fidel-Key`. Returns `items[]` with card fields,
  including `programId`, `accountId` and `live`. **The reference does not list
  `metadata` in this response** [unknown U2].
- `DELETE /cards/{cardId}` returns 204 per the reference page. The reference page shows
  no `/v1` prefix while every other endpoint has one [unknown U3]. The docs do not say
  whether transactions stop immediately, or whether re-enrolling the same card number
  afterwards gives a new `card.id` [unknown U3].
- `GET /v1/cards/metadata/{metadataId}` ("List Cards from Metadata ID"). Card
  `metadata.id` is mandatory and is "a non-unique index" [doc]. **This endpoint is how
  the server verifies a card (§3).**
- Transaction webhook payloads include `card.metadata` [doc: webhooks example].
- Webhooks `card.linked` and `card.failed` exist [doc]. They are per program and per
  event, each with its own `secretKey`. **The documented `card.linked` example has no
  `metadata` field**, so on its own it cannot tell us which user a card belongs to.
  This plan does not depend on it (§3.5).

## 3. Security design: server-verified card ownership

### 3.1 Threat

The SDK callback runs on the shopper's phone. If the server stored whatever `cardId`
the app posted, a modified client could post a `cardId` it learned elsewhere, such as
another user's card. It would then receive that user's rewards, or block the real owner
from linking. **The server must prove a card was enrolled by this user before storing
it**, without trusting anything the client says about the card.

### 3.2 Mechanism: a per-user secret metadata id, checked against Fidel

1. Each user gets a server-generated, random, opaque **`fidel_metadata_id`** (128-bit,
   for example `crypto.randomUUID()`). It is stored in a server-only table and returned
   only to that signed-in user. It is not their `user_id`, so Fidel never receives our
   internal ids and nobody can guess it.
2. The app passes it to `Fidel.setup({ options: { metaData: { id: fidel_metadata_id } } })`.
   Fidel records it on every card this user enrolls.
3. After `ENROLLMENT_RESULT`, the app sends `{ cardId }` to our server. The server does
   not trust it. It calls `GET /v1/cards/metadata/{fidel_metadata_id}` using our
   **secret API key**. It accepts the card only if **all** of these hold:
   - the card appears in that list;
   - `programId` equals our configured program;
   - `live` matches the environment (test cards are never accepted in live, and the
     reverse).
4. The server inserts the row with the **service role**. Clients still have no write
   access to `linked_cards`. That boundary was already approved in checkpoint 1.

**Why this is sufficient:** to claim a card, an attacker would have to know the victim's
secret `fidel_metadata_id`, and that only ever reaches the victim's device. An attacker
*can* enroll their own card under their own id, which is legitimate use. They could also
enroll their own card under someone else's id *if* they had it, but that only gives the
victim extra progress. It moves nothing out of the victim's account. If a device is
compromised, the server can rotate the user's `fidel_metadata_id`. The rotation only
affects future links.

**Recovery comes with this design.** If enrollment succeeded at Fidel but the app died
before telling our server, re-entering the same card returns `cardAlreadyExists` and no
`cardId` [doc]. The server repairs this by listing cards under the user's metadata id and
claiming any active card that is not yet stored. The app calls this "claim pending" path
whenever the Linked cards view opens, and again after a `cardAlreadyExists` error (§5.3).

### 3.3 Components

**Table `public.fidel_link_identities`** (new)
`user_id uuid pk references auth.users on delete cascade`,
`metadata_id text not null unique`, `created_at`, `rotated_at`.
RLS enabled with **no client policies**. Only service-role functions read it.

**Changes to `public.linked_cards`**, in the §7 migration:
- Replace the global `unique (fidel_card_id)` with a **partial unique index
  `where unlinked_at is null`**. Today, if Fidel returns the same `card.id` after an
  unlink and re-link [unknown U3], the insert would fail and the shopper could never
  re-link that card. Keeping unlinked rows is still required for audit, because
  `fidel_transactions.linked_card_id` points at them. The webhook RPC already resolves
  cards with `unlinked_at is null` [repo], so it is unaffected.
- Add `fidel_deleted_at timestamptz` and `fidel_delete_error text`. These record whether
  Fidel's copy is really gone (§3.4).
- Add `unlink_reason text check (unlink_reason in ('user','account_deleted','admin','cap_exceeded'))`.

**Edge Function `fidel-card-session`** (user JWT required)
- Returns `{ enabled, sdkKey, programId, metadataId, activeCount, limit: 5, consent: {…} }`.
  It creates the `fidel_link_identities` row on first call.
- If `activeCount >= 5` it returns `{ enabled: true, atLimit: true }` **without** the SDK
  key, so the app never opens Fidel's screen for an enrollment the server would reject.
- `enabled: false` (from a `FIDEL_CARD_LINKING_ENABLED` secret) is a server-side
  **kill switch**. It hides every entry point without shipping a new app build.
- Secrets used: `FIDEL_SDK_KEY`, `FIDEL_PROGRAM_ID`. The SDK key is never logged or
  written to the handoff.

**Edge Function `fidel-card-claim`** (user JWT required)
- Body: `{ cardId?: string }`. With a `cardId`, the server claims that card only if it
  is found under the user's metadata id. With no `cardId`, it claims every unclaimed
  card found there (recovery).
- It calls Fidel with `FIDEL_API_KEY` (the secret key already planned in ARCH_PLAN §6a).
- It then calls a **service-role RPC `claim_linked_card(user_id, card fields…)`**. The
  RPC locks the user's `fidel_link_identities` row `FOR UPDATE`, which serializes
  concurrent claims so the 5-card check is not open to races. It then re-counts active
  cards and inserts the row.
- If the card is already active on **another** user, the RPC refuses (P3). In practice
  Fidel should already have stopped this with `cardAlreadyExists` [unknown U4]. This is
  the database backstop.
- If the user is already at the limit, the server **deletes the card at Fidel** and
  returns `limit_reached`. Otherwise the card would sit enrolled in our program with no
  owner.
- It returns only display fields: scheme, last four, linked date. It never returns
  Fidel ids or first numbers to other screens.

**Edge Function `fidel-card-unlink`** (user JWT required)
- Body: `{ linkedCardId }`, which is our uuid, not Fidel's id. The function verifies the
  row belongs to the caller.
- Step 1: set `unlinked_at = now()` and `unlink_reason = 'user'`. From this commit the
  webhook no longer resolves the card, so earning stops immediately, whatever Fidel does.
- Step 2: call Fidel's delete endpoint. On success, set `fidel_deleted_at`. On failure,
  record `fidel_delete_error` and leave the row for a retry sweep (a `pg_cron` job,
  modelled on ARCH_PLAN §4.6, retrying rows with `unlinked_at` set and
  `fidel_deleted_at` null, capped at 24h and then alerting). The shopper still sees
  "Removed", because from our side it is.
- Progress already earned stays. Unlinking never claws back spend.

### 3.4 Account deletion: an existing bug this plan must fix

[repo] `20260922194020_fidel_spend_schema.sql` declares
`fidel_transactions.user_id … on delete restrict` and
`fidel_transactions.linked_card_id … on delete restrict`. `delete-my-account` ends with
`admin.auth.admin.deleteUser(user.id)`. **As soon as a shopper has one Fidel
transaction, account deletion will fail** with a foreign-key violation. Apple requires
in-app account deletion, so this would be an App Store problem.

Fix, per P4 (delete everything). Keep the `restrict` foreign keys, because they protect
the audit trail from accidental deletes. Extend `delete-my-account` to run, in order and
**before** its existing table loop:
1. For every `linked_cards` row with `fidel_deleted_at is null`, call Fidel delete. If any
   call fails, **stop and return an error** ("We couldn't finish removing your linked
   cards. Please try again in a few minutes."). Do not delete the account while Fidel
   still holds cards we can no longer trace to anyone. Leave a log entry.
2. Delete the user's `fidel_transactions`, then their `linked_cards`. The
   `fidel_link_identities` row cascades.
3. Continue with the existing flow. It already deletes `transactions` (including
   `type='spend'` rows), `rewards`, `memberships` and `notifications`.

`fidel_webhook_events` holds only Fidel event and transaction ids and no user id, so it
stays as the idempotency ledger. Update the account-deletion row detail in the Settings
sheet to mention linked cards: "Permanently removes your login, linked cards, stamps and
rewards".

### 3.5 What we deliberately don't use

- **The `card.linked` webhook.** Its documented payload has no metadata, so it cannot
  identify our user, and §3.2 already covers recovery. It could be added later as a
  monitoring signal only. Not in scope.
- **Client-supplied card fields.** The server stores scheme, last four and expiry from
  **Fidel's API response**, not from the app's callback.

### 3.6 Manual entries for card-linked customers (replaces ARCH_PLAN §4.8's blanket block, per P5)

ARCH_PLAN §4.8 as first written blocked every manual entry for a card-linked customer at
an enrolled shop. That meant a cash visit earned nothing. P5 replaces it with a limited,
confirmed manual path. **It still ships no later than card linking is enabled**, in the
same migration as §3.3.

**When the rule applies:** the customer has at least one active `linked_cards` row, the
business has at least one `business_fidel_locations` row, and the inserter is an owner or
staff member (not an admin). In every other case manual entry behaves exactly as it does
today.

**What staff must do:** declare how the customer paid. Add an additive nullable column
`transactions.manual_payment_method text check (manual_payment_method in ('cash',
'unlinked_card'))`. When the rule applies, the value is **required**. An insert without
it is refused with `linked_customer_payment_method_required`. The value is recorded for
audit and never used in any calculation. Also add `transactions.recorded_by uuid
references auth.users(id) on delete set null`, set by the trigger to `auth.uid()`.
Today `transactions` records no inserter at all [repo: `0004_core_loop.sql`], so without
this column there would be no staff audit trail. `set null` keeps account deletion of a
staff member working.

**Limits, enforced in the database, not the retailer app:** a `BEFORE INSERT` trigger on
`transactions` (manual `type in ('stamp','spend')` only, and only when the rule applies):
1. Takes a transaction-scoped advisory lock on (customer, business), using
   `pg_advisory_xact_lock` over a hash of both ids. This serializes two staff tapping at
   the same moment. A membership row lock isn't used because a customer's first visit
   may have no `memberships` row yet [repo: `transactions.membership_id` is nullable].
   The lock is taken before any row lock, and nothing else uses this lock key, so it
   adds no deadlock risk.
2. Counts this customer's manual entries at this business (rows where
   `manual_payment_method is not null`) for **today in Europe/London time**
   (`(created_at at time zone 'Europe/London')::date = (now() at time zone
   'Europe/London')::date`). If there are already 3, it refuses with
   `manual_daily_limit_reached`.
3. Finds the latest such entry. If it was **less than 30 minutes ago**, it refuses with
   `manual_too_soon` and returns the time the next entry is allowed.

Why a trigger and not the RLS policy: a policy cannot take a row lock, so two concurrent
inserts could both pass a count check. Admin keeps its existing override for support
corrections.

**Residual risk, accepted by P5:** if a customer pays with a *linked* card and staff
wrongly record "cash", that purchase is credited twice: once by Fidel, once manually.
The daily cap of 3 and the 30-minute gap limit the damage, and `manual_payment_method`
plus `recorded_by` give an audit trail. Optional extra guard, **not** part of P5 unless
you ask for it: also refuse a manual entry within 30 minutes of a Fidel authorization
from the same customer at the same shop.

**Manual entry at a spend-threshold shop:** Fidel-enrolled shops are meant to run
`reward_model = 'spend_threshold'` (ARCH_PLAN §0a). Manual `spend` inserts are currently
service-role only, because the reviewed server-validated manual-spend path doesn't exist
yet [repo, ARCH_PLAN §4.3]. So at an enrolled spend-threshold shop, staff currently
cannot credit a cash visit at all, and legacy `stamp` entries don't feed the spend
balance. This rule must also apply inside that future manual-spend RPC. **Until the RPC
exists, P5 has no effect at spend-threshold shops.** Tracked in §9.

**Retailer app (CL-5):**
- When staff scan a customer at an enrolled shop, the retailer app calls a new
  staff-only RPC, `customer_card_link_status(customer_id, business_id)`. It returns only
  `{ linked: boolean, manualToday: int, nextAllowedAt: timestamptz|null }`, never card
  details. It checks that the caller is owner or staff of that business.
- If `linked`, the app shows a pop-up sheet before recording anything:
  > **This customer has a linked card**
  > If they paid with it, their reward updates automatically, so there's nothing to do.
  > How did they pay? **[Cash]** **[A different card]** **[They used their linked card]**

  "They used their linked card" closes the sheet without inserting anything.
- The database refusals get friendly copy:
  - `manual_daily_limit_reached`: "This customer has had 3 manual entries here today."
  - `manual_too_soon`: "The next manual entry for this customer is allowed at 14:35."
  - `linked_customer_payment_method_required`: "Choose how the customer paid."

  The raw RLS or trigger error is never shown.

## 4. Data exposed to the app

- `linked_cards`: the existing select-own RLS policy already lets the app list the
  user's cards [repo]. Display uses `card_scheme`, `last_numbers`, `linked_at` and
  `unlinked_at is null`. The app never writes to it.
- **Which shops earn automatically:** `business_fidel_locations` is readable only by the
  owner and admin [repo], so the app cannot use it to badge shops. Add a
  `security definer` function **`card_linked_business_ids()`** that returns
  `setof uuid`, granted to `authenticated`. It exposes only the business ids that have at
  least one Fidel location, never location ids, program ids or MIDs.

## 5. UX design

Built on existing shopper patterns [repo `App.tsx`]: the gesture-driven `Sheet`, the
`SettingsSheet` sub-view pattern (`SettingsView` + `SETTINGS_TITLES`, back chevron),
`SettingsGroup`/`SettingsRow` with coloured icon tiles, `Button`, `SuccessCheck`,
`Alert.alert` for confirmations, and the orange brand gradient hero. There are no new
screens or navigation patterns. This follows the user's stated preference for pop-up
sheets and colour.

### 5.1 Your account sheet: new "Payment cards" group

It sits directly under the hero, above "Security & privacy", because it is a primary
feature and not a setting:

```
 PAYMENT CARDS
 ┌─────────────────────────────────────────────┐
 │ [💳 green] Linked cards                  ›  │
 │            Earn automatically when you pay   │   ← detail changes to "2 cards linked"
 └─────────────────────────────────────────────┘
```

- `SettingsView` gains `'cards'`, and `SETTINGS_TITLES.cards = 'Linked cards'`.
- A new `CardIcon` is added to the icon set, drawn in the same stroke style.
- The group is hidden when `fidel-card-session` reports `enabled: false`.

### 5.2 "Linked cards" view (inside the same sheet)

```
 ‹ Linked cards                               ✕
 ┌─────────────────────────────────────────────┐
 │  Earn without scanning                      │  ← soft tinted card
 │  • Pay with a linked card at shops marked ⚡ │
 │  • Your progress updates within seconds     │
 │  • We never see your full card number       │
 └─────────────────────────────────────────────┘
 ┌─────────────────────────────────────────────┐
 │ [VISA] Visa •••• 4735            Remove     │
 │        Linked 23 Sep 2026                   │
 │ [MC]   Mastercard •••• 6015      Remove     │
 │        Linked 23 Sep 2026                   │
 └─────────────────────────────────────────────┘
 [        Link a card        ]                    ← primary Button
 You can link up to 5 cards. 3 left.
 Card details are collected securely by our partner Fidel API.
```

- **Empty state:** the explainer card, then "No cards linked yet", then the button.
- **At 5 cards:** the button is disabled and the helper text reads "You've linked the
  maximum of 5 cards. Remove one to add another."
- **On open:** silently call `fidel-card-claim` with no `cardId` (recovery, §3.2). Only if
  it recovers a card, show it with a brief highlight.
- The "Remove" text button uses the same style as the existing "Unblock" button
  (`blockRowUnblock`).
- Shop-side ⚡ badge: a small "Earns automatically" chip on shop cards and shop detail
  for ids returned by `card_linked_business_ids()`.

### 5.3 Link flow states

| State | What the shopper sees |
|---|---|
| Preparing | Button reads "Preparing…" and is disabled. The app calls `fidel-card-session`. |
| Fidel screen | Fidel's native full-screen form (banner = our logo). The app takes no action. |
| Verifying | Returned to the sheet. Button reads "Checking your card…" and is disabled. The app calls `fidel-card-claim`. |
| Success | `SuccessCheck` animation + success haptic, then "Visa •••• 4735 is linked. You'll earn automatically at shops marked ⚡." Returns to the list. |

Error mapping. Never show Fidel's raw `message` to the shopper; log `type`/`subtype` only.

| Result | Shopper copy / behaviour |
|---|---|
| `userCanceled` | Nothing. Quietly return to the list. |
| `deviceNotSecure` | Alert: "Card linking isn't available on this device. It looks like the device's security has been modified." |
| `enrollmentError/cardAlreadyExists` | First run claim-recovery. If that recovers a card for **this** user, show Success. Otherwise show an alert: "This card is already linked to another account. It needs to be removed there before it can be linked here." (P3: generic, names no account) |
| `sdkConfigurationError`, `invalidSdkKey`, `invalidProgramId`, `inexistentProgram`, `unauthorized` | Alert: "Card linking isn't available right now. Please try again later." Log as an ops alert, because this is a configuration fault. |
| any other `enrollmentError` subtype, `genericError`, unknown | Alert: "Your card couldn't be linked. Check the details and try again, or try a different card." |
| Claim returned `not_found` | Retry claim twice with backoff. If it still fails: "We're finishing linking your card. It will appear here shortly." Recovery runs on the next open. |
| Claim returned `limit_reached` | "You've already linked 5 cards." (The server has already deleted the extra card at Fidel.) |
| Claim returned `already_linked_elsewhere` | Same copy as `cardAlreadyExists`. |
| Network failure (session) | "You're offline. Connect to the internet to link a card." |

### 5.4 One-time "Earn automatically" intro (P1)

On the first `AppHome` load after sign-in, the app shows a pop-up `Sheet` once, only if
**all** of these hold: linking is enabled, the user has 0 active cards, and they have not
seen the intro. The "seen" flag is stored per user id, next to the existing onboarding
flag.

```
 ┌─────────────────────────────────────────────┐
 │  (brand gradient hero, card + ⚡ illustration)│
 │  Earn without scanning                      │
 │  Link the card you pay with. When you use   │
 │  it at a shop marked ⚡, your progress        │
 │  updates by itself.                         │
 │  [        Link a card        ]              │
 │            Not now                          │
 └─────────────────────────────────────────────┘
```

"Link a card" runs the same flow as §5.3. "Not now" dismisses it permanently. The option
stays in *Your account*. The pre-sign-in slides are unchanged.

### 5.5 Shop detail prompt (P1)

On `ShopDetail`, only for enrolled shops:
- **0 cards linked:** a tinted card under the loyalty progress bar: "⚡ Earn
  automatically here. Link the card you pay with." plus a secondary `Button` "Link a
  card" that runs the same flow.
- **≥1 card linked:** a single line: "⚡ Pay with a linked card to earn automatically."
- The existing customer-card/QR prompt stays for non-enrolled shops and as a fallback.

### 5.6 Unlink

Tapping "Remove" opens a destructive `Alert`: *"Remove Visa •••• 4735?"* / "You'll stop
earning automatically when you pay with this card. Progress you've already earned stays."
with [Cancel] [Remove].
- On confirm, the row fades out optimistically and `fidel-card-unlink` runs.
- On failure the row is restored and an alert reads "Couldn't remove this card. Please
  try again."

### 5.7 Accessibility and platform notes

- Every button gets an `accessibilityLabel` that includes the scheme and last four.
- Reduced motion is already handled by `Sheet`.
- iOS: Fidel presents from the top view controller [src: `Fidel.start(from:)`]. The
  "Your account" sheet is an RN `Modal`, so the spike must confirm Fidel's screen appears
  **above** it on both platforms [unknown U7]. If it doesn't, close the sheet, run the
  flow, and reopen it on the Linked cards view.

## 6. Configuration

| Item | Value / owner |
|---|---|
| `FIDEL_SDK_KEY` (test, later live) | Supabase secret. **Product owner** sets it from the Fidel dashboard (Account Settings → SDK Keys). |
| `FIDEL_API_KEY` (secret key) | Supabase secret (already planned in ARCH_PLAN §6a). Product owner. |
| `FIDEL_PROGRAM_ID` | `0c0b69e5-…` (test program in the handoff). Not a secret. |
| `FIDEL_CARD_LINKING_ENABLED` | Kill switch, `false` until the pilot. |
| `consentText.companyName` | "The Loyalty Loop" |
| `termsAndConditionsUrl` / `privacyPolicyUrl` | The existing `${WEB}/legal/terms-of-service.pdf` and `privacy-notice.pdf` |
| `deleteInstructions` | "removing it in Your account › Linked cards" (≤60 chars) |
| `allowedCountries` / `defaultSelectedCountry` | `[unitedKingdom]` / `unitedKingdom`. GBP-only per ARCH_PLAN decision #8. |
| `supportedCardSchemes` | Visa, Mastercard and American Express (P7). `linked_cards.card_scheme` already allows `amex` [repo]. |

**Release implications:**
- This adds a native dependency, so it **needs new EAS builds for iOS and Android**. It
  cannot ship as an OTA update.
- App Store privacy labels and Google Play Data safety need updating (payment info:
  last four digits, scheme, expiry).
- The **privacy notice** must name Fidel as a processor for card linking. That is legal
  copy, owned by the product owner, not Codex.
- The build must include §4.8 and the account-deletion fix (§3.4).
- There is also a mismatch: `apps/shopper/AGENTS.md` points to Expo **v57** docs, but the
  app is on **Expo ~54** [repo]. Codex should use the docs for the installed version.

## 7. Build sequence (review gates)

Codex builds each step and requests Claude review before the next.

- **CL-1 Spike (resolves U1–U7, no production code merged).** Dev-client build on a real
  iOS and a real Android device with `fidel-react-native@3.2.1`, New Architecture on, and
  the Fidel **test** SDK key fetched from a stub endpoint. Enroll a Fidel test Visa
  (`4444000000004***`) and a test Amex (`3400000000003**`) [doc]. The Amex enrollment
  confirms P7 in the sandbox. Record the redacted `ENROLLMENT_RESULT` and `ERROR`
  shapes, including `userCanceled` and `cardAlreadyExists`. From a server script, call
  List-by-metadata, Get Card and Delete Card, then **re-enroll the same test card
  number** to see whether the `card.id` is new. Confirm the Fidel screen appears above
  our `Modal`.
- **CL-2 Migration.** `fidel_link_identities`; the `linked_cards` changes (§3.3);
  `claim_linked_card` RPC; `card_linked_business_ids()`;
  `customer_card_link_status()`; the P5 manual-entry trigger and the
  `transactions.manual_payment_method` / `recorded_by` columns (§3.6).
  Disposable-PostgreSQL tests:
  - Cap race: 6 concurrent claims leave 5 rows.
  - A card active on another user is refused.
  - Re-link after unlink works.
  - The client still cannot insert or update `linked_cards`.
  - P5 applies to a linked customer at an enrolled shop:
    - no payment method → refused;
    - 1st entry allowed; 2nd at +29 min refused; 2nd at +30 min allowed; 3rd allowed;
      4th refused the same London day;
    - allowed again after London midnight, including across a BST/GMT change;
    - two concurrent inserts don't both pass;
    - admin bypasses the rule.
  - P5 does not apply to an unlinked customer or a non-enrolled shop: behaviour is
    unchanged.
  - `customer_card_link_status` refuses callers who are not owner or staff of that shop.
  These changes go in a **new migration**. The four Fidel migrations are being pushed to
  the live project as part of the 2026-09-23 reconciliation (see the handoff), so they
  must not be edited.
- **CL-3 Edge Functions.** `fidel-card-session`, `fidel-card-claim`,
  `fidel-card-unlink`, the unlink retry sweep, and the `delete-my-account` changes
  (§3.4). Tests against a mocked Fidel: a forged `cardId` not under the user's metadata
  is rejected; wrong `programId` or `live` is rejected; the at-limit path deletes at
  Fidel; account deletion with Fidel transactions succeeds and fails closed when Fidel
  delete fails; the SDK key never appears in logs.
- **CL-4 Shopper UI** (§5), behind the kill switch, plus the Expo config for JitPack.
- **CL-5 Retailer app:** the "how did they pay?" sheet and the friendly refusal copy
  (§3.6).
- **CL-6 Sandbox end-to-end** (feeds timeline milestone 9): link → signed
  `transaction.auth` → progress updates → unlink → a later transaction is acknowledged
  as an unknown card and not credited → account deletion removes Fidel cards.

## 8. Unknowns: verify, don't guess

| # | Unknown | Resolved by |
|---|---|---|
| U1 | Does `fidel-react-native` (legacy bridge + `NativeEventEmitter`) work under RN 0.81 New Architecture with Expo 54? **Android: yes (2026-09-23 device test). iOS: untested.** | CL-1 on both platforms |
| U2 | Shape and pagination of `GET /v1/cards/metadata/{id}`. Does `GET /v1/cards/{id}` return `metadata`? | CL-1 |
| U3 | ~~Delete path; new `card.id` after re-enroll?~~ **Resolved 2026-09-23 on Android:** `DELETE /v1/cards/{id}` works, and re-enrolling after deletion returns the **same** `card.id` (the partial unique index is required). Whether transactions stop immediately at Fidel is untested, but earning stops in our database at unlink regardless. | CL-1 |
| U4 | Does Fidel raise `cardAlreadyExists` when the same card number is enrolled under a **different** metadata id (the shared-card case)? The description "Card already enrolled in program" suggests yes. | CL-1 (enroll the same test number from two users) |
| U5 | ~~Is Amex supported on our program?~~ **Resolved:** the product owner confirmed yes on 2026-09-23. It is still exercised with an Amex test card in CL-1. | CL-1 |
| U6 | Can a leaked SDK key do anything beyond enrolling cards? (Fidel implies it only enrolls.) | Claude answers from Fidel's docs (the product owner can't contact Fidel). Until then, assume it can do more, and rotate it on any suspected leak. It affects how often we rotate it. |
| U7 | Does Fidel's screen present correctly above an open RN `Modal` (our Sheet) on iOS and Android? | CL-1 |
| U8 | No v3 docs exist. The v2 docs match the 3.2.1 source for setup and results, but v3 release notes weren't found. | Check the GitHub releases during CL-1 |

## 9. Decisions

Resolved 2026-09-23:
- **D1:** staff-confirmed manual entries, limited to 3 per customer per shop per day and
  at least 30 minutes apart. Recorded as P5, design in §3.6.
- **D2:** the post-sign-in intro sheet. Recorded as P6.
- **D3:** Amex is supported. Recorded as P7.

Still open, and not blocking CL-1:
- **Manual spend at spend-threshold shops.** P5 only matters once staff can credit a
  cash visit at a spend-threshold shop, and that needs the server-validated manual-spend
  RPC (ARCH_PLAN §0a/§4.3), which is not yet designed. That design must include the P5
  trigger. It needs its own design pass before enrolled shops go live on
  `spend_threshold`.
- **Optional guard:** refuse a manual entry within 30 minutes of a Fidel authorization
  for the same customer at the same shop (§3.6). It is off unless the product owner asks
  for it.

## 10. What this changes in ARCH_PLAN.md

These are applied as pointers only. The detail lives here.
- §6 item 6 now points to this plan.
- §3.1 `linked_cards` uniqueness becomes a partial unique index and gains the deletion
  columns (§3.3 here).
- §3's RLS note ("the Fidel linking callback") now means `fidel-card-claim` +
  `claim_linked_card` (§3.3 here).
- The account-deletion FK conflict (§3.4 here) is new. It affects the checkpoint-1
  migration's `restrict` FKs, which are kept, and requires changes to `delete-my-account`.
