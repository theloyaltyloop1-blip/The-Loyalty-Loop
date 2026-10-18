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
