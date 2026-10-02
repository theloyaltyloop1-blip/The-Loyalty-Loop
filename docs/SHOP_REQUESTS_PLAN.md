# Shop requests: "Request this shop" (design, 2026-10-02)

Owner: Claude (design). Builder: Codex. Status: **phase A built locally; Claude review pending**. The product owner confirmed S1 operator email and S2 threshold setting 5. No live deployment; provider-policy and key blockers below.

## 1. What it does

A shopper searches for a local shop that isn't on The Loyalty Loop and taps **Request this
shop**. When enough *different* shoppers have asked for the same shop, The Loyalty Loop
contacts the shop with a short, honest pitch:

> "8 people near you have asked for Bean & Leaf on The Loyalty Loop."

When the shop joins, everyone who asked gets a push notification: "Bean & Leaf just joined.
You asked for it." This closes the loop and gives the shop a ready first wave of members.

This feeds option 1, the outreach bot. Option 1 isn't built yet. The `shop_requests` table
is the bot's queue of warm leads: a shop that already has demand is a better lead than a cold
search result.

## 2. Identifying the shop: Google Places

Free text ("the coffee place on Briggate") can't be grouped reliably. One shop would split
into several entries and never reach the threshold. So the shopper picks the shop from Google
Places results, and the stable **`place_id`** is the key everything is grouped by.

- New edge function **`shop-request-search`** (JWT required). It proxies Places Text Search
  (New) with a field mask limited to `id, displayName, formattedAddress, location,
  primaryType, websiteUri, nationalPhoneNumber`. It's biased to the shopper's location and
  restricted to the UK. The API key stays server-side in a new secret, `GOOGLE_PLACES_API_KEY`.
  Don't reuse the Maps SDK key, which is restricted to the apps.
- It removes results that are already on the platform: an active, approved `businesses` row
  within about 75 m whose normalised name matches. (`businesses` has `lat`/`lng` but no
  `place_id`. Add a nullable `google_place_id` column, filled when a shop joins, for an exact
  match later.) For an already-listed result, the app shows **View shop** instead of Request.
- Cost control: at most 30 searches per user per day, with a 2-character minimum query and a
  400 ms debounce in the app. Search results aren't stored. Only a requested shop is saved.

## 3. Data model (one additive migration)

```
public.requested_shops
  place_id text primary key
  -- No durable Places name/address/location/contact data; fetch details transiently.
  request_count int not null default 0             -- distinct requesters, kept by the RPC
  status text check in ('collecting','ready','contacted','joined','declined','suppressed')
  ready_at, contacted_at, joined_at timestamptz
  joined_business_id uuid references businesses(id)
  created_at, updated_at

public.shop_requests
  place_id text references requested_shops on delete cascade
  user_id uuid references auth.users on delete cascade
  created_at timestamptz
  primary key (place_id, user_id)                  -- one vote per person per shop
```

- RLS on both. Shoppers can read **only their own** `shop_requests` rows, for the "Requested ✓"
  state, and nothing in `requested_shops` except through the RPC. No direct client inserts.
- RPC **`request_shop(p_place jsonb)`**, `security definer`, `auth.uid()` required:
  - re-validates the place against a short-lived token from `shop-request-search`, so the
    client can't invent place data (HMAC over `place_id` + user + expiry, signed with a new
    secret, `SHOP_REQUEST_SIGNING_SECRET`);
  - inserts the vote with `on conflict do nothing`, so repeat taps are free and idempotent;
  - limits each user to 10 new requests per day;
  - recounts `request_count` from `shop_requests` (never `+1`, so it can't drift) and moves
    `collecting → ready` when the count reaches the threshold (§7, default **5**);
  - returns `{requested: true, count}`.
- RPC `withdraw_shop_request(place_id)` deletes the caller's vote and recounts. It doesn't
  move a shop back out of `ready`.
- Account deletion: the cascade removes the user's votes. Counts are recomputed by the same
  recount function, called from `delete-my-account`.

## 4. Contacting the shop

The email address is the hard part. **Places doesn't return email.** Until option 1's email
finder exists, the default is (§7, decision S1):

**Phase A (build now): the operator is notified, and a person sends.** When a shop turns
`ready`, edge function **`shop-request-notify`** (service role, secret-authenticated, woken by
a pg_net call from the RPC) emails the operator, via Resend, at the existing admin address. It
includes the shop's Places details, the request count, and a ready-to-send pitch with a
personal join link (`/join?ref=req_<place_id hash>`). The operator sends it, calls or drops
in, then marks it `contacted` in the admin app (`/admin/shop-requests`: list, sort by count,
change status).

**Phase B (with option 1): the bot emails the shop.** It sends only to a business address
found on the shop's own website, never one guessed or bought. Each shop is emailed at most
**once**, plus one follow-up after 14 days if the count has grown by 3 or more. Every email
has a one-click "don't contact us again" link, which sets `suppressed` permanently.

Why the default is a human: under UK PECR, unsolicited marketing email to a **sole trader or
partnership** needs prior consent. Only limited companies can be emailed on an opt-out basis.
Most independent cafés and shops are sole traders, and an automated system can't tell which a
shop is. A person who calls or visits (or, in phase B, a bot that emails only addresses the
shop publishes for business enquiries, checked against Companies House) keeps this lawful. **This is
a flagged risk for the product owner, not legal advice.**

## 5. Honest wording (applies to every message)

- Say "**people near you**" or "**local shoppers**", not "your customers". We don't know
  they've shopped there, and claiming it would mislead (CAP Code).
- Use the real count at sending time. Never round it up.
- Never name or identify the people who asked. The shop sees only the count.
- Shopper-side copy: "We'll let them know local shoppers want them. If they join, we'll tell
  you." No promise that the shop will join.

## 6. Shopper app (OTA-only, no native build)

- Search on the **Map** tab and in the home search: when a search has no platform results, show
  a "Can't find your favourite shop? **Ask them to join**" row. It opens a pop-up sheet (the
  existing `Sheet` component), matching the user's design preferences.
- The sheet shows the Places search results. Each row has the name, address, and a **Request**
  button that becomes **Requested ✓** and shows "3 people have asked". Reuse the existing
  `SuccessCheck` animation on the first request.
- Profile has a "Shops you've asked for" list. Each entry shows its status, plus Withdraw.
- When a requested shop joins: the business-approval path checks `requested_shops` by
  `google_place_id` (or the operator links it in admin). It sets `joined` and sends one push to
  each requester through the existing push path (`send-user-push`). The push opens the shop page.

The web dashboard and map now have the same request dialog; web Profile lists requested shops.

## 7. Confirmed decisions (product owner)

- **S1. Who contacts the shop?** Recommended: **phase A, the operator** is emailed a ready pitch
  and decides how to reach out. The alternative is to wait for option 1 and send automatically,
  with the PECR caveat in §4.
- **S2. Threshold.** Recommended: **5 distinct shoppers**. Lower is faster but gives a weaker
  pitch. It's stored as a setting so it can change without a migration.

## 8. Tests Codex must add (disposable local PostgreSQL plus a fake Places API)

1. Votes are idempotent: the same user tapping twice gives count 1.
2. Distinct counting: 5 different users move the shop to `ready`, and `shop-request-notify`
   is woken exactly once, even when two of those votes arrive concurrently.
3. The per-user daily cap (10) and the search cap (30) are enforced server-side.
4. Forged place data, or a token for a different user, `place_id` or an expired token, is
   rejected.
5. An already-listed shop can't be requested (the search filters it and the RPC rejects it).
6. Withdrawing a vote and deleting an account recount correctly. A `ready` shop stays `ready`.
7. A shopper can't read other users' votes or the `requested_shops` contact fields through
   REST.
8. A `suppressed` shop is never contacted again, and new votes are still accepted silently.
9. On joining, each requester gets one push, and no one else does.
10. No requester identity appears in the operator email or any shop-facing text.

Also run: `deno check` on both new functions, and the shopper, web, retailer and admin type
checks.

## Verified implementation notes and release blockers (Codex, 2026-10-02)

Confirmed owner choices: S1 operator email; S2 stored threshold 5. Phase A is built locally against fakes. Shopper OTA stays held for Claude review.

- Signed tokens bind all returned fields, user and a 10-minute expiry. A token binding only the place ID would permit forged contact/name/address data.
- Text Search regionCode is a preference, not a UK restriction. addressComponents is added to the field mask to verify country=GB and extract postcode; non-GB results are discarded. Source: https://developers.google.com/maps/documentation/places/web-service/text-search
- **Provider-contract conflict requiring Claude architecture review before live deployment:** the proposed persistent Places name/address/location/website/phone snapshot is not established as permitted by Google's caching policy. The policy expressly exempts place IDs, not general POI data; the Autocomplete user-address exception does not apply to POI lookups. Current schema/tests implement the requested plan using fake data only. Resolve by retaining IDs/votes durably and fetching details transiently, or establish an applicable contractual permission; do not assume a refresh schedule grants storage permission. Source: https://developers.google.com/maps/documentation/places/web-service/policies
  - **Resolved by Claude (2026-10-02):** store only the `place_id` permanently, and fetch details only when needed without storing them. Exact contract is fix B1 in CLAUDE_HANDOFF.md ("Review: WhatsApp stage 2 + shop requests phase A"). §3's details columns are removed in that fix.
- Compact sheet uses Google Maps text attribution; policy accepts this where interface space is limited. No Places reviews/photos are requested.
- Operator email and Expo push use a durable pre-send claim: concurrent wakes cannot duplicate a message. An ambiguous/crashed provider call is terminal and needs manual investigation. Admin flags unconfirmed email delivery. Resend's idempotency retention is 24 hours, so it cannot alone justify unbounded exactly-once retries. Source: https://resend.com/docs/dashboard/emails/idempotency-keys
- Exact ownership/approval checks remain on the database. REST-equivalent grants/RLS are tested through PostgreSQL roles; a full Supabase REST replay is still a release check.
