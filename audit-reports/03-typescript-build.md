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

## Open issue (not fixable in frontend)
- `Tools.tsx` "Deactivate shop" writes `businesses.is_active`, but no migration in `supabase/migrations` adds that column → the update will fail at runtime. Needs a migration (`alter table public.businesses add column is_active boolean not null default true;`) plus RLS review.

## Notes
- No SSR/SSG (client-only SPA), so no hydration/SSR failures applicable. No dynamic imports present.
