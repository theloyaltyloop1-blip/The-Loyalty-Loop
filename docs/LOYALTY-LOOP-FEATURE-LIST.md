# The Loyalty Loop — Complete Feature List (for rebuild)

Every feature that exists across the three current codebases (web app, retailer
mobile app, consumer mobile app), extracted from the actual code and live
database — not guessed. Grouped so you can build and test one section at a
time, roughly in the order a rebuild would need them (auth → core loop →
owner tools → extras).

**This is the master reference.** The `features/` subfolder splits every
section below into its own small file, in case you'd rather hand off "the
next one" at a time instead of working from one long document — same
content, just split. Use whichever is easier to work from.

This is the companion to `LOYALTY-LOOP-DATA-MODEL.md` (schema/RLS/RPCs) and
`LOYALTY-LOOP-REBUILD-PROMPT.md` (the master prompt). The current live app
(project ref `tampnahezmocslvdugaj`) stays running untouched as a working
reference/backup throughout — every screen described below exists and can be
opened side-by-side while you rebuild.

---

## 0. Foundations

- [ ] Single shared Postgres backend (Supabase: Auth + Database + Storage +
      Edge Functions), used by all three client apps — no per-app backend
      logic duplication.
- [ ] Row-Level Security enabled and enforced on every table (never trust
      client-side checks — every access rule below must be enforced in the
      database, not just hidden in the UI).
- [ ] Central `has_role(user_id, role)` helper + `app_role` enum
      (`consumer`, `business_owner`, `admin`, `staff`) — one source of truth
      for permissions, not scattered boolean flags.
- [ ] `ensure_current_user_bootstrap()` RPC — runs on every login/role-check;
      creates the profile row, grants base `consumer` role, and *consumes*
      any pending state (owner request, staff invite, franchise handoff) to
      grant the right role automatically. This single function is what makes
      self-service signup possible — see §1.

---

## 1. Authentication & Account (all personas)

- [ ] Email + password sign-up (consumer, owner — separate registration
      screens/flows but same underlying `auth.signUp`)
- [ ] Email + password sign-in
- [ ] Google OAuth sign-in (web: redirect flow; mobile: in-app browser +
      manual token exchange since Expo can't use the web redirect flow)
- [ ] Forgot-password flow (email link, single-use, expiring token; UI always
      shows the same "check your email" message regardless of whether the
      address exists — prevents account enumeration)
- [ ] Reset-password screen (consumes the recovery token from the email link)
- [ ] Staff sign-in — same login screen as owners, no separate staff login UI
      (role is resolved server-side after auth, not chosen by the user)
- [ ] Staff self-registration by invite: owner invites by email from
      Settings → invited person signs up/logs in with that exact email →
      `ensure_current_user_bootstrap()` auto-claims the invite and grants
      the `staff` role. No manual approval step.
- [ ] Owner self-service signup: no manual admin approval gate (removed
      2026-07-17) — signing up with intent to own a shop is enough; the
      `business_owner` role is granted the moment they submit the
      "pending owner request", and their shop goes live the moment they
      finish onboarding.
- [ ] Franchise/brand handoff by email: a brand head creates a shop and
      names someone else as its owner by email (with a password the brand
      head sets); that person's account is created immediately and they can
      sign in right away — no waiting for them to register themselves.
- [ ] Sign-out (clears local query cache/AsyncStorage too — cached member
      names/emails must not outlive the session that fetched them, e.g. on a
      shared shop device)
- [ ] Self-service account deletion — deletes personal data (favourites,
      notifications, push tokens, reviews, settings, achievements,
      referrals, role rows, profile, auth user). If the account owns a
      business, requires an explicit second confirmation naming exactly
      what's lost (every customer's card/reward history at that shop too)
      before proceeding.
- [ ] Minimum password length enforced (8 characters)
- [ ] hCaptcha on every auth-facing form (login, register, owner register,
      forgot-password) — token passed through to the corresponding Supabase
      Auth call, not just decorative
- [ ] Supabase Auth leaked-password protection enabled (dashboard toggle)

---

## 2. Core Consumer Loop (the actual product)

- [ ] Browse/discover shops — list view with category, search
- [ ] Map view of shops (Google Maps: web JS API, mobile native
      `react-native-maps` w/ Google provider)
- [ ] Business detail page: name, category, description, hours, photos,
      logo/cover, contact (phone/website/instagram), address
- [ ] Personal stamp/loyalty card per shop the customer has joined —
      supports three loyalty models per shop (owner's choice):
      - [ ] Stamp card (collect N stamps → reward)
      - [ ] Points balance
      - [ ] Tiered (current tier + streak tracking)
- [ ] "Join" a shop's card (insert into `memberships`)
- [ ] Each customer has a personal unique short "stamp code" (`profiles.stamp_code`,
      auto-generated) — how staff look up a customer by code instead of only
      by QR scan
- [ ] QR code identifying the customer (embeds their user id) — shown on
      their card, scanned by staff to add a stamp
- [ ] Staff/owner scan flow: camera-based QR scanner + manual code-entry
      fallback, each scan explicitly classified as stamp vs. reward-redeem
      (not inferred from which tab happens to be open — a real permission
      check happens at classification time)
- [ ] Reward earned automatically once the stamp/point threshold is hit —
      generates a unique redeemable reward (QR token + short code, both
      single-use)
- [ ] Reward redemption flow (staff scans/enters the reward's code, marks
      `redeemed_at`) — atomic, can't be redeemed twice
- [ ] Reward catalog per shop (owner-defined list of rewards + the stamp
      threshold each requires, sortable)
- [ ] Favourites — save shops for quick access
- [ ] Activity feed — chronological history of the customer's stamps/redeems
      across all shops
- [ ] Achievements/badges — unlocked automatically based on activity
      (`sync_achievements()`, server-computed — not client-awarded)
- [ ] Referral system — each user gets a personal referral code; new
      sign-ups can enter it; referrer's invited-count increments server-side
- [ ] Reviews: 1–5 star rating + text, one review per customer per shop,
      **only allowed if the customer is an actual member of that shop**
      (enforced server-side, not just hidden in the UI)
- [ ] Owner/staff can reply to reviews (one reply thread per review)
- [ ] In-app notifications (stamps received, rewards earned, promos, system
      messages) with read/unread state
- [ ] Push notifications (Expo push tokens, server-triggered on
      stamp/reward/promo events)
- [ ] Announcements — shop-specific or platform-wide messages shown to
      consumers
- [ ] Consumer settings: theme, language, notification preferences
      (per-category: offers/rewards/stamps), onboarding-seen flag
- [ ] Cookie consent banner + stored preference (necessary/analytics/marketing,
      versioned so re-consent is asked after a policy change)
- [ ] "Thank you for visiting" courtesy email after a stamp — throttled to
      once per customer per shop per day, respects promo opt-out

---

## 3. Business Owner — Shop Setup & Management

- [ ] Owner onboarding: shop name, category, address + postcode, map pin
      (address autocomplete via a server-side Places proxy — never expose
      the Places API key to the client), description, brand color, logo,
      cover photo
- [ ] Shop goes live **immediately** on finishing onboarding — no waiting
      for approval. A "verified" badge is reviewed separately in the
      background and doesn't block going live.
- [ ] Proof-of-business document upload (VAT cert / Companies House cert /
      utility bill) to a **private** storage bucket, folder-scoped to the
      uploader — required for the verified badge, not for going live
- [ ] Admin reviews verification docs → approve/reject with a reason (shown
      back to the owner)
- [ ] Configure loyalty type + threshold (stamps required / points model)
- [ ] Edit shop profile any time after launch (all onboarding fields, plus
      opening hours as structured JSON)
- [ ] Upload/replace logo and cover photo (public bucket, restricted to
      image MIME types + size cap — no arbitrary file upload)
- [ ] Printable QR poster generator — a poster with the shop's join QR code,
      designed to print and stick on the counter
- [ ] Owner dashboard: live stats (members, stamps given, rewards earned,
      rewards redeemed, reviews) + realtime updates via Postgres change
      subscriptions (no manual refresh needed)
- [ ] "Finish setting up" checklist on the dashboard (address / map pin /
      description) — nudges incomplete profiles without blocking anything
- [ ] Members list — search/browse everyone who's joined the shop's card,
      with their stamp/points progress
- [ ] Individual customer detail view (their history at this specific shop)
- [ ] Win-back emails — automated, sent to members inactive past a
      configurable threshold, with a coupon code; logged (`winback_email_log`)
      so the same person isn't spammed; respects promo opt-out
- [ ] Daily shop report — scheduled digest email/notification of the day's
      activity
- [ ] Targeted promotions — broadcast to all members, or a targeted segment,
      with server-side recompute of the audience (not a client-supplied list)
- [ ] Shop announcements (owner-authored, shown to members)
- [ ] Reviews management — read all reviews, reply to them (subject to a
      staff permission if replying via a staff account)
- [ ] Cancel/deactivate a shop at any time — no lock-in contract

---

## 4. Staff Accounts (per shop)

- [ ] Owner invites staff by email — owner sets the initial password
      directly (staff just signs in immediately, no separate self-registration
      step, no waiting on an email confirmation loop)
- [ ] Re-inviting a previously revoked staff email reuses the same auth
      account and resets their password, rather than erroring
- [ ] Per-staff granular permissions, enforced server-side (not just UI-hidden):
      - [ ] `can_scan_stamps`
      - [ ] `can_redeem_rewards`
      - [ ] `can_respond_reviews`
- [ ] Staff PIN — a short numeric PIN (4–6 digits) the staff member sets for
      themselves, hashed server-side (never stored/compared in plaintext),
      used to unlock the scan screen quickly on a shared shop device without
      re-entering their full password
- [ ] Staff scan screen gated by tabs matching only the permissions they
      actually have (no "Redeem" tab shown to a stamp-only staff member —
      and the server rejects the action even if they somehow reach it)
- [ ] Revoke a staff member's access at any time (their role/permissions
      stop working immediately; the invite can be reissued later)
- [ ] Staff "join a customer on the spot" RPC exists server-side (idempotent,
      permission-checked) but is **intentionally not wired into any UI yet**
      — the product decision on how "simplify joining" should actually work
      was never finalized. Decide the UX before building this one.

---

## 5. Brands / Franchises (multi-shop owners)

- [ ] A shop owner can run more than one shop — shop switcher UI, active
      shop persisted locally, shared reactively across every screen (this
      was a real bug fixed in the current app: don't let each screen keep
      its own independent copy of "which shop is active")
- [ ] "Brand" concept: a named umbrella (e.g. a mini-chain) that groups
      multiple shops, each potentially run by a *different* owner
- [ ] Creating a shop "for someone else": names a new owner by email +
      password, optionally under a brand name — that person's account is
      created immediately and can sign in right away to run their shop
- [ ] A brand head can exist without ever running a shop of their own (pure
      oversight role) — the dashboard shows a brand-overview screen instead
      of a per-shop view in that case
- [ ] Brand overview: read-only rollup of every shop under the brand
      (member counts, stamps today, who runs each one), even shops the
      brand head has fully handed off to another owner

---

## 6. Admin Panel

- [ ] Admin role is bootstrapped via a hardcoded email check at signup time
      (intentional — the one deliberate exception to "no hardcoded roles")
- [ ] Approve/reject pending owner verification requests, with a rejection
      reason shown back to the applicant
- [ ] Approve/reject business listings (legacy path — most shops now go
      live automatically; this remains for edge cases)
- [ ] Review/approve/reject business verification documents
- [ ] Grant/revoke any role for any user
- [ ] Platform-wide announcements: broadcast, edit, activate/deactivate,
      delete
- [ ] Set/override a shop's stamps-required threshold
- [ ] Help & Support inbox: view all open/resolved support requests raised
      by owners, reply (threaded messages), mark resolved/reopen
- [ ] Public platform stats (shops / neighbours / stamps collected) — safe
      aggregate numbers shown on the public marketing site, computed
      server-side so raw table access is never exposed
- [ ] Analytics consistency checker — a server-side job that recomputes key
      metrics and flags drift against cached/displayed values (catches bugs
      in the stats pipeline before they reach an owner's dashboard)

---

## 7. AI-Assisted Features (owner-facing)

- [ ] "Deep AI Business Report" — on-demand AI summary of a shop's reviews,
      performance, and growth suggestions (uses an LLM + optionally
      Firecrawl for competitive context)
- [ ] Business coach chat — conversational AI the owner can ask questions
      about their shop's performance
- [ ] Review insights — AI-summarized themes/sentiment across a shop's
      reviews
- [ ] Analytics summary — AI-written plain-English summary of the raw stats
      on the dashboard
- [ ] All four are owner-only, checked server-side (`owner_id = auth.uid()
      OR has_role(admin)`), never client-trusted

---

## 8. Design System (apply consistently across every screen)

- [ ] Warm/playful visual identity: peach-cream background, vivid
      coral-orange primary, golden-orange accent, plus genuinely distinct
      green and violet accent colors for variety (not near-duplicate
      oranges — that was a real bug in the current app, see
      `LOYALTY-LOOP-DESIGN-SYSTEM.md` for the fixed hex values)
- [ ] Display font: Baloo 2 (headings) — bold, rounded, chunky
- [ ] Body font: Quicksand — rounded, friendly, no thin weights
- [ ] Bubbly 1.25rem border radius as the default across cards/buttons
- [ ] Chunky "sticker" shadow style: solid offset shadow (not blurred),
      thick 3–4px dark-brown borders, slight rotation on cards for a
      hand-placed feel
- [ ] Mobile-first, but web also has a proper desktop layout (sidebar nav
      for the owner dashboard, not just a scaled-down mobile view)

---

## 9. Platform / Infrastructure Features

- [ ] Three codebases sharing one backend: web app (source of truth for
      schema), retailer/owner mobile app, consumer mobile app
- [ ] Web: React + Vite + TypeScript + Tailwind + shadcn/ui + React Query +
      React Router
- [ ] Mobile (both apps): Expo + expo-router + NativeWind
- [ ] PWA support on web (installable, manifest, service worker)
- [ ] "Add to Home Screen" prompt on iOS web (manual Safari share-sheet
      instructions — iOS doesn't support the native install prompt the way
      Android/Chrome does)
- [ ] Hard redirect to the correct native app's Play Store listing for
      Android web visitors (customer pages → shopper app, `/owner/*` pages →
      retailer app) — excludes password-reset links, legal pages, and known
      search-engine bots so SEO and account recovery aren't broken
- [ ] Offline banner (mobile) — shown when the device has no network
      connection
- [ ] Query cache persisted locally (AsyncStorage on mobile) for snappier
      cold starts — but explicitly cleared on sign-out since it can contain
      other people's names/emails on a shared shop device
- [ ] Code-splitting / lazy-loaded routes on web for a smaller initial
      bundle
- [ ] Global error boundary on web (**missing on both mobile apps in the
      current build — a gap to fix, see §11**)

---

## 10. Legal & Compliance

- [ ] Privacy Policy, Terms, Cookie Policy, Data Retention Policy, Merchant
      Agreement & DPA — all as real pages, not placeholders
- [ ] Owner must explicitly accept all applicable legal agreements
      (versioned — `policy_version`) before their shop can go live; each
      acceptance is logged with a timestamp, user agent, and policy version
      for an audit trail
- [ ] Legal PDFs attached to the owner's welcome email
- [ ] Cookie consent is granular (necessary/analytics/marketing) and
      versioned, not a single accept-all button

---

## 11. Security & Hardening Checklist

*(You explicitly asked me to flag anything missed — this section is exactly
that: the security work already done that a rebuild must not silently drop,
plus a couple of real gaps found but not yet fixed.)*

**Must carry forward (already correct, don't regress):**
- [ ] RLS on every table, every policy checking real ownership/role — never
      a table left open "just for now"
- [ ] Every `SECURITY DEFINER` RPC re-checks `auth.uid()` ownership/role
      internally — being callable by `anon`/`authenticated` is fine *only*
      because the function body enforces the real check
- [ ] Staff PINs hashed with `pgcrypto` (`crypt`/`gen_salt('bf')`), never
      compared in plaintext
- [ ] Storage buckets restricted to specific MIME types + a size cap (public
      `logos`/`covers`: images only, 5MB; private `owner_verification_docs`:
      images/PDF, 10MB) — an unrestricted public bucket is an SVG-XSS /
      arbitrary-file-hosting vector
- [ ] Rate-limiting table (`rpc_rate_limits`) for sensitive lookup RPCs
      (e.g. looking up a customer by stamp code) — caps abuse of an
      otherwise-legitimate staff tool
- [ ] Google Places/Maps API keys never shipped to a browser client — routed
      through a server-side proxy edge function that requires a valid
      Supabase session
- [ ] HTTP security headers on the web app: CSP (scoped to the real external
      origins actually used — Supabase, Google Fonts, Google Maps, hCaptcha
      — not a blanket wildcard), X-Frame-Options: DENY, X-Content-Type-Options:
      nosniff, Referrer-Policy, HSTS, Permissions-Policy (camera/geolocation
      scoped to self, everything else off)
- [ ] hCaptcha on every auth form, wired through Supabase Auth's native
      captcha support (not a bolted-on custom check)
- [ ] Account enumeration prevented on password reset (identical response
      whether or not the email exists)
- [ ] Dependency CVEs kept current (`npm audit` clean or consciously
      triaged, not ignored)
- [ ] No secret ever hardcoded in committed source — this was found and
      fixed for a Places API key and an internal edge-function trigger
      secret in the current app; **rebuild it correctly from day one**:
      every secret goes through the platform's real secret-management
      (Supabase Edge Function secrets / hosting provider env vars), never a
      literal string in a `.ts` file with a "temporary" comment next to it

**Real gaps in the current app — fix in the rebuild, don't carry forward:**
- [ ] Add a global error boundary to **both** mobile apps (the web app has
      one; the mobile apps currently have none at all — an uncaught error
      anywhere just crashes the whole app instead of showing a retry screen)
- [ ] Verify the Android Google Maps API key has the correct app
      restriction (package name + release-keystore SHA-1) set in Google
      Cloud Console *before* shipping any screen that renders a native map —
      an unrestricted/misconfigured key is a strong suspect for real crashes
      seen in the current retailer app
- [ ] Edge functions currently return raw internal error messages
      (`String(e)`) to the client on failure in a few places — low severity,
      but the rebuild should return generic messages and log details
      server-side instead
