# CLAUDE_HANDOFF.md: where The Loyalty Loop stands

Read this whole file before any work. Rules are in `CLAUDE.md`.

- Sections 1 to 7 are the standing picture. Correct them when a fact changes.
- Section 8 is the log. Add each new entry at the top of it.
- When the log passes 20 entries, move the oldest into `docs/handoff-archive/` as a new dated file.
- The full history up to 15 November 2026 is in `docs/handoff-archive/` (see section 9). Search it before redoing something that may have been tried.

## 1. Current state (update on every release)

- Live code: `origin/main`. Vercel deploys the website on every push to `main`.
- Supabase project ref: `tgukdabfvvoywawmzbdo`.
- Shopper versions on phones: 1.0.1 and 1.0.2. In review at Apple and Google since 2026-11-15: 1.0.3 (iOS build 17, Android versionCode 135).
- Business versions on phones: 1.0.1. In review at Apple and Google since 2026-11-15: 1.0.2 (iOS build 15, Android versionCode 134).
- When 1.0.3 and 1.0.2 are approved they become extra versions to publish OTAs for. Add them here.
- Waiting for the next native build: predictive back and blurry image placeholders (2026-11-07 polish entry). Icons, splash, dark-mode native half and walk-past are already in the builds in review.
- Shops use stamps by default. Programme types live: `stamp_legacy`, `spend_threshold`, `tiers`, `points`, `custom` (AI-designed).
- Parked: Fidel card linking (hidden in the shopper app; spec in `ARCH_PLAN.md`), SumUp till link (live, only Test Shop connected), WhatsApp.
- Real usage on 2026-11-15: 7 approved shops including test shops, 6 memberships.

## 2. What is live

**Website** (`apps/web`): shopper pages, owner dashboard, admin at `/access` (rebuilt 2026-11-15), AI programme builder, "Try it" demo on the home page, dark mode, outage message (`apps/web/public/status.json`), phone visitors sent to the apps (`src/components/mobile-app-gate.tsx`; phone-only web pages go in `WEB_ONLY_PATHS`), release-email admin tab (`/access?view=release-emails`).

**Both apps, by OTA:** dark mode, Whirl mascot and Ask Whirl assistant, stronger haptics, typo-tolerant search, outage banner with saved home screen, keyboard-aware text boxes, branded pop-ups (`showAlert`), AI programme builder.

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
- Website staff Redeem panel does not show pounds or percent off for custom programmes.
- No admin page for `programme_requests`.
- Milestone rewards are not clawed back on a refund.
- SumUp tokens are not Vault-encrypted.
- Simplification: identical files copied across shopper, retailer and web; CORS headers hand-copied into about 27 edge functions; `apps/api/src` prototype and `apps/admin` stub unused; stale `test` profile in `apps/retailer/eas.json`.
- `ARCH_PLAN.md` and `IMPLEMENTATION_TIMELINE.md` still describe the Codex era. `.agents/skills/` is a stale Codex copy of `.claude/skills/`.

## 4. Never checked on a phone

Almost every release since 2026-11-07 was type-checked and bundled but not seen on a device. The owner should open each app twice (an update applies on the second launch) and look at:

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

- **Main folder** (`C:\Users\zahih\Downloads\The Loyalty Loop - for Claude`): branch `owner-redesign-on-origin-main`, far behind `origin/main`. It holds work that exists nowhere else: local trades directory mode (`apps/shopper/src/components/Directory.tsx`, `apps/web/src/pages/admin/Directory.tsx`, migration `20261031120000`), retailer country picker, card designer, migrations `20261022100247` and `20261105100000`, `marketing/outreach-bot/`, `marketing/london-leads/`, `plan.md` (90-day plan) and `handoff.md`. Snapshot: local branch `backup/pre-sync-2026-11-15` (`ff61505`), not pushed; it does not include `marketing/`, `logocreator/` or `artifacts/`.
- **Branches with work whose status the owner has not confirmed:** `claude/reel-preview`, `claude/integration-review`, `claude/whirl-audit`, `business-verification`, `claude/reel-pitch-80b83f` (owner-pitch landing copy and pitch scripts, uncommitted, conflicts with the live landing page).
- About 50 worktrees exist under `.claude/worktrees/`; around 14 had uncommitted files on 2026-11-15.
- Cold outreach bot (`marketing/outreach-bot/`): built, 63 shops emailed in earlier batches, nothing sent by the bot. Two outreach designs disagree; `plan.md` task T8 is a stop gate for all outreach.

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
