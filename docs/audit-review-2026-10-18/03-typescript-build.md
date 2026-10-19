# Audit 3 – Build & TypeScript Compilation

Scope: `apps/web` (Vite 8 + React 19 + TS 6). Raw logs in `audit-reports/raw/`.

## Baseline (before)
| Check | Exit | Result |
|---|---|---|
| `tsc -b --noEmit` | 0 | 0 errors |
| `npm run build` | 0 | 2 warnings (Vite native config loader `__dirname`; CSS `@import` order) |
| `oxlint` | 0 | 9 warnings (7 exhaustive-deps, 2 only-export-components) |
| Explicit `any` | – | 4 occurrences |

## After
| Check | Exit | Result |
|---|---|---|
| `tsc -b --noEmit` | 0 | 0 errors |
| `npm run build` | 0 | 0 warnings, built ~0.9s; JS 234.36 kB (75.34 kB gz), CSS 44.45 kB |
| `oxlint` | 0 | 0 warnings |
| Explicit `any` | – | 0 |

## Changes
- `vite.config.ts`: `__dirname` → `import.meta.dirname` (ESM-safe; clears Vite warning).
- `src/index.css`: Google Fonts `@import url(...)` moved before `@import 'tailwindcss'` (CSS spec order; font import was previously dropped/invalid).
- `src/lib/analytics.ts`: `extra: (q: any) => any` → typed `CountQuery` derived from the Supabase builder.
- `src/lib/engagement.ts`: `(row: any)` mappers → generic `unwrapBusiness` helper.
- `src/pages/owner/Tools.tsx`: removed `as any`; added `is_active?: boolean` to `Business`.
- Hook deps (ShopDetail, Analytics, Settings Winback/Staff tabs): depend on derived `businessId` instead of `business?.id` + closure over `business`.
- Settings form/loyalty reset effects: wrapped in `React.useEffectEvent` so they reset only on business switch (preserves existing behaviour, satisfies lint).
- `.oxlintrc.json`: `allowExportNames: ["useAuth","useOwner"]` (hooks co-located with providers is intentional).

## Pass 2 – stricter compiler + runtime smoke test
- Enabled `noUncheckedIndexedAccess` and `noImplicitReturns` in `tsconfig.app.json`; fixed 18 resulting errors (unchecked array/regex-group access in Scan, ShopDetail, Onboarding, owner-layout, AccessPanel; `VERIFICATION_STATUS_META` keyed by the status union). Log: `raw/tsc-strict.txt`.
- Headless Chromium smoke test of all 28 routes plus an unknown URL (`raw/smoke.txt` → `raw/smoke-after.txt`):
  - **Bug fixed:** logged-out users saw a blank page on 14 protected routes (Inbox, Activity, News, Profile, Rewards, ShopDetail, owner Analytics/Onboarding/Notifications/Announcements/Reviews/Support). The pages waited on a `ready` flag that only flips after a signed-in fetch, and `OwnerProvider.loading` never cleared without a user. Now they check auth first and redirect to `/login`.
  - Added a catch-all route (`*` → `/`) to replace React Router's "No routes matched" warning.
  - Result: 29/29 routes render with no console errors or warnings.
- **Migration added:** `supabase/migrations/0026_business_is_active.sql` adds `businesses.is_active` (used by Tools → Deactivate shop). Not applied to any live project. Updates are covered by the existing owner update RLS policy.
- Note: `src/lib/supabase.ts` throws at load time if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are missing at build time, so a build without env vars produces a blank app. Make sure deploy envs set them.

## Notes
- No SSR/SSG (client-only SPA), so no hydration/SSR failures applicable. No dynamic imports present.

## Pass 3 – dependencies, bundle, accessibility
- `npm audit`: 2 high (nanoid 3.3.17 → 3.3.20, source-map-js 1.2.1 → 1.2.2; both build-time transitive deps of Vite/PostCSS) → fixed with `npm audit fix`; now 0 vulnerabilities (`raw/npm-audit.txt`).
- Bundle: tried `React.lazy` splitting of owner/admin/brand routes. With Vite 8/rolldown it **increased** eager JS from 234 kB to 403 kB (React's CJS interop is duplicated into a shared chunk), so it was reverted. Current: one 234 kB JS chunk (75 kB gzip). Revisit with `manualChunks` if the bundle grows.
- Accessibility (axe-core 4.10, WCAG 2 A/AA, public routes; `raw/axe.txt`): /login, /signup, /signup/owner pass. One issue type: **colour contrast** on /, /forgot-password, /reset-password, /terms, /privacy. White text on brand orange `#E8703B` is about 3:1; AA needs 4.5:1. Not changed, because the fix means darkening the brand colour (e.g. `#C2551F`) or using bolder/larger text — a design call.
- Re-run: tsc 0 errors, oxlint 0 warnings, build 0 warnings, smoke 29/29 OK.
