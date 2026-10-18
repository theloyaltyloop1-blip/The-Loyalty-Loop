# Audit 04 – Dead Code & Orphaned Assets

## Raw scans
### depcheck (apps/web)
```
Unused devDependencies
* tailwindcss
```
### knip (before)
```
Unused files (2)
src/pages/ComingSoon.tsx
src/pages/owner/OwnerComingSoon.tsx
Unused exports (2)
src/lib/businesses.ts: getVerificationDocUrl
src/lib/engagement.ts: applyReferralCode, acceptLegal
Unused exported types (3)
src/components/ui/button.tsx: ButtonProps
src/lib/auth-context.tsx: AppRole
src/lib/platform-health.ts: PlatformHealthCheck
```
### knip (after)
```
Unused exported types (3)
src/components/ui/button.tsx: ButtonProps
src/lib/auth-context.tsx: AppRole
src/lib/platform-health.ts: PlatformHealthCheck
```

## Removed
| Item | Reason |
|---|---|
| src/assets/hero.png, src/assets/vite.svg | Never imported (Vite scaffold leftovers) |
| public/icons.svg | Not referenced in src/index.html |
| src/pages/ComingSoon.tsx, src/pages/owner/OwnerComingSoon.tsx | Unmounted views, no imports/routes |
| apps/web/apps/web/package-lock.json | Stray empty lockfile in nested bogus path |
| getVerificationDocUrl, applyReferralCode, acceptLegal | Exported helpers with zero callers |
| --color-primary-glow, --radius-default (@theme) | Tokens with no utility usage |

## Kept (false positives / intentional)
- `tailwindcss` dev dep: loaded via `@import 'tailwindcss'` and peer of @tailwindcss/vite.
- Exported types ButtonProps/AppRole/PlatformHealthCheck: used internally in public signatures.
- packages/design-tokens: not imported by web, but documented in docs/; left for owner decision.
- No npm packages pruned → package-lock unchanged.

## Verification / benchmarks
- `npm run build` (tsc -b + vite): pass before & after; JS 234.36 kB (75.34 gz), CSS 44.39 kB – unchanged (orphans were never bundled).
- `npm run lint` (oxlint): 0 errors, 3 pre-existing exhaustive-deps warnings in owner/Settings.tsx.
- Repo shrink: 6 files deleted + 13 lines of dead code/CSS.
