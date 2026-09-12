# Handoff: tooling gotchas and patterns worth reusing

Things that cost real time to figure out. Read before touching EAS
build/update, native config, or the review/reward data model.

## EAS Update (OTA) — use PowerShell, not Bash, on this machine

`npx eas-cli update ...` reliably fails under this environment's **Bash**
tool with `'C:\Program' is not recognized as an internal or external
command` (a child-process spawn issue with the space-containing Windows
path). It works fine from the **PowerShell** tool. Always run `eas update`
via PowerShell:

```powershell
Set-Location "C:\Users\zahih\Downloads\The Loyalty Loop - for Claude\apps\shopper"
npx eas-cli update --branch production --platform ios --message "..." --non-interactive
```

`eas build` and `eas submit` work fine from either Bash or PowerShell — it's
specifically `update` that trips over the bundler subprocess.

Other `eas update` notes:
- `--platform` takes a single value (`ios` or `android`), never `all` for
  update — `all` implicitly includes `web`, and bundling for web fails on
  `react-native-maps` importing native-only RN internals. Run iOS and
  Android as two separate calls.
- Delivery model: on launch, the installed app checks the channel
  (`production`) + runtime version (`1.0.0`, policy `appVersion`) for a
  newer update, downloads it in the background if found, and applies it on
  the *next* cold start. So: open the app → wait ~20s → fully close it
  (swipe away, not just background) → reopen. Two-launch model.
- A build only receives OTA updates if it was built *after* `expo-updates`
  was configured (`updates.url` + `runtimeVersion` in app.config.js/app.json)
  and shares the same channel + runtime version. For this repo: shopper
  Android builds ≥114 and retailer Android builds ≥114 have it; earlier
  builds never will, no matter how many updates you push — they need a fresh
  build.
- `eas submit`'s "Something went wrong when submitting to App Store Connect"
  is **not reliable** — it fired repeatedly for a build that had, per
  Apple's own delivery confirmation email, uploaded successfully. Always
  verify the real state in TestFlight/App Store Connect (or wait for Apple's
  email) rather than trusting the CLI's error text.

## EAS Build — credentialsSource scoping

Once an app has a widget/extension target (`@bacons/apple-targets`), do
**not** set `credentialsSource: "local"` at the top level of a build profile
in `eas.json` — it forces *every* platform to look for local credentials,
and a `credentials.json` that only has an `android` section will break iOS
builds ("iOS credentials are missing in credentials.json"). Scope it:

```json
"production": {
  "autoIncrement": true,
  "channel": "production",
  "android": { "credentialsSource": "local" }
}
```

This lets iOS keep using EAS-managed remote credentials while Android still
uses the project's own upload keystore. Already fixed this way in both
`apps/shopper/eas.json` and `apps/retailer/eas.json`.

## Widget extension deployment target

Both widgets (`apps/shopper/targets/ShopperLoyaltyWidget`,
`apps/retailer/targets/RetailerScanWidget`) use SwiftUI's
`.containerBackground(for: .widget)` — an **iOS 17+ only** API. Their
`expo-target.config.js` must set `deploymentTarget: '17.0'`, not the app's
own lower target (15.1) — otherwise the Xcode build fails with
`'containerBackground(for:alignment:content:)' is only available in iOS
17.0 or newer`. The host apps themselves stay at 15.1; only the widget is
iOS-17-only, meaning the widget simply isn't offered on older devices.

## First-time interactive credential setup (unavoidable, needs a human)

The very first `eas build` for a given app/target combination that uses
EAS-managed iOS credentials needs one interactive confirmation (Apple ID
login + accept/generate distribution cert + provisioning profile). This
cannot be done from Claude's sandboxed shell (no real TTY). Already done for
the shopper app (both its main target and its widget target). **Not yet
done for the retailer app** — its first iOS build will need the user to run
`eas build --platform ios --profile production` themselves, interactively,
once. After that, all future builds for that app can run non-interactively
from Claude.

## Google Maps + CSP (web app)

`apps/web` uses `@react-google-maps/api`. The site's CSP is defined in
`vercel.json` (`headers` → `Content-Security-Policy`), not in any app code.
Google Maps JS needs, at minimum:
- `script-src`: `'unsafe-eval'` and `blob:` (its legacy module loader and
  WebGL-renderer worker)
- `worker-src 'self' blob:`
- `connect-src`: `https://*.googleapis.com` (not just
  `maps.googleapis.com` — tile requests go to `khms0-3.googleapis.com`), plus
  `blob:` and `data:`

If a map silently shows "Could not load the map" or a blank grey box,
check the CSP before the API key — the key baking correctly into the Vercel
build can be confirmed by fetching the deployed JS chunk (Vite/Rollup hashes
chunk filenames by content, so a stable-hash chunk you've already checked is
still valid) and grepping for the `AIzaSy...` string, or by testing the key
directly against `https://maps.googleapis.com/maps/api/geocode/json?address=...&key=...`
(returns `{"status": "OK"}` for a working key).

## Review moderation / "reward set up yet?" pattern

Two schema/RLS patterns worth copying if extending this further:

1. **Hiding rows by relationship, not by app-level filtering.** Blocking a
   user (`apps/shopper` → `user_blocks` table) is enforced by rewriting the
   `reviews` table's SELECT policy to exclude rows authored by anyone the
   current user has blocked (`reviews_select_visible` in
   `supabase/migrations/20260910120000_review_moderation.sql`). This means
   blocked content disappears everywhere a review is queried, automatically,
   with no per-screen filtering code needed.
2. **"Has this business finished setup?" without a dedicated flag column.**
   The retailer app's first-run loyalty-setup wizard
   (`LoyaltyProgramSetup` in `apps/retailer/App.tsx`) is gated on whether
   `reward_catalog` has any row for that business — not a new boolean
   column. This mirrors an existing check (`StampsScreen` already used the
   same "does `reward_catalog` have rows?" query to decide whether staff
   could scan stamps at all). Reuse existing signals like this before adding
   new schema.

## Testing against the live DB without touching real users

The pattern used repeatedly this session for empirical verification (Apple
Wallet passes, review moderation RLS, loyalty setup writes): create a
throwaway user via the Supabase Admin API
(`POST {SUPABASE_URL}/auth/v1/admin/users` with the service-role key), do
the real signed-in requests with its access token (`POST
.../auth/v1/token?grant_type=password`), then delete everything (child rows
first, respecting FKs — `memberships.user_id` has **no** `ON DELETE
CASCADE`, so it must be deleted explicitly before the user, or
`auth.users` deletion fails with a 500/FK violation) plus
`DELETE /auth/v1/admin/users/{id}`. Always clean up before ending the
session — don't leave test accounts/businesses in production data.

## Google Play uploads via EAS Submit (set up 2026-09-12)

Claude can push Android builds to Google Play without the Play Console UI:

- Service account `eas-submit@the-loyalty-loop.iam.gserviceaccount.com`
  (GCP project `the-loyalty-loop`, key id `837af0567d3f`). It is an Active
  user in Play Console with, for all three Play apps
  (`com.theloyaltyloop.shopper`, `com.theloyaltyloop.retailer`,
  `com.theloyaltyloop.business`): View app information, Release to
  production, Release apps to testing tracks (+ the auto-added Manage policy
  declarations / Manage deep links). The Google Play Android Developer API
  is enabled on the project (required by EAS Submit).
- The JSON key lives **outside the repo** at
  `C:\Users\zahih\keys\play-eas-submit.json` (never commit it). Both apps'
  `eas.json` `submit.production.android` point at it with
  `track: "production"`, `releaseStatus: "completed"`,
  `changesNotSentForReview: false` — the user's instruction (2026-09-12) is
  that every Android build goes **straight to production** and into Google's
  review immediately. Say so before running it; it reaches every user.
- Usage, from the app folder: `npx eas-cli submit --platform android --latest
  --profile production --non-interactive` (or `--id <buildId>`). Add
  `--track internal` only if the user explicitly wants a test-only upload.
  OTA is the default for JS-only changes; only submit when there is a
  native build.
- Play apps: `com.theloyaltyloop.retailer` is listed in Play as "The Loyalty
  Loop - Retailer"; an older "The Loyalty Loop for Business" app with package
  `com.theloyaltyloop.business` also exists — the user says it is **old and
  unused**; ignore it. The retailer app is the real one.
- Brave gotcha: Google Cloud's "Create private key" download sat as a
  `<guid>.tmp` (2.3 KB) in Downloads waiting on a Brave download bubble; that
  `.tmp` is the complete JSON key.

## Map pins on Android (fixed 2026-09-12)

- Symptom: custom `<Marker>` children rendered as the top-left corner only (about a third of the pin) on Android. iOS was fine.
- Root cause: react-native-maps 1.20 sizes custom marker views through `SizeReportingShadowNode.onCollectExtraUpdates` -> `MapMarker.update(width, height)`. That hook only exists on the old (Paper) architecture. Expo SDK 54 runs the New Architecture, so width/height stay 0 and `createDrawable()` falls back to a 100x100 px bitmap.
- Fix: on Android the shopper app no longer renders a view inside the Marker. `ShopMarker` passes `image={{ uri }}` pointing at the Supabase Edge Function `map-pin` (`supabase/functions/map-pin/index.ts`), which rasterises the same pin design (halo, ring, logo or initials, tail, shadow) to a PNG with resvg-wasm at the device pixel ratio. iOS keeps the native view pin.
- `map-pin` is public (`verify_jwt: false`) because the Android image loader cannot send headers. It fetches the logo server-side, falls back to initials, and sets `Cache-Control: max-age=86400`. Cold start about 1 s, warm about 0.4 s. Redeploy with the Supabase MCP `deploy_edge_function` (or `supabase functions deploy map-pin --no-verify-jwt`).
- If react-native-maps ever fixes marker sizing under Fabric, delete the Android branch in `ShopMarker` and the function.

## Announcement push notifications (added 2026-09-12)

- Publishing a shop announcement (`announcements` insert with `is_active`, from the retailer app or the web owner dashboard) fires `deliver_shop_announcement()`: one `notifications` row (kind `promo`) per member of that shop whose `memberships.promos_opted_out` is false, then `request_announcement_push(id)` queues a pg_net POST to the `send-announcement-push` edge function.
- Team announcements (`platform_announcements`, Access Panel) go through `deliver_platform_announcement()` the same way: inbox rows (kind `system`) for every profile, then the push request. Nobody can opt out of team announcements inside the app; only the phone's notification settings.
- `send-announcement-push` (public, no JWT) claims every unsent row for that `announcement_id` atomically, skips users with `user_settings.notify_offers = false` (shop announcements only), sends via Expo in batches of 100, deletes tokens Expo reports as DeviceNotRegistered, and writes `push_error` per row. Safe to re-run by POSTing `{"announcement_id": "<uuid>"}`; a second run finds nothing pending.
- Shopper app: each shop page has a "News & offers from <shop>" switch bound to `promos_opted_out`. Tapping an announcement push opens that shop (or the News tab for team announcements).
- Retailer app tokens live in the same `push_tokens` table, so an owner who is also a member gets shop/team pushes in both apps.
- Migration: `supabase/migrations/20260912150000_announcement_push.sql`. Check delivery with `select status_code, content from net._http_response order by created desc` and `select push_error, count(*) from notifications where announcement_id = '<uuid>' group by 1`.

## Staff accounts silently failing to save shop settings (fixed 2026-09-12)

- Symptom: editing a shop's address (or name/category/description/postcode/phone/loyalty type) in the retailer app's Settings tab appeared to save ("Settings saved" alert) but reverted on the next load.
- Root cause: `businesses` RLS only allows `UPDATE` when `owner_id = auth.uid()` (or admin) — see `businesses_update_owner_or_admin`. Same pattern on `reward_catalog`, `staff_members`, `business_photos`. A staff account (someone added via "Staff & permissions", not the owner) could still open Settings, edit a field and tap Save; the write matched zero rows under RLS, and because the query chained no `.select()`, Supabase returned `{ data: null, error: null }` — indistinguishable from success. The app showed "Settings saved" and the field silently reverted on the next reload.
- Fix: `BusinessSettings` now takes an `isOwner` prop (`ownedIds.has(selected.id)` from the Dashboard's own owner/staff split). Staff see the shop profile and loyalty settings as **read-only** with a one-line explanation, and the owner-only tools (Logo & cover images, Rewards catalogue editing, Staff & permissions, Deactivate/Reactivate shop) are hidden rather than opening a page whose actions would fail the same way. `save()` also now chains `.select("id")` and throws a real error if nothing came back, so this class of bug fails loudly instead of lying about success — worth copying into any other `.update()` call on an owner-gated table.
