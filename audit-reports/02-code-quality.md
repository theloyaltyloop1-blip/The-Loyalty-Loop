# Audit 02 — Static Code Analysis & Linting

Linter: oxlint 1.x (`apps/web/.oxlintrc.json`). No ESLint/Prettier/Biome in repo. No test suite exists; verification = `tsc -b` + `vite build`.

## Scores
| Stage | Errors | Warnings |
|---|---|---|
| Baseline (old config) | 0 | 9 |
| Strict config, before fixes | 12 | 164 (157 = `react-in-jsx-scope`, invalid for react-jsx transform → disabled) |
| After fixes | 0 | 2 |

Build: `tsc -b && vite build` ✓ (JS 234 kB / 75 kB gzip). No type errors.

## Config tightening
- Enabled `correctness` (error) + `suspicious` (warn) categories; `import`, `unicorn` plugins.
- `react-hooks/exhaustive-deps`: error. `no-unused-vars` (ignore `_`-prefixed): error. `no-console` (allow warn/error), `no-debugger`, `eqeqeq` (smart), `typescript/no-explicit-any`, `import/no-cycle`: error.
- Off: `react/react-in-jsx-scope` (automatic JSX runtime), `import/no-unassigned-import` (CSS imports).
- Type-aware promise rules (`no-floating-promises`) need oxlint type-aware mode (tsgolint); not enabled. TS `noUnusedLocals/Parameters` already on.
- Scripts: `lint` (`--max-warnings 2`), `lint:fix`, `typecheck`; root `lint:web`, `typecheck:web`.

## Fixes
- `--fix` run: no auto-fixable issues.
- `no-explicit-any` ×5: `engagement.ts` (typed `unwrapBusiness` helper), `analytics.ts` (`CountQuery` type from builder), `Tools.tsx` (added optional `is_active` to `Business`).
- `exhaustive-deps` ×7: Analytics (2), Settings Winback/Staff, ShopDetail → depend on derived `businessId`. Settings Profile/Loyalty form re-sync: intentionally keyed on shop id (avoid clobbering unsaved edits) — documented inline disable.
- `no-shadow` ×3 (Login/Signup/ResetPassword): `error` → `authError`.
- `no-unneeded-ternary` (Onboarding).
- `console.log`/`debugger`: none found in `apps`, `packages`, `supabase`.

## Remaining
- 2× `react/only-export-components` (`useAuth`/`useOwner` co-located with providers). Standard pattern; HMR-only impact. Left as warnings.
- `apps/web/apps/web/package-lock.json`: stray empty lockfile (messy structure). Deletion was blocked by sandbox permission policy — remove manually: `git rm apps/web/apps/web/package-lock.json`.
- No formatter configured; adding Prettier would reformat nearly every file (dense one-liners) — recommend separate PR.

## Raw outputs
- `baseline-oxlint.txt`, `strict-before-fix.txt`, `strict-after-fix.txt` (this directory).

---

## Pass 2 — Type-aware linting & DB types

### Type-aware rules (oxlint `--type-aware` via `oxlint-tsgolint`)
- Enabled `no-floating-promises`, `await-thenable`, `no-misused-promises` (JSX attribute void-return check off — standard React convention).
- Before: 36 floating promises, 67 misused (`typeaware-before.txt`). After: 0 errors (`typeaware-after.txt`).
- Added `src/lib/report-error.ts`; fetch chains in effects now `.catch(reportError)` before `.finally(...)` (previously unhandled rejections). Inbox/Notifications read-mark mutations also catch. Intentional fire-and-forget calls marked `void`.
- `Scan.tsx`: rAF callback wraps async `tick` (`() => void tick()`).

### Supabase generated types
- Generated `src/lib/database.types.ts` from project `tgukdabfvvoywawmzbdo`; client is now `createClient<Database>`.
- Surfaced & fixed 14 real type mismatches: invalid dynamic table names in analytics (split into typed `stampCount`/`rewardCount`), `_reason` null vs undefined for RPC, `SupportRequest.business` optional (not selected in some queries), role select typed as `app_role` enum, `LoyaltyConfig`/`DayHours` → type aliases (JSON-compatible), admin health check uses untyped client for dynamic schema/table.
- Removed redundant casts via `--fix`.

### Remaining warnings (42, capped by `lint --max-warnings 42`)
- 39× `no-unsafe-type-assertion`: hand-written interfaces narrower than DB row types (e.g. `string` → union). Follow-up: derive app types from `Tables<'...'>` and add runtime guards.
- 2× `only-export-components`, 1× `consistent-return` (effect cleanup in Scan).

Regenerate types after migrations: Supabase MCP `generate_typescript_types` or `supabase gen types typescript --project-id tgukdabfvvoywawmzbdo > apps/web/src/lib/database.types.ts`.

---

## Pass 3 — Schema drift & dead code

### Schema drift fixed
- `ActivityItem.type` was missing DB enum value `spend` → Activity page would render an undefined label for such rows. Now derived from `Enums['transaction_type']`; label "Purchase" added.
- `AppRole`, `LoyaltyType` now derived from generated DB enums (removed 3 hand-copied unions).
- Lint warnings: 42 → 41.

### Dead code (knip, `knip.txt`) — reported, not deleted (file deletion blocked by sandbox policy; needs owner decision)
- Unused files: `src/pages/ComingSoon.tsx`, `src/pages/owner/OwnerComingSoon.tsx`.
- Unused exports: `getVerificationDocUrl`, `applyReferralCode`, `acceptLegal`, `ButtonProps`, `PlatformHealthCheck` (type).
- `acceptLegal` is redundant: signup trigger (migration 0024) inserts `legal_acceptances` from `legal_accepted` metadata — safe to remove. `applyReferralCode` is unused (referral redemption not wired in UI) — product decision.
