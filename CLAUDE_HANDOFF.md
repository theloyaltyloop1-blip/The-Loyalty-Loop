# CLAUDE_HANDOFF.md: where The Loyalty Loop stands

Read this whole file before any work. Rules are in `CLAUDE.md`.

- Sections 1 to 7 are the standing picture. Correct them when a fact changes.
- Section 8 is the log. Add each new entry at the top of it.
- When this file passes 300 lines, archive it and start a new one. The steps are in `CLAUDE.md` under "When the handoff gets too big".
- The full history up to 15 November 2026 is in `docs/handoff-archive/` (see section 9). Search it before redoing something that may have been tried.

## 1. Current state (update on every release)

- Live code: `origin/main`. Vercel deploys the website on every push to `main`.
- Supabase project ref: `tgukdabfvvoywawmzbdo`.
- Shopper versions on phones: 1.0.1 and 1.0.2. In review at Apple and Google since 2026-11-15: 1.0.3 (iOS build 17, Android versionCode 135).
- Business versions on phones: 1.0.1. In review at Apple and Google since 2026-11-15: 1.0.2 (iOS build 15, Android versionCode 134).
- Publish every OTA for shopper 1.0.1, 1.0.2 and 1.0.3, and Business 1.0.1 and 1.0.2 (the review versions get OTAs too, so they are current when approved). Latest OTAs (2026-11-21): shopper 1.0.1 and 1.0.2 serve the card-to-page groups (1.0.2 `46ac33ab` / `49909009`, 1.0.1 `4aa248ef` / `3d9ca859`, android / ios), which already include the email codes; shopper 1.0.3 and Business 1.0.1 and 1.0.2 serve the email-codes groups from 54167be.
- Waiting for the next native build: predictive back and blurry image placeholders (2026-11-07 polish entry). Icons, splash, dark-mode native half and walk-past are already in the builds in review.
- Shops use stamps by default. Programme types live: `stamp_legacy`, `spend_threshold`, `tiers`, `points`, `custom` (AI-designed).
- Parked: Fidel card linking (hidden in the shopper app; spec in `ARCH_PLAN.md`), SumUp till link (live, only Test Shop connected), WhatsApp.
- Real usage on 2026-11-15: 7 approved shops including test shops, 6 memberships.

## 2. What is live

**Website** (`apps/web`): shopper pages, owner dashboard, admin at `/access` (rebuilt 2026-11-15), AI programme builder, "Try it" demo on the home page, dark mode, outage message (`apps/web/public/status.json`), phone visitors sent to the apps (`src/components/mobile-app-gate.tsx`; phone-only web pages go in `WEB_ONLY_PATHS`), release-email admin tab (`/access?view=release-emails`).

**Email codes (2026-11-21):** sign-up and password reset use a 6-digit code typed in the app or website, not a link, everywhere. Supabase templates show the code and keep the link as a fallback (source in `supabase/templates/`). Email OTP length 6, expiry 3600 s.

**Both apps, by OTA:** design-audit fixes of 2026-11-17 (released 2026-11-21), dark mode, Whirl mascot and Ask Whirl assistant, stronger haptics, typo-tolerant search, outage banner with saved home screen, keyboard-aware text boxes, branded pop-ups (`showAlert`), AI programme builder.

**Shopper app:** whole-page map tab, quick cards and live balances on home, custom card designs, win-back coupons.

**Business app:** app-first onboarding, map pin picker (OpenStreetMap tiles, no native map), QR poster, Help and FAQ, delete or hand over shop, business verification screens (shadow mode).

**Supabase:** edge functions `design-programme`, `ask-whirl`, `business-coach-chat`, `map-pin`, `verify-business` (shadow mode), wallet pass functions, four SumUp functions, `send-release-announcement`, `product-updates-unsubscribe`, `send-winback-emails`. Migration `walk_past_alerts` is applied.

## 3. Open items

**Owner**
- Store review: watch Apple and Google for 1.0.3 and 1.0.2. Google's background-location review can ask for changes.
- Store listings: upload new store icons and screenshots; check the Play listing text for old place names; re-check App Store privacy answers for background location; publish the updated privacy notice.
- Ask Whirl: sign Groq's data agreement and confirm the UK transfer wording, set a monthly Groq spend limit, read `whirl-faq.ts`.
- Business verification: mode is `shadow` (checks recorded, nothing applied). The owner paused going live on 2026-11-10. Do not switch it on without asking again.
- Release emails: send the "TEST ONLY" draft to yourself from `/access?view=release-emails`, then discard it. Confirm the sign-up wording covers product news to shoppers.
- Logo: three vector concepts in `artifacts/logo-svg-exploration/` (main folder only) await a choice.
- Decide which unmerged branches and worktrees are finished (section 5).
- Change the GitHub default branch from `apps/web` to `main`.
- Owner voice line: Twilio number and secrets still to set up (2026-10-18 entry in the archive).

**Claude, each on the owner's yes**
- Web CI lint fails on three un-awaited promises: `whirl-kit/whirl.tsx:68`, `owner-command-palette.tsx:45`, `owner-walkthrough.tsx:52`. A clean-up session started on 2026-11-15; its result is not recorded here.
- Apply migration `20261115120000_typo_tolerant_admin_search.sql` (in the repo, not applied).
- Deploy the sender fix for `send-visit-thank-you`, `send-owner-legal-documents` and `shop-request-notify` (committed, not deployed, as of 2026-11-14).
- Redeploy the wallet pass functions (custom-programme lines and the new logo).
- The shopper app has no "Forgot password?" on its sign-in screen (website and Business app do).
- Once every app version on phones has the code screens, drop the fallback link from both Supabase email templates.
- Website staff Redeem panel does not show pounds or percent off for custom programmes.
- No admin page for `programme_requests`.
- Milestone rewards are not clawed back on a refund.
- SumUp tokens are not Vault-encrypted.
- Simplification: identical files copied across shopper, retailer and web; CORS headers hand-copied into about 27 edge functions; `apps/api/src` prototype and `apps/admin` stub unused; stale `test` profile in `apps/retailer/eas.json`.
- `ARCH_PLAN.md` and `IMPLEMENTATION_TIMELINE.md` still describe the Codex era. `.agents/skills/` is a stale Codex copy of `.claude/skills/`.

## 4. Never checked on a phone

Almost every release since 2026-11-07 was type-checked and bundled but not seen on a device. The owner should open each app twice (an update applies on the second launch) and look at:

- email code screens: shopper sign-up, Business shop sign-up, Business "Forgot password", signing in before confirming
- design-audit fixes released 2026-11-21 (shopper home, shop page, QR, Android back; Business scan, customers, Android back)
- dark mode on home, a shop, scan and Settings
- Whirl placements and the Ask Whirl sheet
- sign-in, sign-out, offline launch and switching accounts
- shopper Home layout, map tab, quick cards, live balances
- Business map pin picker, QR poster PDF, delete and hand-over screens, verification photo upload
- iOS rounded-corner patch (`src/smooth-corners.ts`); if corners look wrong, remove its import in `index.ts` and publish an OTA
- keyboard behaviour on Android in review replies and the AI chat
- the website on a real iPhone and Android phone (should land in the store)

Also never run for real: a signed-in Ask Whirl question, a win-back send, a release email, the admin panel with a real admin login.

## 5. Work that is not on main

- **Main folder** (`C:\Users\zahih\Downloads\The Loyalty Loop - for Claude`): moved to `main` on 2026-11-15. Its earlier state (21 edited files, 348 files in all) is saved in local branch `backup/main-folder-full-2026-11-15` (`a73869a`), not pushed because it holds lead contact details. Work that exists only in that snapshot: local trades directory mode (edits to `AccessPanel.tsx` and the shopper app) and the retailer country picker. Still loose in the folder, not in git: `plan.md` (90-day plan), `handoff.md`, `marketing/outreach-bot/`, `marketing/london-leads/`, `artifacts/`, three logo tool folders, the `watch` and `video-edit` skills, two orphan `Directory.tsx` files and migration `20261031120000`. The 5 old commits from local `main` are in `backup/local-main-2026-11-15`.
- **Branches with work whose status the owner has not confirmed:** `claude/reel-preview`, `claude/integration-review`, `claude/whirl-audit`, `business-verification`, `claude/reel-pitch-80b83f` (owner-pitch landing copy and pitch scripts, uncommitted, conflicts with the live landing page).
- About 50 worktrees exist under `.claude/worktrees/`; around 14 had uncommitted files on 2026-11-15.
- Cold outreach bot (`marketing/outreach-bot/`): built, 63 shops emailed in earlier batches, nothing sent by the bot. Online version on branch `claude/outreach-online` (2026-11-18 entry), not shipped. Two outreach designs disagree; `plan.md` task T8 is a stop gate for all outreach.

## 6. Lessons already paid for

| What was tried | Result |
|---|---|
| View-based map markers on Android | Clipped to a corner under the New Architecture. Android pins are PNGs from the `map-pin` function; iOS keeps the view pin. Change pin design in both. |
| `try/catch` around `require()` of a missing native module | Android crash loop (7 Oct). Check `requireOptionalNativeModule('Name')` first. Test: `apps/shopper/location-guard.test.mjs`. |
| `eas update` without `--environment production` | Every phone showed "App configuration needed" (19 to 20 Oct). |
| `eas update --platform all` | Fails on web bundling of react-native-maps. |
| OTA published for one app version only | Phones on the other version never got it. |
| Republishing a crashing OTA on production to capture a log | Crash was live for everyone for about 40 minutes. Use a preview build. |
| Judging features from the stale main folder | A duplicate points wallet was built and applied to production, then removed. |
| Grey map on the Play Store install | Maps key lacked the Play signing SHA-1. It needs three: upload, Play, EAS preview. |
| `eas metadata:push` while the App Store version is live | Fails. Set `apple.version` in `store.config.json` to the new version first. |
| "Add for Review" with an outdated Paid Apps Agreement | Blocked until the owner accepts the agreement. |
| Empty copyright field on App Store submission | Apple only says "Version is not ready". |
| Nominatim geocoding from the Business app | 403 without a custom User-Agent header. |
| Reel-lessons sessions built on a branch 102 commits behind | Most had to be redone. |
| Flattening owner dashboards to one card style | Owner called it boring. Colours restored. |
| A first admin redesign with colour blobs and gradient chips | Owner rejected it as "AI slop". |
| Business app on an emulator | Failed: Expo Go version mismatch, JDK too new. |
| App Store expedited review | Already tried. Do not suggest it. |
| AI-generated logo directions | All rejected by the owner. |

## 7. Key details

- **EAS:** not installed globally. Run `npx --yes eas-cli@24.11.0 ...` from the app folder, in PowerShell. Channel and branch are both `production`. Runtime version equals the app version.
- **Project IDs:** shopper `474f40e3-c739-4317-8a94-12a73795ef04`, Business `de0702d2-219a-435b-8577-81546c5a097f`. App Store IDs: shopper `6809930346`, Business `6813259329`.
- **What a phone is served:** GET `https://u.expo.dev/<project id>` with headers `expo-runtime-version`, `expo-channel-name: production`, `expo-platform`.
- **Rollback, one step:** republish the previous update group. Group IDs for every release are in the archive.
- **Rollback, all the way:** `npx eas-cli@24.11.0 update:roll-back-to-embedded --branch production --runtime-version <version> --platform <android|ios>`. This drops everything since the store build, including dark mode and Whirl.
- **Ask Whirl kill switch, no app update needed:** set secret `WHIRL_ENABLED=false`.
- **Outage message:** edit `apps/web/public/status.json` and push.
- **Programme rules:** `packages/loyalty/src/programme-rules.ts` is copied byte for byte to `supabase/functions/_shared/programme-rules.ts`; a test enforces it. Change the SQL validator with them.
- **Errors worth recognising:** `App configuration needed` (OTA without env vars), `invalid_programme_rules`, `programme_locked`, `Version is not ready`, `Authorization failure` in `adb logcat` (Maps key). Postgres `23505` on `transactions_client_ref_key` counts as success.
- **Crash on Android:** owner enables USB debugging, then `adb logcat`, reproduce, search for `FATAL EXCEPTION`.
- **Dates:** Apple Sign-In secret expires 2027-03-10 (regenerate by hand). Apple Wallet pass certificate expires 2027-10-08.

## 8. Log (newest first)

### 2026-11-21 - Business app: stamps work without signal (saved on the phone, sent later) - NOT shipped

- **Branch:** `claude/offline-stamping` (worktree `.claude/worktrees/zealous-ritchie-457764`, from origin/main e855eee). Committed aa58816 on the owner's yes (2026-11-21); not pushed, no OTA.
- **What:** when the phone has no signal (or a stamp gets no answer within 10 s), Award saves the stamp on the phone instead of failing. The button turns dark amber "Saved" with "Saved – will send when you're back online", then the screen resets for the next customer. An amber pill (2px dark border, like the other tiles) on Home and Scan shows "N stamps waiting to send"; tapping it sends now. Waiting stamps go oldest first when the app opens, comes back to the front, the outage check sees the connection return, after the next successful live stamp, and every 20 s with backoff (5 s doubling to 5 min). Refused or too-old stamps are reported in one `showAlert` with the customer's first name and reason. The customer's thank-you, push and wallet update only fire once the server accepts the stamp.
- **Server:** no change needed. Every stamp already carries a phone-made `client_ref`, and the live database has the unique index `transactions_client_ref_key` (checked on 2026-11-21 with a read-only query), so a resend gives one stamp; the duplicate answer counts as sent.
- **Limits chosen:** 200 waiting scans per account per phone; a stamp older than 48 hours is dropped and reported, not sent. The queue is per signed-in account, survives closing the app and signing out (sign-out pop-up says how many are waiting), and is stored in `expo-sqlite/kv-store` (already in the app, so JS only).
- **Not queued, on purpose:** reward redemptions (reward QR, reward code, hold-to-redeem) say "Using a reward only works online, so it can't be spent twice". Typed customer codes need a lookup, so offline they say to scan the QR instead. Spend shops (£ purchases, `record_manual_spend`) are not queued and keep their old "check the connection" message.
- **Also:** Scan no longer refuses to open offline ("Add a reward before scanning"): the reward list is kept on the phone (launch cache) and, if never saved, scanning goes ahead without it. Network failure is told apart from a refusal by supabase-js `status` (0, 401, 408, 429, 5xx = no answer).
- **Known gap:** offline, a linked-card customer is not asked how they paid; if the database then refuses it (`linked_customer_payment_method_required`), the owner sees it in the report. Card linking is parked, so this should not happen today.
- **Files:** `apps/retailer/src/offline-stamps-core.ts` (new, pure rules), `apps/retailer/src/offline-stamps.ts` (new, storage + Supabase), `apps/retailer/src/offline-stamps.test.mjs` (new, 26 tests), `apps/retailer/App.tsx`, `apps/retailer/src/shop-pages.tsx`. No change to `package.json`, `app.json` or the lockfile.
- **Checks run:** `npx tsc --noEmit` in `apps/retailer` (clean); `node --test src/*.test.mjs` in `apps/retailer` (62/62 pass, 26 new); the new tests drive the real supabase-js client with an injected fetch for no signal, a hung request cut by the timeout, a duplicate `client_ref`, a database refusal and an offline-then-online run (two stamps in, a resend adds nothing); `npx expo export --platform android` (Hermes bundle builds; local only, nothing uploaded).
- **Not checked:** not checked on a phone; the screens have not been seen. Nothing sent to the live database. How to try it on a phone: Settings, long-press the version line, "Simulate outage" makes stamps save on the phone (switch it off and they send); for rewards use aeroplane mode, because the switch only fakes stamp sending.
- **Next:** (owner) yes to commit, then a JS-only OTA for Business 1.0.1 (and 1.0.2 if approved), Android and iOS separately with `--environment production`. Optional follow-up: queue spend-shop purchases the same way (`record_manual_spend` already takes `_client_ref`).

### 2026-11-21 - Shopper app: tapped card grows into the shop page, Back shrinks it home - LIVE (OTA)

- **Branch:** `claude/card-to-page` (worktree `.claude/worktrees/v2-dashboard-23f22a`, from origin/main 54167be). Commit `e855eee`, pushed to `main` and published by OTA on the owner's yes (2026-11-21).
- **What:** from the Glide Studio reel "Don't cut. Carry." Tapping a shop card now grows the card into the shop page (~320 ms spring, UI thread): a window opens from the card's exact rectangle to the full screen, the card's colour turns into the shop's page colour with the shop logo, then the page shows through. Back (page button and Android back) re-measures the card and shrinks the page into it; Back mid-growth turns it round smoothly. Reduced motion: quick fade instead. If the card can't be measured, or has scrolled off screen, it opens as a hard cut / closes with a fade. Taps from notifications, links, Ask Whirl, Ask-a-shop and requested shops keep the old hard cut.
- **Cards wired:** home top card ("Show my card", whole card grows), "Your cards" tiles, home near-you rows, hero carousel, photo rails, search/category rows, map tab shop cards, Favourites "View" (whole card grows).
- **Behaviour change:** the shop page is now drawn over the tabs instead of replacing them, so the home list, search results and map keep their scroll and state when you come back (before, they reset). The keyboard is dismissed when a page opens. The tabs are hidden from screen readers while a page is open.
- **Menus from their button:** nothing to do. The shopper app has no button-anchored menus; every pop-up is a bottom sheet (`Sheet.tsx`) that already rises from the bottom edge.
- **Files:** `apps/shopper/src/components/CardGrow.tsx` (new), `apps/shopper/App.tsx`, `apps/shopper/src/components/HomeCollection.tsx`, `apps/shopper/src/components/HomeFeed.tsx`. JS only: no change to `package.json`, `app.json` or the lockfile.
- **Checks run:** `npx tsc --noEmit` in `apps/shopper` (clean); `npx expo export --platform android` (Hermes bundle builds, so the Reanimated worklets compile; local export only, nothing uploaded).
- **Not checked:** not checked on a phone or emulator; the animation has not been seen running. Web preview not possible (react-native-maps does not bundle for web). Feel, timing, Android `measureInWindow` offsets and the safe-area padding during growth all need a look on a real phone, ideally a slow Android.
- **OTA (branch `production`, `--environment production`, message "Tapped card grows into the shop page; Back shrinks it home"):** runtime 1.0.2 android group `46ac33ab-18b9-4c2d-9210-691c209a08a5` (update `01a1fed7-cba2-7272-beab-c0b378d37d3b`), ios group `49909009-1799-4cc2-95b3-7a23a28f12fe` (update `01a1fed9-c1a3-7e4f-80e8-5c834971d1d1`); runtime 1.0.1 android group `4aa248ef-08b9-4cea-994b-37784336feda` (update `01a1fedb-8b8c-74fd-bce2-0acdb22d98f8`), ios group `3d9ca859-050d-4f85-a562-787bab9d3e99` (update `01a1fedd-71cc-71d4-8759-b8903272169b`). Older runtimes published by setting `app.json` version to 1.0.2 / 1.0.1 temporarily, then restored (not committed). Not published for 1.0.3 (still in review).
- **Bundle check:** `u.expo.dev` serves all four new update IDs for their runtime and platform. The asset CDN (`assets.eascdn.net`) answers 403 to direct downloads, so the 1.0.1 iOS upload was checked by hash instead: the local file `eas update` uploaded matches the manifest's launchAsset hash and contains `tgukdabfvvoywawmzbdo`, `onClosed` and `accessibilityViewIsModal` (the last two exist only in the new code). The other three bundles were built by the same command from the same commit but not opened.
- **Rollback:** republish the previous shopper groups, or `npx --yes eas-cli@24.11.0 update:roll-back-to-embedded --branch production --runtime-version <1.0.1|1.0.2> --platform <android|ios>` from `apps/shopper` (embedded drops every OTA since the store build). Shows on the second app launch.
- **Next:** (owner) open the shopper app twice, then tap a few cards and press Back, ideally on a slow Android. (Claude) when 1.0.3 is approved, publish this and every later shopper OTA for runtime 1.0.3 too.

### 2026-11-21 - Email codes instead of email links (sign-up, password reset) - LIVE

- **Released (owner's yes, "everything on main"):** commit 54167be on main. Supabase templates applied in the dashboard (old templates were not backed up; the page blocked reading them). Email OTP length changed 8 to 6 (expiry 3600 s). Website live (served bundle has "Send a new code"). OTAs from 54167be also carry the 2026-11-17 design-audit fixes and walk-past JS (guarded; `location-guard.test.mjs` passes).
- **OTA groups (android / ios):** shopper 1.0.3 `6c665ba1-21fa-42ce-8b51-938d61ca49e3` / `29922978-d3d6-47ce-90aa-21e50d72d480`; shopper 1.0.2 `cfd3e019-b008-40b1-aebc-7199155775c9` / `27734cdd-f173-4ead-825f-71c72dc31248`; shopper 1.0.1 `475964fb-eb95-407b-9339-28826fdc1e0e` / `9d8dcb53-c9a0-45cd-b651-ba90f0f42603`; Business 1.0.2 `42749cee-372e-4433-85cd-6771e170848e` / `d32d78be-b196-45ad-bd53-42ec0f04f4d3`; Business 1.0.1 `34d58598-5d0c-41c0-84b2-5f2d9799969c` / `d3ba689b-821f-42b3-b656-f29047f1e067`. Every bundle downloaded and checked: contains `tgukdabfvvoywawmzbdo` and "Send a new code".
- **Superseded at once on shopper 1.0.1 and 1.0.2:** another session (branch `claude/card-to-page`) published "Tapped card grows into the shop page" minutes later (1.0.2 `46ac33ab…` / `49909009…`, 1.0.1 `4aa248ef…` / `3d9ca859…`). Those bundles were checked too and include the email codes and audit fixes. Shopper 1.0.3 and both Business versions serve the groups above.
- **Rollback:** republish the previous groups (shopper 1.0.2 android a995da70-28aa-40a9-b446-9ad971a002cc, ios 3f9dacc6-b9e7-4b2f-92b2-61c421551e51; 1.0.1 android ca3e45fb-5842-4267-b4e1-69e031c6c4ee, ios a777e9b6-e252-4cf6-94e5-4e93fb899956; Business 69182dc6-380c-452a-a928-76ccf0d111e5) with `npx eas-cli@24.11.0 update:republish --group <id>`, or `update:roll-back-to-embedded` per runtime and platform.
- **Branch:** `claude/email-otp-39de5a` (worktree `.claude/worktrees/email-otp-39de5a`, from origin/main 090e7a8).
- **What:** after email sign-up, people type a 6-digit code (`supabase.auth.verifyOtp`, type `signup`) instead of tapping a link, then carry on signed in. Password reset sends a code; the person types it with a new password (`verifyOtp` type `recovery`, then `updateUser`). Every code screen has "Send a new code" (60 s timer), "Use a different email" and plain errors for wrong or old codes. Signing in before confirming now sends a fresh code and shows the code screen instead of "tap the link". Signing up again with an address that already has an account now says so (Supabase sends nothing in that case).
- **Where:** shopper sign-up (`apps/shopper/App.tsx` AuthScreen, `src/components/EmailCodeStep.tsx`, `src/email-code.ts`); Business shop sign-up (`src/shop-onboarding.tsx`) and sign-in screen reset + unconfirmed (`App.tsx` Auth, `src/components/EmailCodeStep.tsx`, `src/email-code.ts`); website `Signup.tsx`, `ForgotPassword.tsx` (now asks for the code and new password on one page), `Login.tsx` (unconfirmed), `WhatsAppOnboarding.tsx` (runs `complete_whatsapp_signup` after the code, as `/auth/callback` does), `components/email-code-step.tsx`, `lib/email-code.ts`. The three `email-code.ts` files are copies; keep them in step.
- **Kept:** `/auth/callback` and `/reset-password` are unchanged, and every request still passes the same redirect URL, so links in emails keep working for older app versions. The shopper app still sets no redirect (Supabase Site URL), as before.
- **Templates:** `supabase/templates/confirm-signup.html` and `reset-password.html` (+ README) show `{{ .Token }}` large and keep `{{ .ConfirmationURL }}` as a fallback link. Not applied: the live templates are hosted in Supabase and `config.toml` has no auth section.
- **Checks run:** `npx tsc --noEmit` in `apps/shopper` and `apps/retailer` (both clean); `npm --prefix apps/web run build` passes. Website sign-up, forgot password, log-in-unconfirmed and resend exercised on a local dev server against a local fake of the auth endpoints (no live project calls): wrong code shows the error, right code signs in and lands on `/dashboard`, reset sends `PUT /auth/v1/user`, resend resets the timer.
- **Not checked:** not checked on a phone (neither app run); WhatsApp code path not run; nothing run against the live Supabase project (no test inbox in the repo); live OTP length and expiry not read.
- **Order to release:** done 2026-11-21 (templates, website, OTAs).
- **Next:** (owner) open each app twice and try sign-up and reset with a real inbox. (Claude) once every app version on phones has the code screens, offer to drop the link from the templates.

### 2026-11-18 - Outreach bot moved online (Supabase + admin page) - NOT shipped

- **Branch:** `claude/outreach-online` (worktree `epic-franklin-e146a6`), from origin/main 8a7906b. Uncommitted: waiting for the owner's yes.
- **What:** the laptop cold-email bot (`marketing/outreach-bot`, untracked) rebuilt online so it sends with the laptop off. Same rules: 9:00-16:00 London, weekdays, 25/day, 90-240 s random gap, follow-ups first, 3 emails (day 0, +3, +4 more) in one thread, do-not-contact, replied/stopped, excluded earlier batches, `email_ok` must be yes, List-Unsubscribe header, refuses `[EDIT` / unfilled `{{field}}`, auto-off after 3 failures in a row. New: also refuses an email without the "reply no" line; one row per lead per step in the database, so a step can never go twice.
- **Files:** migrations `20261121160057_outreach_bot.sql` (APPLIED 2026-11-21; 11 admin-only tables, RLS via `has_role`, stop/resume/auto-send RPCs, send lock) and `20261117120100_outreach_schedule.sql` (pg_cron every minute, only while auto-send is on, Vault secret `outreach_cron_secret`); function `supabase/functions/outreach-send/` (+ `config.toml`, verify_jwt false, checks cron secret or admin JWT itself); rules in `_shared/outreach-core.ts`, copied byte for byte to `apps/web/src/lib/outreach-core.ts` (test enforces); admin page `/access?view=outreach` (Growth → Outreach bot: Overview, Leads, LinkedIn, Instagram, Emails, Settings) in `pages/admin/Outreach.tsx`, `outreach-data.ts`, `admin-glass.css`, `AccessPanel.tsx`, `Overview.tsx`; import script `scripts/outreach-import.mjs`.
- **Mailbox:** the laptop `.env` sends through IONOS (`smtp.ionos.co.uk`) on port 587, not Gmail. Supabase blocks ports 25 and 587 (docs, functions/limits), so the online sender uses port 465 (implicit TLS). Secrets: `OUTREACH_SMTP_HOST`, `OUTREACH_SMTP_PORT=465`, `OUTREACH_SMTP_USER`, `OUTREACH_SMTP_PASS`; optional `OUTREACH_DRY_RUN=true` logs instead of sending.
- **Checks run:** `npm --prefix apps/web run build` passes; Deno 2.1.4 `deno check` of the function passes; `node --test supabase/functions/_shared/outreach-core.test.mjs` 8/8; parity script (scratchpad, not committed) ran the laptop bot's own `lib.mjs` and the new rules on the real lead files: 0 differences in status, queue order, email text, LinkedIn and Instagram text (80 + 403 leads); the function itself run under Deno against a fake database API and a fake TLS mail server on port 465: auth refusals, outside-hours skip, dry run (nothing sent), live send, follow-up first with In-Reply-To/References, List-Unsubscribe, blocked lead skipped, lock released, bad template refused, auto-off after 3 failures; admin page rendered locally with made-up data at desktop and phone width; import script dry run on the real files (80 + 1,441 lead rows, 6 do-not-contact, 66 excluded, 1 stopped).
- **Not checked:** migrations never applied anywhere (SQL not run); no real IONOS login from Supabase (needs the secret); pg_cron calling the deployed function; the admin page with a real admin login; not checked on a phone.
- **Next (owner, each a separate yes):** 1 (done 2026-11-21: tables applied, auto_send false, RLS on all 11, no anon grants); 2 (done 2026-11-21: four OUTREACH_SMTP_* secrets set by the owner, host and port fingerprints match smtp.ionos.co.uk and 465); 3 (done 2026-11-21: `outreach-send` deployed from d1aa6a7, refuses calls without the cron secret or an admin login); 4 (done 2026-11-21: imported 80 email-ok + 1,441 leads rows, 6 do-not-contact, 66 excluded, 1 stopped, 0 sends, 5 templates; re-run it if the laptop bot sends anything before the switch-over); 5 push the website; 6 press "Test connection" and "Email me a test", then apply the schedule migration; 7 turn on auto-send. The laptop bot must stay off once the online one is on, or shops get emailed twice. `plan.md` task T8 (outreach stop gate) still stands.

### 2026-11-17 - Home page: bold sapphire hero, no serif italics - LIVE

- **Commit:** 8a7906b on main, confirmed live (served CSS has the new hero rules).
- **What:** owner picked option 2 of 4 rendered previews. Nav and hero on sapphire with white type, white stamp card with sapphire coffee stamps, lime and cyan cards behind, lime "Start collecting". Sections below keep the paper look. Instrument Serif italics replaced by Inter across the home page (owner disliked them). Files: landing.css, poster-fx.css.
- **Checks:** `npm run build` passes; hero rendered light, dark and 390 px. Not checked on a real phone. The Instrument Serif font is still imported in index.css but no longer used on the home page (could be dropped later).

### 2026-11-17 - Home page hero fix - LIVE

- **Commit:** 57b0ea9 on main, confirmed on www.the-loyalty-loop.com (served CSS has `.lp-logo-tile`).
- **What:** hero grid centred and headline slightly smaller so the card fits beside it on one screen; stamps are smaller with a coffee cup; logo on a small paper circle on near-black surfaces (card, demo card, footer, dark-mode nav), mark unchanged; no clipped back-card label. Files: Landing.tsx, landing.css, landing-demo.tsx.
- **Checks:** `npm run build` passes; hero rendered at 1464 px (125% zoom) light and dark, and at 390 px. Not checked on a real phone.

### 2026-11-17 - Website unslop + site-audit fixes + owner decisions - LIVE

- **Commits on main:** 74754dc (unslop pass), ac5c79e (audit fixes), eaf97b5 (owner decisions). Each confirmed on www.the-loyalty-loop.com from the served CSS/JS.
- **ac5c79e:** signed-out map shows Map, Log in, Sign up; log-in, sign-up, Help and 404 use the home page palette (`.surface-paper` in color-system.css); shop link while signed out returns to the shop after log-in (`?next`, shop pages only); text on shop colours uses `onBrandColor`; map error state with retry; theme applied before first paint (index.html); cookie banner storage guarded; copy fixes.
- **eaf97b5 (owner decisions):** logo shown as supplied (filters removed); both home-page videos hidden (`SHOW_VIDEOS` in Landing.tsx); faded text no longer forced to black, /60 text raised to /70.
- **Checks:** tsc and `npm run build` pass; screenshots in docs/unslop/{before,after,after-audit,after-decisions} (local, mocked data). Not checked: real phone, signed-in pages with real data.
- **Open:** logo dark green petal hard to see on the black hero card, demo card and footer (owner); owner pages jump while loading; no phone menu on home page; sign-up and Google/Apple do not carry `?next`; unused CSS and old design doc; new videos (owner). Audit and claims list: docs/unslop/AUDIT.md.

### 2026-11-17 - Website unslop pass (branch `claude/unslop-website-8bbf16`, NOT merged, NOT deployed) - Claude

- **What:** `unslop` skill pass over `apps/web` in light-polish mode, owner's brand kept (paper/near-black/stone/sapphire, Inter + Instrument Serif, coloured owner tiles, Whirl). Audit, direction and unverified-claims list: `docs/unslop/AUDIT.md`. Screenshots: `docs/unslop/before/`, `docs/unslop/after/` (rendered locally with a mocked database and made-up sample shops; nothing touched production).
- **Changed:** uppercase tracked labels made sentence case (landing, owner sidebar, Analytics, Customers, programme builder, onboarding, command palette, shop "How it works"); sparkle-for-AI icons replaced (Analytics, Reviews, builder, onboarding, tutorial); landing preloader, page-change curtain, magnetic buttons, mouse-following cursor and hero parallax removed (`poster-fx.*`; scroll-to-top on public pages kept as `PublicScrollReset`); reveal and hero card entrance shortened; `transition-all` removed from badge/switch/tabs/onboarding dots; hover lifts and photo zoom on shopper cards removed; `font-extrabold` removed; `✓`/`★` glyphs became icons; leftover pulsing placeholders became Whirl skeleton blocks; "Welcome back" log-in title is now "Log in"; exclamation marks removed ("Continue in our app", "You're open for stamps", explainer "Free coffee"); shop page logo no longer clipped by the cover (stacking bug); Analytics change badges read "Up from 0"/"No change"; Scan title chip removed; heading letter-spacing eased for small headings (`index.css`).
- **Left alone:** admin panel (dark/lime rebuild of 16 Nov awaiting the owner), owner tile colours, sideways "how it works" panels on the landing (owner to decide), stamp-icon emoji picker, printable poster.
- **Checks run:** `tsc -p tsconfig.app.json` clean; `npm run build` OK; `oxlint src` only 3 pre-existing hook warnings in Settings.tsx; `node --test tour-script.test.mjs` 3/3 pass; after screenshots looked at for landing, Analytics, shop page. **Not checked:** dark mode after-shots not reviewed, real phone, signed-in pages against real data. `docs/unslop/before/admin-home.png` predates the 16 Nov admin rebuild, so it is not a fair before for admin.
- **Coordination:** the "Fable 5.2 skills and site audit" session runs read-only auditors; this session is the only writer under `apps/web`. Its website report had not arrived at commit time.
- **Next (owner):** look at the before/after screenshots and say whether the website part goes live; if yes, merge the branch to `main` (Vercel deploys). JS/CSS only, no app OTA, no migration.

### 2026-11-15 - Local clean-up: duplicate files, merged worktrees and branches - done locally, nothing to ship

- **What:** removed 26 worktrees whose commits are all in `origin/main`, had no uncommitted files and no session using them. Deleted 51 local branches already merged into `main` (`git branch -d`). Deleted `handoff.md` and the two root preview images (byte-identical copies are in `backup/main-folder-full-2026-11-15`). Sent the `claude/zen-maxwell-8qh7zl` zip and its unzipped folder in Downloads to the Recycle Bin (all 116 files matched the branch on GitHub).
- **Kept on purpose:** every `backup/` and `snap/` branch, every unmerged branch and its worktree, every worktree with uncommitted files, the two worktrees with sessions (`v2-speed-aabb87`, `v2-dashboard-23f22a`), and `instruction-rewrite`. Nothing on GitHub was deleted.
- **Checks run:** per worktree `git status --porcelain` (0 lines), `merge-base --is-ancestor HEAD origin/main`, ignored files listed (only `.env` copies, skills copies, `node_modules`). Git itself refused nothing in the removed set.
- **Not finished:** `%TEMP%\release-dark`, `release-wa` and `whirl-moments` are unregistered from git but 2 to 3 files each are locked by a running process (old dev servers). Delete the folders after a restart.
- **Open:** seven `%TEMP%` worktrees show about 700 changed files each (cause not checked): `card-release`, `integ`, `ll-main-wt`, `prog`, `rel3`, `release`, `shop-release`. 12 git stashes are untouched. About 46 remote branches on GitHub are untouched.
- **Next:** (owner) say whether to check the seven `%TEMP%` worktrees and prune merged branches on GitHub.

### 2026-11-15 - Main folder moved to `main` - done locally, nothing to ship

- **What:** the main folder was on `owner-redesign-on-origin-main`, 189 commits behind, with 21 edited and 29 loose items. A full snapshot was taken first (`backup/main-folder-full-2026-11-15`, `a73869a`), then the folder was switched to `main` at 978b667.
- **Checks run:** all 348 edited and loose files compared by hash against the snapshot before the switch, 0 mismatches. After: no tracked changes, and the folder is level with `origin/main`.
- **Not in the snapshot:** `logocreator/`, `logo-design-skill/`, `logo-generator-skill/` (each is its own git repo) and ignored files such as `.env`. All are still on disk, untouched.
- **Not run:** `npm ci` in the folder. Its `node_modules` predate `main`, so install before running anything there.
- **Open:** the two loose `Directory.tsx` files belong to the unmerged trades directory work and may fail a type-check in this folder. The folder will drift behind again unless it is pulled.
- **Next:** (owner) decide whether trades directory mode and the country picker should be merged from the snapshot or dropped.

### 2026-11-15 - Handoff replaced with this short file - LIVE on main

- **What:** the 3,834-line log was replaced by this file. Nothing was deleted: the old log from `main` and the main folder's copy (which had about 50 entries never pushed) are both in `docs/handoff-archive/`. `CLAUDE.md` now says to read this whole file.
- **Sources:** the old log's November entries, `handoff.md` written earlier the same day, and git state.
- **Checks run:** both archive files are byte-identical to their sources; diff touches only the handoff, the archive and `CLAUDE.md`. **Not run:** no build or test (docs only).
- **Limits:** sections 2 to 5 were condensed from entry headings and their open-item lines, not from a line-by-line reading of all 3,834 lines. Entries before November were not re-read; anything still open from then is only in the archive.
- **Next:** (owner) correct anything in sections 1 to 5 that is out of date.

### 2026-11-15 - Admin panel rebuilt (website `/access`) - LIVE on main f71f2e5

- **What:** new admin shell and overview. 15 sidebar items folded into 6 under Today, Platform and Operations; old `?view=` links still work. Presentation only: no database or function changes.
- **Files:** `apps/web/src/pages/admin-glass.css`, `AccessPanel.tsx`, `admin/Overview.tsx`, `components/admin-dashboard.tsx`.
- **Checks run:** type-check clean, website build passes, local preview with made-up data in light, dark and phone width. **Not run:** nothing checked with a real admin login; approve, reject, backups and release emails not clicked on the live panel.
- **Rollback:** `git revert f71f2e5` and push to `main`.
- **Next:** (owner) open `/access` and click through each area once. (Claude, if asked) restyle the sub-page tables and buttons to match.

### 2026-11-15 - Instruction files rewritten - LIVE on main b47c991

- `CLAUDE.md` holds the current rules, release checklist and Never list. `AGENTS.md` points to it. Docs only.

## 9. Archive

- `docs/handoff-archive/2026-11-15-main.md`: the full log as it was on `main`, September to 15 November 2026.
- `docs/handoff-archive/2026-11-15-main-folder.md`: the main folder's copy from the same day. It differs: it has local-only entries (card design, trades directory, logo work, outreach bot, 90-day plan) and lacks some of main's.
- Both mention Codex throughout. Codex is gone; read those entries as history.
