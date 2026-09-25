# Automatic earning from the shop's own card machine: SumUp, Square and Zettle

Research, 25 September 2026. Produced by a Claude cloud research agent from official
developer documentation, API specifications, terms and the official Square developer
forum. Nobody signed up for anything, contacted any company or changed code.

**Labels:**
- **[verified]:** read in official docs, the official API spec or official terms.
- **[forum]:** a Square staff answer on the official developer forum.
- **[inferred]:** the agent's own reasoning.
- **[unverified]:** couldn't be confirmed.

## Executive summary

- **Square is the only one of the three that gives a stable card identifier.** Every
  card payment carries `card_details.card.fingerprint`. Square's API reference (the
  official field-by-field documentation) says it is meant "to identify the card across
  multiple locations within a single application" [verified]. That is what automatic
  earning after a one-time pairing needs.
- **The fingerprint's scope is narrower than it looks.** A Square staff member says it is
  unique "for the sellers account and the sellers account only" [forum]. The same card
  paid by Apple Pay and paid by chip gets **different** fingerprints [forum]. So one
  customer may need a pairing per shop and per way of paying. Only a test in Square's
  sandbox (its free test environment) or a live pilot can settle this.
- **Square has everything else an MVP needs:**
  - OAuth connect (the shop logs in to Square and approves our access);
  - signed webhooks (instant server-to-server notifications) for `payment.created`,
    `payment.updated`, `refund.created` and `refund.updated`;
  - refunds linked to the original payment;
  - `location_id` on every payment, so we always know which shop it was, unlike Fidel
    with SumUp/Square/Zettle shops;
  - free API access, a sandbox, and UK support [verified].
- **SumUp is weak for this.** For payments on the shop's own card machine there are **no
  webhooks**, so we'd have to poll (repeatedly ask the API) [verified]. It exposes only
  the last 4 digits and the card brand, with **no fingerprint** [verified]. Matching would
  be a guess from "last 4 + brand + amount + time". OAuth access to transaction history
  is a default scope, and the API is free [verified].
- **Zettle sits in the middle:** signed webhooks (`PurchaseCreated`) and good refund
  links, but only a masked card number (first 6 and last 4 digits), with no fingerprint
  and no sandbox. Part of the evidence comes from a documentation repository Zettle
  deprecated in 2022 [verified].
- **Recommendation:** build Square first, as a separate automatic source next to Fidel
  and staff entry, at roughly **medium** effort. Keep staff entry and Fidel for SumUp and
  Zettle shops for now.
- **The QR pairing idea can work on Square,** with strict matching that is accepted only
  when exactly one payment fits. A fingerprint linked to a named customer is personal
  data under UK GDPR (the ICO says so), so it must be covered in the privacy notice and
  deleted on request.
- **Double counting:** the safe rule is one automatic source per shop (POS or Fidel,
  never both). Each provider's payment ID must also be stored with a uniqueness
  constraint.

## Comparison table

| Question | Square | SumUp | Zettle (PayPal) |
|---|---|---|---|
| Access | OAuth code flow; 30-day access token, non-expiring refresh token [verified]. `PAYMENTS_READ` (+ optional `CUSTOMERS_READ`) [verified]. Marketplace listing apparently not required [forum, community reply, not staff] | OAuth; `transactions.history` is a default scope; about 1-hour tokens plus a refresh token [verified] | OAuth for public integrations; `READ:PURCHASE` [verified, deprecated repo] |
| UK | Yes [verified] | Yes [verified] | Yes [verified, deprecated repo] |
| Webhooks | `payment.created/updated`, `refund.created/updated`; HMAC-SHA256 over URL + raw body in `x-square-hmacsha256-signature` [verified] | Only online checkouts and Cloud-API-started payments. **Nothing for normal payments on the shop's machine** [verified] | `PurchaseCreated`; HMAC-SHA256 of `timestamp.payload` in `X-iZettle-Signature` [verified] |
| Polling | `ListPayments` covers POS, hardware and API payments [verified]; 429 means back off | `transactions/history?changes_since` [verified]; limits undocumented | `GET /purchases/v2`; 429 when rate-limited [verified] |
| Card identifier | `fingerprint`, `last_4`, `card_brand`, `entry_method` [verified] | `last_4_digits` and type only [verified] | `maskedPan` (first 6 + last 4), type, entry mode [verified] |
| Fingerprint scope | Docs: "within a single application"; Square staff: per seller account; wallet and physical card differ [conflicting] | None | None |
| Customer link | `customer_id`, `buyer_email_address`, Customers API [verified] | None on in-person payments [verified] | Not researched in depth |
| Their own loyalty | Square Loyalty: paid, one programme per seller, available in the UK [verified] | n/a | n/a |
| Cost | APIs free [verified] | "Currently provided free of charge", fees may come later [verified, Malta version of the terms] | Free [verified, deprecated repo] |
| Refund link | `PaymentRefund.payment_id`, `refund_ids`, `refunded_money` [verified] | `REFUNDED` status, `refunded_amount`, REFUND events [verified] | A refund is a new purchase; `refundsPurchaseUUID1` points to the original [verified] |
| Sandbox | Yes: up to 10 test sellers and webhooks, no physical hardware [verified] | Yes: sandbox merchant and a Virtual Solo reader [verified] | None, per the 2022 FAQ; current status unverified |

## Square

**Access:**
- OAuth. Access tokens expire after 30 days; code-flow refresh tokens don't expire;
  PKCE refresh tokens (a variant for apps that can't keep a secret) are single-use and
  last 90 days [verified].
- `PAYMENTS_READ` is needed for payments and payment webhooks, and `CUSTOMERS_READ` is
  optional [verified].
- A community (not staff) forum reply says there's no hard limit on connected merchants
  and no Marketplace partnership is needed [unverified].

**Webhooks:**
- Events: `payment.created`, `payment.updated`, `refund.created` and `refund.updated`.
- Signature: HMAC-SHA256 of key + notification URL + raw body, compared in constant
  time.
- Delivery: retried for 24 hours, possibly out of order or duplicated, so use
  `event_id`. `merchant_id` is included [verified].

**Payment fields:** `amount_money`, `status`, `created_at`, `location_id`,
`source_type`, `customer_id`, `buyer_email_address`, `refund_ids` and `refunded_money`.
The card object carries `fingerprint`, `last_4` and `card_brand`. `entry_method` is one
of KEYED, SWIPED, EMV, ON_FILE or CONTACTLESS [verified]. `ListPayments` includes Square
POS payments [verified].

**Fingerprint on card-present payments:**
- The documentation examples only show ON_FILE and KEYED payments.
- Square staff imply chip payments have fingerprints, and that Apple Pay differs from
  the physical card [forum/inferred].
- Wallet payments probably use the phone's device card number [inferred].

**Square Loyalty:** paid, one programme per seller. It's a competitor for shops that
already pay for it [verified/inferred].

**Terms:**
- Developers mustn't "store … permanent copies of … Seller's Content" without the
  seller's express consent.
- Seller data can't be used to train AI, and marketing to contact details obtained
  through Square is restricted.
- The UK terms still cite the 1998 Data Protection Act, so they look dated [verified].
- Our retailer onboarding needs explicit consent to store payment records [inferred].

**Refunds:** `PaymentRefund` carries `payment_id` and a status, and the original payment
gets `refund_ids` and `refunded_money`. POS refunds appear too [verified].

**Sandbox:** free, with up to 10 test sellers, OAuth and webhooks, but no real hardware
[verified]. Card-present fingerprint behaviour needs a real production pilot [inferred].

## SumUp

**Access:**
- OAuth code flow. The default scopes include `transactions.history`.
- `payments` and `payment_instruments` need manual approval, but we don't need them.
- Tokens last about 1 hour, with a refresh token. Client-credentials (app-only) tokens
  can't read merchant transactions. The UK is supported [verified].

**Notifications:**
- The documented webhooks are `CHECKOUT_STATUS_CHANGED` (online) and
  `solo.transaction.updated` (only for payments we start through Cloud API).
- There's nothing for normal in-person payments, so automatic earning means polling
  `transactions/history?changes_since=…` per shop.
- Rate limits and webhook signing are undocumented [verified/unverified].

**Fields:** amount, currency, timestamp, status, `payment_type` and `entry_mode`. The
card object has only `last_4_digits` and the type, with **no fingerprint** [verified].
There's no customer link on in-person transactions [verified].

**Terms:** "currently provided free of charge", but fees may come later. The terms ask
for data minimisation and prior consent where applicable [verified, Malta version; the
GB version wasn't checked].

**Refunds:** `REFUNDED` status, `refunded_amount` and REFUND events [verified].

**Sandbox:** a sandbox merchant and a Virtual Solo reader [verified].

## Zettle (brief)

- **Access:** OAuth for public integrations or an API-key grant for private ones, with
  the `READ:PURCHASE` scope [verified, deprecated repo].
- **Webhooks:** `PurchaseCreated`, signed as HMAC-SHA256 of `timestamp.payload` in
  `X-iZettle-Signature`. There's no updated event [verified].
- **Card data:** `maskedPan` (first 6 + last 4), card type and entry mode. No
  fingerprint [verified].
- **Refunds:** a refund is a new negative purchase whose `refundsPurchaseUUID1` points to
  the original [verified].
- **Sandbox:** none per the 2022 FAQ; current status [unverified]. The live portal
  couldn't be read (it loads with JavaScript), so recheck these facts there.

## Design: automatic earning via the shop's card machine (Square first)

**Parts:**
1. A "Connect Square" OAuth button in the retailer app. We store the encrypted refresh
   token and map Square location(s) to the shop.
2. A `square-webhook` Edge Function: verify the HMAC, ignore repeated `event_id`s, and
   **re-fetch the payment by ID** rather than trusting the webhook body.
3. A `pos_card_links` table: provider, seller ID, fingerprint, user, created and last
   seen. It never stores a full card number.

**Card pairing:**
1. The customer pays by card, and staff scan their QR and tap "Pair card" (or pairing
   rides on a normal staff entry).
2. We store a pending pairing: shop, user, amount, time.
3. When `payment.created` arrives for that location, we match on **exact amount**,
   ±3 minutes and COMPLETED status. The match is accepted only if exactly one payment
   and one pairing fit; otherwise staff are asked to retry.
4. The fingerprint is stored, and that payment is credited once.

**Caveats:**
- If the fingerprint is per seller, pairing works per shop; if it's per application, one
  pairing covers every Square shop. This is **the key pilot question**.
- A phone wallet and the physical card get separate fingerprints.
- A reissued card probably gets a new fingerprint [inferred].

**Alternatives:**
- (a) Double-entry pairing through the existing staff £ entry.
- (b) The shop attaches the customer in Square POS, and we map `customer_id` to our user
  using a verified email or phone.
- (c) Customer self-claim: within 10 minutes the customer enters the amount and last 4
  digits in the app. It's easier to abuse, so it would need rate limits.

**Privacy (UK GDPR):**
- A linked fingerprint is personal data, per the ICO [verified].
- We need opt-in consent at pairing, a privacy-notice update, deletion on unlink or
  account deletion, and a retention limit [inferred].
- Never store the payment records of customers who aren't paired, following Square's
  consent rule and SumUp's data minimisation [verified terms; design inferred].
- A DPIA (data protection impact assessment) and legal review are recommended
  [inferred].

**Double counting (Fidel + POS + staff):**
1. Each shop has one `auto_source`: `fidel`, `square` or none. Square-connected shops
   don't use Fidel, which also avoids Fidel's payment-facilitator isolation problem.
2. A ledger with a unique `(provider, provider_payment_id)`.
3. During a migration, suppress a second credit for the same user and shop with the same
   amount within ±5 minutes, and log it.
4. The retailer app shows "auto-earning active for this card", so staff don't also type
   it in.

**Refunds:**
- On a COMPLETED `refund.created` or `refund.updated`, find `payment_id` in the ledger
  and reverse up to the amount credited. Progress may go negative, and redemption is
  paused, the same as the existing Fidel refund handling [design inferred].
- SumUp: detect `REFUNDED` while polling. Zettle: `refund=true` plus
  `refundsPurchaseUUID1` [verified].

## Verdict

- **Square first:** fingerprint, signed payment and refund webhooks, free, a multi-seller
  sandbox and exact location data.
- **Effort:** medium, about 2–3 engineer-weeks for the MVP (OAuth and token refresh,
  webhook, pairing and matching, ledger with refund reversal, UI and privacy copy)
  [inferred].
- **SumUp:** low value. Polling and last-4 matching are too weak for automatic earning;
  at most reconciliation. Keep SumUp shops on staff entry and Fidel.
- **Zettle:** defer. No fingerprint and no sandbox.

**Main risks:** fingerprint scope and stability, Square's policy for unlisted multi-seller
apps [unverified], consent under Square's terms and UK GDPR, pairing collisions, and
possibly low Square usage among target UK shops (market share not researched).

**Open questions only a sandbox or pilot can answer:**
1. Is the fingerprint the same across two different Square sellers on our app?
2. Is a fingerprint present on chip and contactless payments through Square POS? This
   needs a production pilot, because the sandbox has no hardware.
3. How do Apple Pay, Google Pay and physical-card fingerprints differ, including per
   phone?
4. Does the fingerprint change when a card is reissued?
5. What are the webhook delay and duplication rates, and is `payment.created` already
   COMPLETED for POS payments?
6. What happens with partial refunds and late refunds?
7. SumUp: webhook signing details and polling rate limits.
8. Zettle: does a sandbox exist on the current portal?

## Sources

- **Square:**
  [webhook validation](https://developer.squareup.com/docs/webhooks/step3validate) ·
  [payments webhooks](https://developer.squareup.com/reference/square/payments-api/webhooks) ·
  [refunds webhooks](https://developer.squareup.com/reference/square/refunds-api/webhooks) ·
  [webhooks overview](https://developer.squareup.com/docs/webhooks/overview) ·
  [subscribe](https://developer.squareup.com/docs/webhooks/step2subscribe) ·
  [troubleshooting](https://developer.squareup.com/docs/webhooks/troubleshooting) ·
  [OAuth permissions](https://developer.squareup.com/docs/oauth-api/square-permissions) ·
  [OAuth overview](https://developer.squareup.com/docs/oauth-api/overview) ·
  [retrieve payments](https://developer.squareup.com/docs/payments-api/retrieve-payments) ·
  [refund payments](https://developer.squareup.com/docs/payments-api/refund-payments) ·
  [refunds overview](https://developer.squareup.com/docs/refunds-api/overview) ·
  [OpenAPI spec](https://github.com/square/connect-api-specification) ·
  [forum: fingerprint scope](https://developer.squareup.com/forums/t/how-to-uniquely-identify-payment-card-via-api/14586) ·
  [forum: wallet vs EMV](https://developer.squareup.com/forums/t/can-the-card-fingerprint-be-determined-before-a-payment/20188) ·
  [forum: unlisted apps](https://developer.squareup.com/forums/t/clarification-on-oauth-limits-for-unlisted-private-production-applications/25389) ·
  [international](https://developer.squareup.com/docs/international-development) ·
  [Loyalty API](https://developer.squareup.com/docs/loyalty-api/overview) ·
  [sandbox](https://developer.squareup.com/docs/devtools/sandbox/overview) ·
  [payments pricing](https://developer.squareup.com/docs/payments-pricing) ·
  [errors](https://developer.squareup.com/docs/build-basics/general-considerations/handling-errors) ·
  [developer terms UK](https://squareup.com/gb/en/legal/general/developers) ·
  [developer terms US](https://squareup.com/us/en/legal/general/developers)
- **SumUp:**
  [get transaction](https://developer.sumup.com/api/transactions/get) ·
  [list transactions](https://developer.sumup.com/api/transactions/list) ·
  [webhooks](https://developer.sumup.com/online-payments/webhooks) ·
  [Cloud API](https://developer.sumup.com/terminal-payments/cloud-api) ·
  [OAuth](https://developer.sumup.com/tools/authorization/oauth) ·
  [authorization](https://developer.sumup.com/tools/authorization/authorization) ·
  [OpenAPI spec](https://github.com/sumup/sumup-openapi) ·
  [countries](https://developer.sumup.com/tools/glossary/countries-and-currencies/) ·
  [help](https://developer.sumup.com/help) ·
  [API terms](https://www.sumup.com/en-mt/terms/api/)
- **Zettle:**
  [deprecated docs repo](https://github.com/iZettle/api-documentation) ·
  [Pusher API reference](https://github.com/iZettle/api-documentation/blob/master/pusher-api/api-reference.md) ·
  [developer portal](https://developer.zettle.com/docs/get-started)
- **UK GDPR:**
  [ICO: what is personal data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data/)
