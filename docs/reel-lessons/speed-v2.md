# Launch speed v2 (re-applied onto current main, base 9c96a41 via claude/reel-release)

Status: committed locally on `claude/v2-speed-aabb87`. **Not pushed, no OTA, nothing run on a device.** All speed claims come from reading the request graph, not from a stopwatch.

Checks actually run: `npx tsc --noEmit` in apps/shopper and apps/retailer: **0 errors** (node_modules installed; `expo-sqlite/kv-store` resolves, so the old widgets error did not appear). `node --test apps/*/src/launch-cache.test.mjs`: 11/11 pass in each app.

## What main already had (changes the original plan)
- Shopper `src/home-cache.ts` (expo-sqlite kv-store, sync) already paints the shopper home from a saved copy, and the Business app already saved shops/roles to kv-store but only used them after a fetch **failed**. So fix 2 was mostly done in the shopper; I did not add a second home cache there.
- Both apps already fail open on offline role checks.
- Because kv-store is sync, already used in both apps (OTA-safe) and has no size limit, I did **not** use chunked SecureStore as the brief suggested: no chunking is needed and reads cost nothing at first paint. Deviation, deliberate. The session token itself stays in SecureStore, untouched.

## Before (current main): blocking requests to first paint
Shopper: OTA check (<=6 s) -> `getSession` (local, but a network refresh if the access token expired) -> rpc bootstrap -> `user_roles` (2 sequential) -> then spinner gate lifts. Home: `load()` = 11 parallel requests, then `reviews` as a 12th **sequential** one. Cached home painted only after the role gate.
Business: same gate (2 sequential requests, owner flag), then Dashboard spinner until `businesses`+`staff_members` (1 round), then full-screen spinner until the `reward_catalog`/`membership_tiers` check (1 more round). Stats (8 requests) started after `selected`. Sequential rounds before the dashboard: 2 + 1 + 1 = 4 (+ token refresh when expired).

## After
- **Optimistic auth (both):** `readStoredSession()` reads the persisted session locally, app renders at once; `getSession()` confirms in the background. Sign-out only on `SIGNED_OUT`, a `getSession` null with no error, or a real rejection (`isSessionRejection`: 401/403, refresh-token codes, AuthSessionMissingError). `AuthRetryableFetchError`, 5xx, network TypeErrors never sign out. `INITIAL_SESSION` with null is ignored.
- **Role gate (both):** last verified verdict cached per user (`launch-cache` scope `role`; Business app also seeds from its old `business-roles` key). Verification runs behind it. Only an "allowed" verdict is ever cached, so a wrong-app account never gets an instant open. First-ever launch (empty cache) still waits for the check, as before.
- **Lock screen safety:** new `lockCheckedFor` gate. Without it the optimistic path could paint cached data for a frame before the biometric lock engaged (previously masked by the network wait).
- **Shopper:** `reviews` moved into the main `Promise.all` (12 requests, 1 round instead of 11 + 1). AppRoot spinner replaced by a skeleton. All sign-outs (SIGNED_OUT event) now also clear `home-cache` (before only the manual button did; wrong-role and rejected sessions left it behind).
- **Business:** Dashboard paints from the cached shops/owned ids/stats and the "programme configured" ids (`launch-cache`, scopes `shops`/`stats`/`configured`), loads silently behind it. Known-configured shops skip the full-screen setup check (re-checked quietly; an unknown shop still waits). Setup-check effect now keys on shop id/owned/reward model instead of the `selected` object, so a background refresh no longer flashes the spinner. Stats cached only from an error-free response and ignored if the shop changed mid-flight. Old `business-shops`/`business-roles` keys are removed on sign-out.
- **Cache module** (`src/launch-cache-core.ts` pure + `launch-cache.ts` binding; identical in both apps): per-user keys, 7-day expiry, generation counter bumped by `clear()` so in-flight writes after sign-out are dropped, `stripSecrets` (token|secret|key|password|iban, deep) on every write.

## Walkthroughs (reasoned, not run)
- **Sign-out:** SIGNED_OUT -> `clearLaunchCache()` (all users, bumps generation) + `clearHomeCache(lastUser)`; any fetch started earlier carries an old ticket and its write is refused (tested).
- **Account switch:** switching needs sign-out first, so the cache is wiped; all reads also check the stored user id (tested). AppHome/Dashboard unmount when session is null.
- **Expired token:** stored session shows the app; queries wait on supabase-js's refresh. Success -> `setSession(fresh)`. Rejected refresh token -> SIGNED_OUT -> signed out + cache wiped.
- **Offline launch:** retryable refresh failure keeps the session; role check errors -> verdict fail-open (as main); cached data shown; no alert when something is cached.
- **First install:** no stored session -> `getSession` (local) -> guest screens; after first sign-in no cache -> same blocking path as today, then caches fill. Empty reads return null (tested).

## Files
`apps/{shopper,retailer}/src/launch-cache-core.ts`, `launch-cache.ts`, `launch-cache.test.mjs` (new); `src/supabase.ts` (`readStoredSession`); `apps/shopper/App.tsx` (AppRoot, `load`); `apps/retailer/App.tsx` (AppRoot, Dashboard).

## Needs your decision / flagged
1. **Existing shopper `home-cache.ts` stores `rewards` (with `qr_token`) and `stampCode` in unencrypted kv-store.** That is on main today and contradicts the "never cache QR tokens/stamp codes" rule. I left it, because stripping would remove the offline reward QR. Recommend a separate decision (strip, or move to SecureStore).
2. **The 6 s launch OTA check still blocks first paint** (unchanged, product decision). It is now the biggest remaining blocker.

## Risks / untested
- Nothing ran on a device: optimistic launch, `readStoredSession` key assumption (`sb-<ref>-auth-token`; if wrong it returns null and falls back to old behaviour, so safe but not faster), lock-screen gate, skeleton look, Business dashboard cache all untested at runtime.
- A stale stored session can show for a moment before `getSession` returns; first queries still wait on refresh.
- Cached stats/shops can be up to 7 days old until refresh; staff removed from a shop see it until the refresh lands.
- Business app only: if the first launch after OTA has no new cache, behaviour equals today's (spinner path), improvement starts from the second launch.
- Not audited: owner-pages fetches, shopper map, other tabs.
