# Handoff: current state (as of 2026-09-17)

Read this first if you're a new Claude session picking up this project. Two
other handoff docs sit alongside this one:
- `HANDOFF-CREDENTIALS-AND-MAINTENANCE.md` — expiry dates, secrets, recurring
  Apple maintenance tasks. Check this every session — some of these are
  silent-failure time bombs.
- `HANDOFF-DEV-NOTES.md` — tooling gotchas (EAS/PowerShell, CSP, widget
  deployment targets, RLS patterns, shadcn/ui setup) that will save you
  re-discovering the same bugs.

**Heads up:** another AI agent ("Codex") has worked concurrently on this
same repo in past sessions (home-screen widgets were its work). Check
`git log` and `git status` before assuming you know the full state.

**User's standing rules, worth knowing before you touch anything:**
- **JS-only changes ship via `eas update` (OTA), never trigger a native
  `eas build`** unless the change is genuinely native or the user explicitly
  asks. The user has cancelled a build triggered for a pins-only change
  before.
- **Every Android build goes straight to production** and into Google's
  review immediately — both apps' `eas.json` submit profiles target the
  production track with full rollout. Say so before running `eas submit`;
  it reaches every real user with no staged rollout.
- The Play app "The Loyalty Loop for Business"
  (`com.theloyaltyloop.business`) is old and unused — ignore it. The
  retailer app (`com.theloyaltyloop.retailer`, "The Loyalty Loop - Retailer"
  in Play) is the real one.
- The user likes bottom-sheet pop-ups, gradient hero cards and colourful
  icon tiles in the native apps — a flat grey "native settings list" look
  was explicitly rejected once. Keep that in mind redesigning any screen.

## Apps in this repo
- `apps/shopper` — customer-facing app, "The Loyalty Loop". iOS bundle
  `com.theloyaltyloop.shopper`, ASC App ID `6809930346`. EAS project
  `localoop-rewards`. **Live in production on Google Play** (Android
  versionCode 119) and **in App Store Connect, not yet submitted for
  review** (see below).
- `apps/retailer` — business owner app, "The Loyalty Loop for Business" in
  EAS/code, "The Loyalty Loop - Retailer" in Play. iOS bundle
  `com.theloyaltyloop.retailer`. EAS project `localoop-business`. **Live in
  production on Google Play** (Android versionCode 116). **No App Store
  Connect record exists yet — never built for iOS at all.**
- `apps/web` — the marketing site + shopper/owner/admin web portal, deployed
  to Vercel (project `loyalty-loop`, team `loyalty-loop`) at
  `the-loyalty-loop.com`.
- `apps/admin` — scaffold, not a focus area recently.

## Shopper app — App Store submission state
- **iOS build 6** (`b636e918-3da9-4ce4-b5ee-4ca0fecd47b0`) is uploaded to App
  Store Connect, `processingState` VALID — this is the build to submit. It
  contains in-app account deletion, the current settings bottom-sheet, the
  `NSLocationWhenInUseUsageDescription` string, iPhone-only
  (`supportsTablet: false`), and the native Google map. Everything shipped
  to this build's users since via `eas update` (map pins, settings redesign,
  loyalty-programme wording, announcement push, widget redesign — see
  "Recently shipped" below) is JS-only and already live on it; no new build
  was needed for any of it.
- **App Store Connect version 1.0 is in "Prepare for Submission"**, with:
  - Build 6 attached.
  - **Copyright field set**: `2026 Cotech Software Consultants` (the actual
    Apple Developer Program legal entity — "The Loyalty Loop" is just a
    product name, not a registered company, per the user).
  - **A demo account for Apple's reviewer already exists and is verified
    working**: email `applereview@the-loyalty-loop.com`, password
    `AppReview2026!Loop`. It's already joined to "Loyalty Loop Demo Café"
    with 6 of 10 stamps collected, so the reviewer sees a working loyalty
    card immediately without any setup. These credentials are also already
    filled into App Store Connect's App Review Information (Sign-In
    Information) via the API, along with a note telling the reviewer there's
    nothing else to configure. If this demo account is ever deleted, recreate
    it the same way (see `HANDOFF-DEV-NOTES.md` → "Creating a demo account
    directly in Postgres").
  - Screenshots: the user was mid-upload, last checked 4 of 10 in place for
    the 6.5" display slot. Not finished.
  - Review contact fields (name/phone/email) in App Review Information were
    still empty as of 2026-09-16.
- **App Privacy questionnaire**: published. Declared: Name, Email Address,
  User ID, Product Interaction — all "App Functionality"/"Analytics", all
  linked to identity, none used for tracking. Email is also declared
  "Developer's Advertising or Marketing" because `send-winback-emails` sends
  promotional win-back emails to shoppers.
- **Age Rating questionnaire**: published → **4+**. User-Generated Content =
  Yes (shop reviews), everything else No.
- **Review moderation** (report a review / block a user) shipped so the
  User-Generated-Content=Yes answer is actually backed by Apple's required
  Guideline 1.2 features. See `supabase/migrations/20260910120000_review_moderation.sql`
  and the `reportReview`/`blockAuthor` functions in `apps/shopper/App.tsx`.
- **Still blocking submission** (needs a human with Apple login — Claude
  cannot do these, no password/2FA entry):
  1. Finish uploading screenshots — App Store needs *exactly* 1290×2796 or
     1320×2868 (or the landscape equivalents). Any Play-Store-style
     1080×1920 image will be rejected by the uploader.
  2. Fill in the App Review contact name/phone/email.
  3. Digital Services Act trader info (App Information page) — required for
     EU sale, not for review itself.
  4. Hit **Submit for Review** on the version page. Its release setting is
     `AFTER_APPROVAL` (automatic release the moment Apple approves it, no
     extra click needed) — confirmed via the ASC API, so make sure the user
     actually wants that before submitting, or change `releaseType` first.

## Retailer app — needs its first iOS build and its App Store Connect record
No ASC app exists for `com.theloyaltyloop.retailer` and no iOS build has
ever been produced. Prep work that **is** done, ready for whenever the build
happens:
- `apps/retailer/app.json` → `ios.infoPlist` now has
  `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` (both were
  missing — the app would have crashed on first camera/photo-library access
  with no build-time warning) and `ITSAppUsesNonExemptEncryption: false`.
- `apps/retailer/eas.json` already has an iOS submit profile, and
  `apps/retailer/store.config.json` is written and `eas metadata:lint`-clean.
- The retailer widget (`targets/RetailerScanWidget`) was redesigned
  2026-09-15/16 (brand-gradient card, logo badge, visit count, white scan
  button) — see `HANDOFF-DEV-NOTES.md`. It will ship correctly the moment
  the first iOS build happens; no extra step needed.
- The app uses plain email/password auth (no Google/Facebook sign-in), so
  Apple's Sign in with Apple requirement (guideline 4.8) does not apply to
  it.

Two ways to create the first build, both need a human (interactive Apple ID
+ 2FA, Claude cannot do this):
- Manually in ASC: **+ App** → iOS → name "The Loyalty Loop for Business" →
  bundle `com.theloyaltyloop.retailer` → pick a SKU.
- Or: `cd apps/retailer && npx eas-cli build --platform ios --profile
  production` (interactive — first-time credential setup, same dance the
  shopper app needed) then `npx eas-cli submit --platform ios` (first submit
  auto-creates the ASC record).

## Google Play — both apps live, Claude can publish Android builds directly
Set up 2026-09-12, see `HANDOFF-DEV-NOTES.md` → "Google Play uploads via EAS
Submit" for the full mechanics. Summary: a service account with Release
permissions on both real Play apps, key at
`C:\Users\zahih\keys\play-eas-submit.json` (outside the repo), both apps'
`eas.json` default to the production track with immediate release and
review submission. Current versionCodes: shopper 119 (Android), retailer
116 (Android).

## Google Maps
- **Web owner portal** (`apps/web`, `@react-google-maps/api`, used in Owner
  Settings/Onboarding "Pin location"): CSP fixed in commit `ffce3ef`
  (`vercel.json` needed `'unsafe-eval'` + `blob:` for Maps JS). Confirmed
  deployed and working.
- **Native retailer app** (Android/iOS): still has **no map at all** — no
  `react-native-maps`, no WebView, no Maps API key anywhere in
  `apps/retailer/`. Never built, not a regression. If the business owner
  ever wants a map inside the native app rather than just the web portal,
  that's new scope — ask the user before building it.
- **Shopper app**'s map (the "Map" tab + the shop page location embed) is a
  native `react-native-maps` Google map, working on both platforms.
  - **Android**: a dedicated Android-restricted key
    (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, GCP project `the-loyalty-loop`) is
    baked into Android builds ≥118, restricted to
    `com.theloyaltyloop.shopper` with **both** the upload cert SHA-1 and the
    Play App Signing SHA-1 (Play re-signs everything it distributes, so the
    upload SHA-1 alone shows a grey map with just the Google logo).
  - **Android custom pins**: fixed 2026-09-12 — see `HANDOFF-DEV-NOTES.md` →
    "Map pins on Android". Custom marker views are snapshotted at 100×100 px
    under the New Architecture, so Android now loads a server-rendered PNG
    from the public `map-pin` Supabase Edge Function instead of a view-based
    marker. iOS keeps the native view pin — the two platforms render the
    same visual design through different code paths, so any future pin
    redesign has to be made in both places.
  - A separate iOS key (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`) exists for
    shopper iOS builds — check its bundle-ID restriction before shipping.

## Security review (2026-09-15)
A full pass was run across RLS/security-definer functions, CDN caching,
DNS, GitHub Actions (none exist — no CI in this repo, EAS/Vercel run the
builds), webhook replay protection, source maps, and third-party script
integrity. One real finding, fixed: `request_announcement_push()` was
callable by the `anon` role with no reason to be (see
`supabase/migrations/20260915180000_revoke_public_request_announcement_push.sql`
and the Postgres `PUBLIC`-grant gotcha it uncovered in
`HANDOFF-DEV-NOTES.md`). Everything else came back clean — see that
migration's comment and the dev-notes entry for exactly what was checked.

## Web app: shadcn/ui adopted (2026-09-16)
`apps/web` now uses shadcn/ui's Tooltip, Dialog, AlertDialog, DropdownMenu,
Tabs, Badge, Switch, Select, Textarea and Sonner (toasts) alongside the
existing hand-rolled Button/Card/Input, which are now the real shadcn
versions too. Real usages were migrated, not just installed: every tooltip,
the owner sidebar's shop-switcher dropdown, `window.confirm()`/`prompt()`/
`alert()` calls (review deletion, admin listing rejection, admin error
messages), and the Analytics page's view toggle. Full details, including
two real bugs the setup process itself introduced and how they were fixed
(a CSS token collision that would have silently replaced the brand palette,
and a shadcn CLI bug that writes files into a literal `apps/web/@/` folder
instead of resolving the path alias), are in `HANDOFF-DEV-NOTES.md` →
"shadcn/ui on this project". Verified with a clean `tsc` + production build
and live in the browser (both themes, the new tooltip, the dropdown).

## Recently shipped (this session and the ones just before it), all
committed + pushed to `main`
- Apple Wallet passes, Sign in with Apple (iOS native/Android web-OAuth/web),
  public Help page + in-app links, home-screen widgets for both apps, review
  moderation, mandatory business setup on retailer account creation,
  first-time loyalty-programme setup wizard — all from earlier sessions,
  still in place, see git log for exact commits if needed.
- **Android map pins fixed**, server-rendered PNG (see above).
- **Shopper settings** rebuilt as a bottom-sheet pop-up (gradient hero card,
  coloured icon-tile rows) after a full-screen version was tried and
  rejected as "boring" — the user's preference is now noted for future
  screens too.
- **Retailer settings restructured**: loyalty-programme section now shows
  real reward-catalogue tiers in the shop's actual unit (stamps/points/
  visits) instead of a single generic "target" number that didn't match
  what a Points or named-reward shop actually did; the sign-up reward field
  moved into the Rewards catalogue page, out of Settings.
- **Retailer camera-scan bug fixed**: the stamp/reward screen used to reopen
  the camera after *any* award or redeem, even when the customer had been
  found by typing a short code. It now tracks whether the customer was found
  by camera scan or by typed code, and only auto-reopens the camera after a
  scan.
- **Retailer home-screen widget redesigned**: brand-gradient card, shop
  logo/initial badge, live visit count, member count, white scan button.
  Android renders from JS and ships via OTA; the SwiftUI (iOS) version has
  the same design ready for whenever the first iOS build happens.
- **Announcement push notifications**: publishing a shop or team
  announcement now triggers a real push, not just an inbox row — see
  `HANDOFF-DEV-NOTES.md` for the mechanism. Shopper app has a per-shop
  "News & offers" opt-out switch.
- **Discover tab hidden** in the shopper app behind `SHOW_DISCOVER_TAB =
  false` in `apps/shopper/App.tsx` — a deliberate, temporary, one-flag hide
  at the user's request. Flip it back to `true` (and re-add it to the
  filtered `TABS` list) to restore it; nothing was deleted.
- Tooltips added across the web app's shopper-facing and owner pages (now
  shadcn's Tooltip, see above).
- Security review + one fix (see above).
- shadcn/ui adoption on the web app (see above).

All JS-only changes have already been pushed via `eas update` to the
`production` channel for both native apps (see `HANDOFF-DEV-NOTES.md` for
exactly how — there's a tool gotcha: use PowerShell, not Bash).

## Immediate next steps (roughly in priority order)
1. Get the user to run the one interactive `eas build`/`eas submit` step for
   the retailer app's first iOS build (needs their Apple ID + 2FA).
2. Once the user finishes screenshots + review contact info + DSA trader
   info for the shopper app, submit it for review.
3. Push the retailer app's App Store metadata once its ASC app exists
   (`store.config.json` is ready).
4. Nothing else is currently blocking — Android is live in production for
   both apps and receiving OTA updates normally.
