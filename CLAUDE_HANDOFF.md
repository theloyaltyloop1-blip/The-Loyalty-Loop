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
- Publish every OTA for shopper 1.0.1, 1.0.2 and 1.0.3, and Business 1.0.1 and 1.0.2 (the review versions get OTAs too, so they are current when approved). Latest OTA (2026-11-22, Business only: colour wheel in card designer from bb7b1fc; Business 1.0.2 and 1.0.1 are now one release ahead of the shopper app, which was not touched; IDs in the log). Earlier OTAs (2026-11-22, card page layout and win-back QR coupon from f2130a8, all update IDs in the log; every app version on phones is on the same main code): see log. Earlier OTAs (2026-11-22, card tiles, lag fix, photo cards, card designs, auto card colour from f198f99): see log. Earlier OTAs (2026-11-22, free birthday item from c58d7ef): shopper 1.0.3 `22b2ce31` / `a79bf80d`, 1.0.2 `e155ad0e` / `1a924080`, 1.0.1 `2ef5107f` / `e172315a`; Business 1.0.2 `5da220e6` / `a35944f4`, 1.0.1 `efd6a0b5` / `1fc49276` (android / ios). Earlier OTAs (2026-11-21, birthday rewards from 04dc5f9): shopper 1.0.3 `0d58e419` / `727c71b5`, 1.0.2 `d6e09b7d` / `4480f74c`, 1.0.1 `f5d3b503` / `15317d61`; Business 1.0.2 `313fa5b9` / `466cdc38`, 1.0.1 `fa4316cb` / `d5a731c3` (android / ios; automatic win-back from 2824456). Every app version on phones now runs the same main code (shopper 1.0.3 also picked up card-to-page with this release).
- Waiting for the next native build: predictive back and blurry image placeholders (2026-11-07 polish entry). Icons, splash, dark-mode native half and walk-past are already in the builds in review.
- Shops use stamps by default. Programme types live: `stamp_legacy`, `spend_threshold`, `tiers`, `points`, `custom` (AI-designed).
- Parked: Fidel card linking (hidden in the shopper app; spec in `ARCH_PLAN.md`), SumUp till link (live, only Test Shop connected), WhatsApp.
- Real usage on 2026-11-15: 7 approved shops including test shops, 6 memberships.

## 2. What is live

**Website** (`apps/web`): shopper pages, owner dashboard, admin at `/access` (rebuilt 2026-11-15), AI programme builder, "Try it" demo on the home page, dark mode, outage message (`apps/web/public/status.json`), phone visitors sent to the apps (`src/components/mobile-app-gate.tsx`; phone-only web pages go in `WEB_ONLY_PATHS`), release-email admin tab (`/access?view=release-emails`).

**Email codes (2026-11-21):** sign-up and password reset use a 6-digit code typed in the app or website, not a link, everywhere. Supabase templates show the code and keep the link as a fallback (source in `supabase/templates/`). Email OTP length 6, expiry 3600 s.

**Both apps, by OTA:** design-audit fixes of 2026-11-17 (released 2026-11-21), dark mode, Whirl mascot and Ask Whirl assistant, stronger haptics, typo-tolerant search, outage banner with saved home screen, keyboard-aware text boxes, branded pop-ups (`showAlert`), AI programme builder, birthday rewards (bonus stamps/points, or a free item the shop names: `businesses.birthday_bonus` / `birthday_reward_item`).

**Shopper app:** whole-page map tab, quick cards and live balances on home, custom card designs, win-back coupons.

**Business app:** opening-hours editor (2026-11-21), stamps saved on the phone without signal and sent later (2026-11-21), app-first onboarding, map pin picker (OpenStreetMap tiles, no native map), QR poster, Help and FAQ, delete or hand over shop, business verification screens (shadow mode).

**Supabase:** edge functions `design-programme`, `ask-whirl`, `business-coach-chat`, `map-pin`, `verify-business` (shadow mode), wallet pass functions, four SumUp functions, `send-release-announcement`, `product-updates-unsubscribe`, `send-winback-emails` (automatic every morning about 10am UK by cron `winback-auto`, per-shop switch, since 2026-11-21). Migration `walk_past_alerts` is applied.

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

- email code screens (shopper sign-up, Business shop sign-up, Business "Forgot password", signing in before confirming) and the design-audit fixes released 2026-11-21 (shopper home, shop page, QR; Business scan, customers; Android back in both)
- dark mode on home, a shop, scan and Settings; Whirl placements and the Ask Whirl sheet; sign-in, sign-out, offline launch and switching accounts
- Business Customers: the automatic win-back switch, days and next-run line
- Business opening-hours editor (Edit profile) and its time sheet; offline stamping (Scan with "Simulate outage" on and in aeroplane mode, the amber waiting pill, sending when back online, rewards refused offline)
- shopper Home layout, map tab, quick cards, live balances
- Business map pin picker, QR poster PDF, delete and hand-over screens, verification photo upload
- iOS rounded-corner patch (`src/smooth-corners.ts`); if corners look wrong, remove its import in `index.ts` and publish an OTA
- keyboard behaviour on Android in review replies and the AI chat; the website on a real iPhone and Android phone (should land in the store)

Also never run for real: a signed-in Ask Whirl question, a win-back send, a release email, the admin panel with a real admin login.

## 5. Work that is not on main

- **Branch `release/card-layout-and-winback-qr`** (worktree `.claude/worktrees/release-card-winback`): card page layout plus win-back email and QR. SHIPPED 2026-11-22: pushed to main, migration `20261122130000_my_winback_coupons.sql` applied, `send-winback-emails` deployed (v42), OTAs published. Still open: owner's phone check and the first cron send (see the section 8 log).
- **Main folder** (`C:\Users\zahih\Downloads\The Loyalty Loop - for Claude`): moved to `main` on 2026-11-15. Its earlier state (21 edited files, 348 files in all) is saved in local branch `backup/main-folder-full-2026-11-15` (`a73869a`), not pushed because it holds lead contact details. Work that exists only in that snapshot: local trades directory mode (edits to `AccessPanel.tsx` and the shopper app) and the retailer country picker. Still loose in the folder, not in git: `plan.md` (90-day plan), `handoff.md`, `marketing/outreach-bot/`, `marketing/london-leads/`, `artifacts/`, three logo tool folders, the `watch` and `video-edit` skills, two orphan `Directory.tsx` files and migration `20261031120000`. The 5 old commits from local `main` are in `backup/local-main-2026-11-15`.
- **Branches with work whose status the owner has not confirmed:** `claude/reel-preview`, `claude/integration-review`, `claude/whirl-audit`, `business-verification`, `claude/reel-pitch-80b83f` (owner-pitch landing copy and pitch scripts, uncommitted, conflicts with the live landing page).
- About 50 worktrees exist under `.claude/worktrees/`; around 14 had uncommitted files on 2026-11-15.
- Cold outreach bot (`marketing/outreach-bot/`): built, 63 shops emailed in earlier batches, nothing sent by the bot. Online version on branch `claude/outreach-online` (2026-11-18 entry, now in `docs/handoff-archive/2026-11-21.md`), not shipped. Two outreach designs disagree; `plan.md` task T8 is a stop gate for all outreach.

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
| App Store submission | `eas metadata:push` fails while the version is live (set `apple.version` in `store.config.json` first); an outdated Paid Apps Agreement blocks "Add for Review"; an empty copyright field only says "Version is not ready"; expedited review was already tried, do not suggest it. |
| Nominatim geocoding from the Business app | 403 without a custom User-Agent header. |
| Reel-lessons sessions built on a branch 102 commits behind | Most had to be redone. |
| Looks the owner rejected | Owner dashboards flattened to one card style ("boring", colours restored); an admin redesign with colour blobs and gradient chips ("AI slop"); every AI-generated logo direction. |
| Business app on an emulator | Failed: Expo Go version mismatch, JDK too new. |

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
### 2026-11-24 - Outreach sender: dead addresses marked Bounced, not counted as failures - LIVE
- Why: one dead lead (550 invalid DNS MX) at the head of the queue failed 3 times and auto-send switched itself off.
- Change: `supabase/functions/outreach-send/index.ts` - a 5xx recipient rejection (nodemailer EENVELOPE) marks the lead Bounced via `outreach_apply_reply` (reply_by 'ai', the column allows only ai/owner) and skips it. Login, connection and 4xx errors still count towards the 3-in-a-row pause.
- Deployed outreach-send; branch claude/outreach-dead-address, commit 0030a37 (rebased onto main). The failed shop was marked Bounced, failures reset, auto-send switched back on by the owner's yes.
- Leads list: owner chose to email the whole 'leads' list (1,441); email_ok set true for all, old values kept in table `outreach_email_ok_backup_20261122` (restore = update from it). Owner was told about PECR consent for sole traders.
- Checks: fake SMTP returning the real 550 error -> recognised as dead; dropped connection -> still a fault. Supabase deploy bundled OK. No Deno typecheck (Deno not installed). Not yet seen on a real dead address in production.
- Next: Claude - check the log after the next rejected address.


### 2026-11-22 - OTA: Business colour wheel in card designer - LIVE
- Commit bb7b1fc (feature) on origin/main, published from 64b076e. Owner approved. Business app only; shopper not touched. Published with `--channel production --environment production`, one platform at a time, message "Colour wheel in card designer". JS only: no change to package.json, app.json, lockfile or native config since the store builds (last such commit 1609114). Update shows on the second app launch.
- Business, group ID / update ID:
  - 1.0.2 android `cadf2529-b9ef-4ac7-8d8c-efa08bac54b6` / `01a20590-0b79-7cdc-8abf-691374c0279c`
  - 1.0.2 ios `49a96cce-c022-47bc-bc55-376b8030bd23` / `01a20591-b19e-7bd7-bf44-0585b5f1c6ed`
  - 1.0.1 android `09a70d29-3ee6-4f80-a178-86e14be5a53a` / `01a20593-1129-7b96-91a5-903c0d23fcfd`
  - 1.0.1 ios `266144e3-be4e-4f7a-a6c8-c0420616b59a` / `01a20594-7e66-7395-8104-7a8d00b5cc22`
  (1.0.1 was published by temporarily setting app.json version to 1.0.1, then restored; it reads 1.0.2 again and the tree was clean.)
- Verified by hash: the asset CDN returns 403 to direct downloads, so for each update the `u.expo.dev` manifest (runtime and platform) served the new update ID and its launchAsset hash equals the SHA-256 of the local file `eas update` uploaded. All four MATCH. Each file contains Supabase ref `tgukdabfvvoywawmzbdo` and the new string "Colour wheel. Drag to choose a colour." (from ColourWheel.tsx). NOT downloaded from the live CDN. NOT checked on a phone.
- Rollback: `npx eas-cli@24.11.0 update:roll-back-to-embedded --branch production --runtime-version <1.0.1|1.0.2> --platform <android|ios>` from `apps/retailer`, or republish the previous Business group (2026-11-22 "card page layout and win-back QR" entry: 1.0.2 android `f29e4dc7-e48d-4ca0-9758-fa29f0663680`, ios `869a3c00-5e15-46c9-9ca4-aa1f8818a3a0`; 1.0.1 android `95f440e1-818f-40da-bede-f2a384d6e7da`, ios `cc0e8bae-8366-4ea7-8753-2d12b720087c`).
- Next: (owner) after the second launch, try the colour wheel on a phone (dragging, Android and iOS, dark mode).

### 2026-11-22 - Business app card designer: colour wheel instead of hex codes - PUSHED to main, NOT live (no OTA)
- Changed: "Card colour" and "Gradient colour" in `CardDesigner.tsx` were hex text boxes (the only two colour inputs in the designer). Each is now a swatch button that opens a pop-up sheet with a colour wheel (angle = hue, distance from centre = saturation), a brightness slider, a live swatch and the hex value. The card preview above updates as you drag. Saved value is still a `#RRGGBB` string in `card_design`, so existing cards and the shopper app are untouched; saved colours load into the wheel (also reloaded when a template is picked or changes are discarded).
- How: pure JS. New `apps/retailer/src/components/ColourWheel.tsx` draws the wheel with `react-native-svg` and handles touch with `PanResponder` (wheel sized to screen width, 200 to 320 px; 48 px slider). Uses the existing `Sheet`. No `package.json`, `app.json`, lockfile or native change, so it is OTA-safe.
- Branch: `card-colour-wheel` (from origin/main 021739b), committed and pushed to main as bb7b1fc (no OTA, no build, not checked on a phone). Files: `apps/retailer/src/CardDesigner.tsx`, `apps/retailer/src/components/ColourWheel.tsx`, this file.
- Checks run: `npx tsc --noEmit` in `apps/retailer` (clean, after a real `npm ci`); hex to HSV to hex round trip on 20,000 random colours (0 mismatches). Not run: any check on a phone or simulator (touch dragging, Android and iOS look, dark mode), shopper `tsc` (packages/card-design not touched), OTA.
- Next: owner to try it on a phone via a dev build or after OTA, then say yes to commit and OTA (Business 1.0.1 and 1.0.2). Owner decision.

### 2026-11-22 - OTA: card page layout and win-back QR - LIVE
- Commit f2130a83e1dfe781df8a86855def869bbcaf4b01 on origin/main. Owner approved. Published with `--channel production --environment production`, one platform at a time. Update shows on the second app launch.
- Shopper ("Card page layout and win-back QR coupon"), group ID / update ID:
  - 1.0.3 android `547c739f-8f83-4ee3-ac43-bb63726ce1d3` / `01a20555-276d-7852-ac4b-4f26683d9030`
  - 1.0.3 ios `122090e6-cc62-4203-9459-0c11f0c7959b` / `01a20557-598d-7528-ae1f-6a13d8252bb9`
  - 1.0.2 android `620a97dd-9530-435c-b367-ad8412f362b0` / `01a20558-adc4-73e2-a518-ce4cbe7246d9`
  - 1.0.2 ios `0930ce52-73ac-446a-b3fa-99c778b245c8` / `01a2055a-09e7-72b5-9239-ba8ebbb27903`
  - 1.0.1 android `b07e2454-0deb-4df4-9fc4-bdb366cd6a49` / `01a2055b-4bab-7d27-8519-1e7d643a3ff2`
  - 1.0.1 ios `be982f2a-89d7-4ab6-81b8-3e05eefe82fd` / `01a2055c-986e-7595-b2dc-5ce395e0a2ea`
- Business ("Win-back QR coupon"):
  - 1.0.2 android `f29e4dc7-e48d-4ca0-9758-fa29f0663680` / `01a2055e-0cc8-7c16-b29e-94fcf614c289`
  - 1.0.2 ios `869a3c00-5e15-46c9-9ca4-aa1f8818a3a0` / `01a2055f-31ba-7c26-b5c7-35baa7c11c2f`
  - 1.0.1 android `95f440e1-818f-40da-bede-f2a384d6e7da` / `01a20560-45a2-7020-8c6e-789e1eec8115`
  - 1.0.1 ios `cc0e8bae-8366-4ea7-8753-2d12b720087c` / `01a20561-5657-75c3-83a0-9acb727d439d`
- Verified by hash: the asset CDN returns 403 to direct downloads, so for each update the `u.expo.dev` manifest launchAsset hash was compared with the SHA-256 of the uploaded file. All MATCH. Each file contains Supabase ref `tgukdabfvvoywawmzbdo` and `loyaltyloop:winback:`; Shopper files also contain `Next reward`. NOT downloaded from the live CDN. NOT checked on a phone.
- Backend state: migration `my_winback_coupons` applied; `send-winback-emails` v42 live; cron `winback-auto` first uses it about 10:00 UTC on 2026-11-23. No test email was sent. The QR path under Deno is untested (it falls back to an email without QR). `deno check` was never run.
- Rollback: `npx eas-cli@24.11.0 update:roll-back-to-embedded --branch production --runtime-version <v> --platform <android|ios>` from the app folder, or republish the previous group.
- Next: (owner) after the second launch, check the card page, the Rewards tab and a scan on a phone; (Claude) check the first cron send in the function logs and `winback_email_log`.

### 2026-11-22 - send-winback-emails: owner test send (`test_to`) - LIVE (function v42; no test send made yet)
- Branch `claude/winback-test-to` from origin/main 6030c90 (deployed v41 code). Committed and pushed to origin/main as caa0ffc; deployed to production as v42 (verify_jwt false, entrypoint index.ts). Function not invoked, nothing sent.
- File: `supabase/functions/send-winback-emails/index.ts` only. New body param `test_to`: works only after the existing signed-in owner-or-admin-of-`business_id` check (same `owner_id`/`has_role admin` test as Send now); the cron path (`x-winback-secret`) rejects any body with `test_to` (403). One plain address only (regex, length cap, no whitespace/CRLF); otherwise 400. Skips candidates and batch logic, calls `sendOne` with one fake candidate, a generated COMEBACK<8> sample code, subject prefixed `[TEST]`, and writes no `winback_email_log` row and no coupon row (so the code cannot be redeemed). Returns `{ test, email_sent, qr_sent, qr_error, error }`. Same rate limit as Send now.
- Checks run: careful self-review of the diff only. Not run: deno check / tsc (deno not installed here), any invocation, any real send.
- Still pending: owner-approved test send to an address the owner chooses (Claude, after the owner's yes); OTAs for shopper 1.0.1/1.0.2/1.0.3 and Business 1.0.1/1.0.2 (owner's yes needed). Rollback: redeploy the v41 code (commit 6030c90) of this file.

### 2026-11-22 - Combined release branch: card page layout + win-back email and QR - PARTLY LIVE (on main, migration applied; function, OTAs pending)

- **Branch:** `release/card-layout-and-winback-qr` from origin/main 359d984, worktree `.claude/worktrees/release-card-winback`. Merges `fix/shopper-card-detail-layout` (commit 89fcc89) and `claude/winback-email-polish` (commit e889505). Only conflict was this file (both log entries kept, newest first); `apps/shopper/App.tsx` merged cleanly with both changes. **Pushed to origin/main as 08ab84b (fast-forward from 359d984), 2026-11-22.**
- **Checks run:** real `npm ci` then `npx tsc --noEmit` in apps/shopper and apps/retailer on the combined branch (both exit 0). **Not run:** any phone or emulator check, `deno check` (deno not installed), the migration, a test email, scanning the QR.
- **Migration applied** 2026-11-22 to tgukdabfvvoywawmzbdo as `my_winback_coupons` (version 20261122215005). Verified: function exists, security definer, anon and public cannot execute, authenticated can. Security advisor lists it once as an authenticated-callable security definer function; intended, it is limited to auth.uid().
- **State:** Edge function `send-winback-emails` DEPLOYED 2026-11-22 as version 41 (was 40), verify_jwt false (unchanged), entrypoint index.ts, status ACTIVE, from origin/main e1dd843; no shared files imported. Not invoked, no email sent. No qrcode load error visible, but the function has not run yet so the `npm:qrcode@1.5.4` import is unproven until the first real send. No OTA published.
- **Next (each needs the owner's yes):** (3) one test email to the owner only (no built-in way yet; see the deploy note: cron runs 09:00-10:45 UTC daily and emails real customers of shops with auto win-back on); (4) OTA for shopper 1.0.1, 1.0.2, 1.0.3 and Business 1.0.1, 1.0.2 (list in section 1), android and ios separately, `--environment production`.

### 2026-11-22 - Shopper card page layout (even stamp rows, bigger name and logo, richer background, tidy code area) - NOT shipped (OTA pending)

- **Branch:** `fix/shopper-card-detail-layout` from origin/main 359d984, worktree `.claude/worktrees/agent-af05d5daa89129149`. Nothing committed.
- **Cause (from the owner's screenshot and the code):** (1) the grid layout in `LoyaltyCard` let 8 stamps wrap 6 + 2; (2) the shop name and logo were card-sized (28pt, 38px) on a full page; (3) the page was one flat colour, same as the card, so nothing had depth; (4) "Your code" and "Next reward" (`fields` in `ShopPass`) sat after the QR with a large gap, so the screenshot ended with their labels and no values.
- **Change:** `packages/card-design/LoyaltyCard.tsx`: grid stamps share out evenly (8 gives 4 + 4, 10 gives 5 + 5); new `hero` prop (name 42pt, logo 84px) used only by the shop page (`apps/shopper/App.tsx`), tiles and Business previews unchanged. `skin.tsx`: `ShopBackdrop` is now a soft lighter-to-deeper wash with two faint accent glows, all derived from the shop's colour. `ShopPass.tsx`: root no longer paints a flat background; with a card, the caption sits closer to the QR, the QR tile is tighter, and "Your code / Next reward" get a hairline divider and less dead space.
- **Checks run:** `npx tsc --noEmit` in apps/shopper (passes; real `npm ci` run). **Not run:** Business app tsc (shared files changed), any phone or emulator, a screenshot of the result, the grow/shrink animation (the page card is now larger than the tile card, so the CardGrow end frame may differ slightly), shops using ring/jar/bar layouts.
- **Open:** the Your code and Next reward values are still below the QR and may need a scroll on short phones; decide if they should move above the QR.
- **Next:** (owner) look at a card page on a phone after an OTA; (Claude, on owner's yes) commit, run Business tsc, include in the OTA.

### 2026-11-22 - Win-back email redesign (logo band, coupon box, dark mode) - NOT shipped
- Problem (Gmail Android dark mode): the cream logo showed as a pasted box, the code was huge unstyled bold text running nearly edge to edge, and "COMEBACK" ran into the random part.
- Change: `supabase/functions/send-winback-emails/index.ts` only (the `html` in `sendOne`). Table-based, inline-styled, explicit `bgcolor`, `color-scheme` metas, `prefers-color-scheme` dark rules. Logo sits in a green (#4F6438) header band; the image fully covers its own cream cell so a client recolouring cells cannot show a mismatch. Code is in a dashed-border cream coupon box, monospace, shown as "COMEBACK KP28AWKZ" (display only; stored and redeemed code unchanged, no space; the Business app and `redeem_winback_coupon` strip whitespace, so typing it with the space works). Copy and footer wording unchanged. `body_preview` in `winback_email_log` is now a short plain text line (the old `html.slice(0, 300)` would have been just the doctype and styles).
- Branch: `claude/winback-email-polish` (from origin/main), worktree `.claude/worktrees/agent-a2777ce4b1623a8d6`. Not committed.
- Checks run: rendered the template to a local HTML file and screenshotted it in headless Edge at phone width, dark and light colours (both looked right). Checks not run: `deno check` (deno not installed), no email sent, not checked in real Gmail/Apple Mail/Outlook (Gmail Android does its own colour inversion; media queries are ignored there, so the explicit bgcolors carry it).
- Added (owner request): coupon QR. Payload `loyaltyloop:winback:<CODE>` (`src/winback-qr.ts` in both apps; email function inlines the same string). Email: QR PNG made in the function with `npm:qrcode@1.5.4` and sent as an inline CID attachment (`content_id: "coupon-qr"`) via Resend, so no third-party QR service sees codes; if generation fails the email goes without it. Business app (`apps/retailer/App.tsx`): `parse()` now accepts the win-back QR and redeems through the same `redeem_winback_coupon` path as typing the code (new `redeemWinback`). Shopper app (`apps/shopper/App.tsx` RewardsTab): shows unused win-back coupons as Tickets (shop colour) with the QR, read through new RPC `my_winback_coupons()` in migration `supabase/migrations/20261122130000_my_winback_coupons.sql` (security definer, own rows only, NOT applied; the app shows no coupons until it is). No Alert.alert used.
- Added checks: `npx tsc --noEmit` clean in apps/shopper and apps/retailer after real `npm ci`. Not run: Resend CID rendering, deno check, the migration, scanning on a phone, shopper tab on a phone; QR generation verified in Node only (not Deno).
- Open: edge function not deployed. Next action (owner yes needed): deploy `send-winback-emails`, then send one test to yourself from the Business app and look in Gmail dark and light.

### 2026-11-22 - Outreach bot: automatic reply checking with AI labels - LIVE

- **Commits on main:** 7964a94 (feature), b0b299d (dry run callable by scheduler secret/service key; schedule file renamed). Website confirmed live (AccessPanel bundle on www.the-loyalty-loop.com contains the new "replies need you" text).
- **What:** function `outreach-replies` (deployed) reads the outreach mailbox over IMAP read-only every 5 minutes, all day, independent of auto-send (pg_cron job `outreach-replies`, migration 20261122124052). Mailbox is IONOS (`imap.ionos.co.uk:993`, same OUTREACH_SMTP_* login). Opens only mail from a lead's address or bounces naming an address we emailed; nothing from other mail is stored. Groq (`openai/gpt-oss-120b`, GROQ_API_KEY) labels replies: Booked a call, Signed up, Interested, Said no, Out of office, Bounced (by address), Needs you (unclear, a question, AI under 60% sure, or AI failure). All labels except Out of office stop the sequence; Said no adds do-not-contact; Out of office can hold the next email until the return date. Never sends anything. `outreach-send` redeployed so it respects the hold.
- **Database:** migration 20261121185114_outreach_replies (reply columns on `outreach_lead_state`, table `outreach_replies`, `outreach_apply_reply`, `outreach_set_reply_label`, checker lock; do-not-contact rows deletable only through the owner's confirmed label change).
- **Admin page:** Leads tab shows label (+ "AI"), reason, first lines, Replies and Needs you filters, "Change" sheet with all 7 labels (asks before removing from do-not-contact). Overview: "N replies need you" bar, last check time, checker errors (never stop the sender).
- **Checks run:** website build passes; Deno check of both functions; node tests 12/12; local run against fake IMAP + fake DB (privacy, bounces, AI failure, re-run, mailbox down); real-inbox dry run 2026-11-22 (no writes): 4 lead replies in 30 days: naama Bounced, Anavrin Bounced, Bridge Baker Said no, Lash Lab by Dora Out of office (no return date). First scheduled run expected to apply those 4.
- **Not checked:** admin page clicked with a real admin login; not checked on a phone. Groq data agreement still unsigned (section 3) and reply text now goes to Groq.
- **Auto-send:** was OFF in the database on 2026-11-22 12:43 UTC. Owner to switch on for Monday 9:00 if wanted.
- **Rollback:** stop the checker: `select cron.unschedule('outreach-replies');` (sender unaffected). Undo a label: Leads tab → Change. Website: `git revert b0b299d 7964a94` and push. Sender's hold support is backward compatible; leave deployed.
- **Next:** (owner) open /access?view=outreach → Leads → Replies, check the 4 labels; switch auto-send on when ready.

### 2026-11-22 - Google Wallet passes use the shop's own branding - LIVE (functions deployed; not yet checked on a phone)
- Cause: each shop already had its own class, but the pass looked generic because (1) card_design.color and cover were ignored, so shops with no brand_color got the same orange, (2) any non-square logo was swapped for the Loyalty Loop logo, (3) no hero image, (4) programName was 'Stamp Card', (5) square logos were not padded, so Wallet's circle crop clipped them.
- Change: new `_shared/wallet-branding.ts` (pure, tested) and `_shared/wallet-images.ts` (Deno: builds a padded 660px logo and a 1032x336 hero from card image or cover, stores them in the `covers` bucket as `{shop}/wallet-*-<hash>.png`, upserts the class). `create-wallet-pass` uses them. `update-wallet-pass` now also PATCHes the shop's class on every stamp/redeem (existing passes pick up branding) and accepts a call with no user_id as a class-only refresh. Class: issuerName and programName = shop name, hexBackgroundColor = card colour, programLogo, wideProgramLogo for wide logos, heroImage.
- Checks run: node tests for wallet-branding and wallet-progress (19 pass). Not run: Deno type check (no deno here), any live Google call, a real phone.
- Release: merged to origin/main as 2c6715f (cherry-pick of 8ff74e9, no conflicts). Deployed create-wallet-pass (v34) and update-wallet-pass (v28) together to the production project, verify_jwt true as before. Deploy bundled all _shared imports without error and both show ACTIVE. Not checked: a boot log for these two functions (none seen), any live Google call, a real phone. No OTA/build (no app code). Apple Wallet untouched. Rollback: redeploy the previous commit faa3363 versions of both functions.
- Not changed: Apple Wallet (create-apple-wallet-pass) still embeds Loyalty Loop logo images (LOGO_1X/2X/3X); same problem, separate fix. WebP/GIF logos cannot be padded (used as-is).
- Next (Claude, after owner yes): deploy create-wallet-pass and update-wallet-pass, add a pass for a test shop, then check it in Wallet. Owner: confirm the issuer account allows class PATCH and Storage `covers` is public (it is).
## 9. Archive

- `docs/handoff-archive/2026-11-15-main.md`: the full log as it was on `main`, September to 15 November 2026.
- `docs/handoff-archive/2026-11-15-main-folder.md`: the main folder's copy from the same day. It differs: it has local-only entries (card design, trades directory, logo work, outreach bot, 90-day plan) and lacks some of main's.
- `docs/handoff-archive/2026-11-21.md`: the whole file on 21 November 2026, with every log entry from 15 to 21 November (email codes, outreach bot online, website unslop, clean-ups).
- `docs/handoff-archive/2026-11-22.md`: the whole file on 22 November 2026, with every log entry from 21 to 22 November (birthday rewards, opening hours, offline stamps, card designs, toggles, OTAs).
- The two 2026-11-15 files mention Codex throughout. Codex is gone; read those entries as history.
