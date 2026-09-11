# Handoff: current state (as of 2026-09-11)

Read this first if you're a new Claude session picking up this project. Two
other handoff docs sit alongside this one:
- `HANDOFF-CREDENTIALS-AND-MAINTENANCE.md` — expiry dates, secrets, recurring
  Apple maintenance tasks. Check this every session — some of these are
  silent-failure time bombs.
- `HANDOFF-DEV-NOTES.md` — tooling gotchas (EAS/PowerShell, CSP, widget
  deployment targets, RLS patterns) that will save you re-discovering the
  same bugs.

**Heads up:** another AI agent ("Codex") has been working concurrently on
this same repo in past sessions (home-screen widgets were its work). Check
`git log` and `git status` before assuming you know the full state.

## Apps in this repo
- `apps/shopper` — customer-facing app, "The Loyalty Loop". iOS bundle
  `com.theloyaltyloop.shopper`, ASC App ID `6809930346`. EAS project
  `localoop-rewards`.
- `apps/retailer` — business owner app, "The Loyalty Loop for Business". iOS
  bundle `com.theloyaltyloop.retailer`. EAS project `localoop-business`. **No
  App Store Connect app record exists yet for this one.**
- `apps/web` — the marketing site + shopper/owner/admin web portal, deployed
  to Vercel at `the-loyalty-loop.com`.
- `apps/admin` — scaffold, not a focus area recently.

## Shopper app — App Store submission state
- iOS build **5** (`4aef8238-...`) is the current build — uploaded to App
  Store Connect successfully (confirmed by Apple's own delivery email, even
  though `eas submit` itself reported a false "something went wrong" — that
  error string is not reliable, always verify in TestFlight/ASC directly).
- **Known issue in build 5**: `ITMS-90683` warning — missing
  `NSLocationWhenInUseUsageDescription` in Info.plist. Caused by
  `react-native-maps` linking Apple's location framework even though the
  shopper app's actual map is a WebView (Google Maps JS), never a native
  map, and never requests location. It's a warning, not a rejection — build 5
  is usable for review — but worth fixing before the *next* build: add
  `ios.infoPlist.NSLocationWhenInUseUsageDescription` to
  `apps/shopper/app.config.js`.
- **App Privacy questionnaire**: published. Declared: Name, Email Address,
  User ID, Product Interaction — all "App Functionality"/"Analytics", all
  linked to identity, none used for tracking. Email is also declared
  "Developer's Advertising or Marketing" because `send-winback-emails` sends
  promotional win-back emails to shoppers.
- **Age Rating questionnaire**: published → **4+**. User-Generated Content =
  Yes (shop reviews), everything else No.
- **Review moderation** (report a review / block a user) shipped so the
  User-Generated-Content=Yes answer is actually backed by Apple's required
  Guideline 1.2 features (report, block, moderation queue). See
  `supabase/migrations/20260910120000_review_moderation.sql` and the
  `reportReview`/`blockAuthor` functions in `apps/shopper/App.tsx`.
- **Still blocking submission** (needs a human with Apple login — Claude
  cannot do these, no password/2FA entry):
  1. Screenshots — App Store needs *exactly* 1290×2796 or 1320×2868 (or the
     landscape equivalents). Any Play-Store-style 1080×1920 image will be
     rejected by the uploader.
  2. App Review demo account (email + password) in App Review Information →
     Sign-In Information — the app requires login so Apple will reject
     without one.
  3. Digital Services Act trader info (App Information page) — required for
     EU sale, not for review itself.
  4. Select build 5 on the "Prepare for Submission" version page, then
     actually hit Submit for Review.

## Retailer app — needs its App Store Connect record created
No ASC app exists for `com.theloyaltyloop.retailer` yet. Two ways to fix,
both need a human:
- Manually: App Store Connect → **+ App** → iOS → name "The Loyalty Loop for
  Business" → bundle `com.theloyaltyloop.retailer` → pick a SKU.
- Or: `cd apps/retailer && npx eas-cli build --platform ios --profile
  production` (interactive — first-time credential setup, same dance as the
  shopper app needed) then `npx eas-cli submit --platform ios` (first submit
  auto-creates the ASC record).

Once the record exists: `apps/retailer/eas.json` already has an iOS submit
profile, and `apps/retailer/store.config.json` is written and
`eas metadata:lint`-clean — ready for `eas metadata:push`.

## Google Maps
- **Web owner portal** (`apps/web`, `@react-google-maps/api`, used in Owner
  Settings/Onboarding "Pin location"): was broken because the site's CSP
  (`vercel.json`) blocked what Google Maps JS needs — `'unsafe-eval'` and a
  `blob:` web worker. Fixed in commit `ffce3ef`, confirmed deployed. The key
  itself (`VITE_GOOGLE_MAPS_API_KEY`, baked into the Vercel build) was never
  the problem — verified directly against Google's Geocoding API.
- **Native retailer app** (Android/iOS): has **no map at all** — no
  `react-native-maps`, no WebView, no Maps API key anywhere in
  `apps/retailer/`. This was never built, not a regression. If the business
  owner expects a map inside the native app (not just the web portal), that's
  new work: either (a) route the location step to the now-fixed web page via
  `Linking`, or (b) add `react-native-maps` + a **separate Google Maps
  Android/iOS SDK key** (different product from the JS API key) and a fresh
  native build. Ask the user which before building — it's a real scope
  decision.
- The **shopper app**'s map (the "Map" tab + the shop page "Find your way
  there" embed) is a **native** `react-native-maps` Google map, not a
  WebView. Android build 116 already ships the native module, but was blank
  because the key in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (EAS env, all
  environments) is the *website's* key — HTTP-referrer restricted, so the
  Android Maps SDK rejects it. Fix = a separate key restricted to Android
  apps (package `com.theloyaltyloop.shopper`, upload-cert SHA-1
  `47:A4:36:09:CA:6C:83:11:5E:F1:C8:BB:83:73:01:29:DD:22:D3:09` **plus** the
  Play App Signing SHA-1 from Play Console) with "Maps SDK for Android"
  enabled, set in EAS env, then a fresh Android build — the key lives in
  AndroidManifest, OTA can't change it.

## Recently shipped (this session), all committed + pushed to `main`
- Apple Wallet passes for iOS shopper app (signed `.pkpass` via a new
  `create-apple-wallet-pass` edge function).
- Sign in with Apple across iOS (native), Android (web-OAuth), and the
  website.
- Public `/help` page on the website + in-app "Help & FAQ" links in both
  mobile apps.
- Home-screen widgets (iOS WidgetKit + Android) for both apps.
- Review moderation (report/block) in the shopper app + an admin "Reported
  reviews" tab in the Access Panel (`apps/web/src/pages/AccessPanel.tsx`).
- First-time loyalty-programme setup wizard in the retailer app — shown once
  per shop when its owner has no `reward_catalog` row yet; walks through
  Stamps/Points/Visits, the threshold, and the reward.
- CSP fix for Google Maps on the web (see above).

All of the above JS-only changes have already been pushed via `eas update`
to the `production` channel for both apps (see
`HANDOFF-DEV-NOTES.md` for exactly how — there's a tool gotcha).

## Immediate next steps (roughly in priority order)
1. Decide the native-map question above and act on it.
2. Get the user to run the one interactive `eas build`/`eas submit` step for
   the retailer app so its ASC record exists.
3. Add `NSLocationWhenInUseUsageDescription` before the next shopper build.
4. Once the user has uploaded screenshots + demo account + DSA info, submit
   the shopper app for review.
5. Push the retailer app's App Store/Play Store metadata once its ASC app
   exists (`store.config.json` is ready).
