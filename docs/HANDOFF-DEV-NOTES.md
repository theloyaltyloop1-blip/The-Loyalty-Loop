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

## Retailer camera reopening after a typed short code (fixed 2026-09-12)

- Symptom: awarding a stamp or redeeming a reward after finding the customer by typing their short code reopened the camera, even though the customer had not been scanned.
- Root cause: the stamp screen unconditionally reopened the camera after every award/redeem and whenever the matched customer cleared — it had no idea whether the customer was found by scan or by typed code.
- Fix: a `lookupVia` ref (`"camera" | "code" | null`) is set in `parse()` (camera) and `lookup()` (typed code) in `StampsScreen` (`apps/retailer/App.tsx`). The auto-reopen effect and the post-award/post-redeem reset both check it — only a camera-sourced match returns to the camera afterward. Copy this pattern for any other flow that behaves differently depending on how a record was found.

## Native widget redesigns: keep both platforms in sync by hand

Both apps' home-screen widgets are two independent implementations of the same design, not one shared component:
- **Android** renders from JS (`react-native-android-widget`) — `apps/*/src/widgets/android.tsx` — and ships instantly via `eas update`, no native build needed.
- **iOS** is real SwiftUI (`apps/*/targets/*Widget/*.swift`) and only takes effect the next time that app gets a new native build submitted and approved.

The retailer widget redesign (2026-09-15/16 — brand-gradient card, logo/initial badge, live visit count, member count, white scan circle) was made in both files at once even though the iOS one could not be tested live (no iOS build exists for the retailer app yet). If you redesign a widget, always edit both `android.tsx` and the matching `.swift` file together, or the two platforms will visibly diverge the next time either one ships.

## Creating a demo account directly in Postgres (for App Review, etc.)

Supabase's client-side `signUp()` needs a real SMTP round-trip for email confirmation, which is awkward for a throwaway demo/review account. Faster, verified-working path: insert directly into `auth.users` + `auth.identities` via SQL (the Supabase MCP `execute_sql` tool has enough privilege), matching exactly what a real signup produces, then let the existing `handle_new_user()` trigger create the `profiles`/`user_settings`/`user_roles` rows automatically.

Two things that are easy to get wrong and will produce an account that looks created but cannot log in:
- **`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`** must be empty strings (`''`), not `NULL`. A real signup always sets them to `''`; leaving them `NULL` makes GoTrue's password grant fail with a generic `"Database error querying schema"` (a Go `sql.Scan` failure converting `NULL` into a non-nullable string field, not a permissions or password problem — do not waste time re-checking the password hash if you see this error).
- **`auth.identities.email` is a generated column** — do not include it in the INSERT list at all (it derives from `identity_data->>'email'`). `identity_data` itself needs `sub` (the user's own id, as text), `email`, `email_verified: true`, and matching `first_name`/`last_name`/`intent` to what you put in `raw_user_meta_data`. `provider_id` on the identities row equals the user id (as text) for the `email` provider.
- `confirmed_at` on `auth.users` **is** a generated column (`LEAST(email_confirmed_at, phone_confirmed_at)`) — just set `email_confirmed_at = now()` and leave `confirmed_at` out; it computes itself correctly since Postgres's `LEAST`/`GREATEST` ignore `NULL` arguments rather than propagating them.
- Always verify the account actually works before handing it off: a `POST .../auth/v1/token?grant_type=password` with the anon apikey and the email/password should return a real `access_token`, not just a 200 from the INSERT.

The App Review demo account (`applereview@the-loyalty-loop.com`) was made this way, then given a real membership row at "Loyalty Loop Demo Café" (`27bb17e7-da1e-4a33-9df9-e715599c8511`) with `stamp_count = 6` so the reviewer sees a partially-filled loyalty card immediately.

## Postgres gotcha found during the security review: PUBLIC grants

Revoking `EXECUTE` from `anon`/`authenticated` on a function is **not enough** if the function is still reachable — Postgres grants `EXECUTE` to the `PUBLIC` pseudo-role by default when a function is created, and every real role (including `anon` and `authenticated`) inherits from `PUBLIC` unless it is revoked separately. Revoking only the named roles leaves the function fully callable via the `PUBLIC` grant underneath. Always check `information_schema.role_routine_grants` after a revoke — if `PUBLIC` still shows up, revoke that too, e.g. `revoke execute on function public.some_function(uuid) from public;` in addition to the per-role revokes. This is exactly what happened with `request_announcement_push()` — see `supabase/migrations/20260915180000_revoke_public_request_announcement_push.sql`. Verify with a real anonymous REST call afterward (`.../rest/v1/rpc/<fn>` with just the anon apikey) expecting `42501 permission denied`, not just the grants table.

## shadcn/ui on this project (adopted 2026-09-16, apps/web only)

`apps/web` runs Vite + Tailwind v4 (CSS-first config, no `tailwind.config.js`) with React 19. shadcn's CLI (`npx shadcn@latest`) works with this setup, but two things went wrong during setup that will bite again if shadcn is ever re-initialised or a new component added carelessly:

1. **The CLI's file writer takes the `@` in the `@/components/ui` alias literally.** `npx shadcn@latest add <component>` reported "Created N files" at paths like `@\components\ui\button.tsx`, but the files actually landed in a real, new `apps/web/@/components/ui/` directory instead of being resolved to `src/` via the tsconfig path alias — even though `vite.config.ts`'s `resolve.alias['@']` and `tsconfig.app.json`'s `paths` are both configured correctly. This happened on every `add` invocation this session, not just the first. After running any `shadcn add`, check for stray files under `apps/web/@/` and move them into the matching path under `apps/web/src/` by hand, then delete the `@` directory. Do this before editing anything, since a missing component you expect to exist will otherwise silently keep using old or absent files.
2. **`shadcn init`'s generated `index.css` will silently override the brand palette if merged carelessly.** It appends a second `@theme inline` block plus fresh `:root`/`.dark` blocks defining `--background`, `--foreground`, `--primary`, etc. in generic grayscale `oklch()`, then maps `--color-background: var(--background)` and so on. Since Tailwind v4 generates the `bg-background`/`text-foreground`/`bg-primary` utility classes from whichever `--color-*` declaration comes last in the compiled CSS, and the appended block comes after the app's own `--color-background: #F7ECDC` etc., the generic tokens would have won — the whole site would have silently switched from the brand's cream/orange palette to black-and-white. Fixed by keeping one `@theme` block: the app's own colors stay authoritative, and the new tokens shadcn's components actually need (`--color-muted`, `--color-popover`, `--color-ring`, `--color-input`, the `--color-*-foreground` variants, the `--radius-*` scale) are mapped onto that same palette instead of shadcn's defaults, in both the light block and the existing `html.dark` override. If you add more shadcn components later and `apps/web/src/index.css` does not already define a token they need (check the component's own `.tsx` for `bg-*`/`text-*`/`ring-*` class names referencing something unfamiliar), add it to the existing single `@theme` block the same way — never let `shadcn add`/`init` append a second color block.
3. **`sonner.tsx` (the Toaster) is generated wired to `next-themes` by default.** This app already has its own theme system (`apps/web/src/components/theme-toggle.tsx` — localStorage plus toggling the `.dark` class), so `next-themes` would have been a second, unsynced source of truth for light/dark. Fixed by exporting a `useTheme()` hook from `theme-toggle.tsx` and pointing `sonner.tsx` at that instead; `next-themes` and the unused `@fontsource-variable/geist` import (the button/sonner templates' default font — this app uses DM Sans/Libre Baskerville) were uninstalled.
4. The generated `Button` component's variant names do not match this app's old ones (`primary`/`accent` versus `default` with no equivalent). Rather than rewrite every call site, `accent` was re-added as an extra variant in `components/ui/button.tsx`'s `cva` config (`default`'s style is functionally identical to the old `primary`, so no call site needed to change for that one). If a future shadcn component references a variant name this app used to have, prefer extending the generated component's variants over mass-editing call sites.

Installed so far: `tooltip`, `dialog`, `alert-dialog`, `dropdown-menu`, `tabs`, `badge`, `switch`, `select`, `textarea`, `sonner`, on top of the pre-existing `button`/`card`/`input` (now the real shadcn versions). `TooltipProvider` and `<Toaster />` are mounted once in `App.tsx`, inside `ThemeProvider` (Toaster needs the theme) and outside `BrowserRouter`.
