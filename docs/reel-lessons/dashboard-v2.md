# Owner dashboard redesign, re-applied on current code (v2)

Base: `claude/reel-release` (origin/main 9c96a41 + merged logo/search/docs). Source intent: `snap/dashboard` (Omar Farook reel). Nothing pushed, deployed or OTA'd.

## Re-applied
Web (`apps/web`):
- `components/owner-command-palette.tsx` (new, from snapshot): search pill with Cmd/Ctrl-K, palette with quick actions + go-to pages. Frosted glass only at `md:`.
- `components/owner-layout.tsx`: sidebar group labels (Daily / Grow / Manage), sticky search pill. Kept main's `.svg` logo import.
- `pages/owner/Analytics.tsx`: flat single-style tiles (no sage/peach/amber), uppercase labels, KPIs grouped "Customers" / "Purchases & rewards", AI summary as flat card, Deep report + Coach folded in `<details>`.
- `pages/owner/Customers.tsx`: primary "Win back N customers" top-right (hover swaps to a "we miss you" line, motion-safe icon), "Customer health" caption, uppercase labels.

Business app (`apps/retailer/App.tsx`):
- Home: outcome-first "Win back N customers" button (opens Customers tab) shown when customers have gone quiet.
- Tiles/setup card: 1px soft border instead of 2px dark. `FoldSection` plus Analytics reorder (quick read before charts, charts folded) came from the snapshot.

## Skipped (origin/main already covers it)
- Web Customers: main removed the "Your most loyal" section, so no accordion for it ("gone quiet" is now the only list).
- Business Home: main already rebuilt Home (stats panel, scan card, pills, 3 tiles). Kept it entirely; the setup checklist already shows only while incomplete and becomes a "Setup guide" link when done, so my `setupOpen` accordion and the QUICK ACTIONS / ACTIVITY captions were dropped.
- Main already had an unused `onWinBack` prop on `DashboardHome` (wired to the Customers tab); now used.
- Business-app command palette and mobile frosted glass: skipped by design.

## Checks
- `apps/web`: `npx tsc -b` clean. `apps/retailer`: `npx tsc --noEmit` clean. No pre-existing errors seen.
- Not run: lint, tests, dev server, browser or phone.

## Untested
- Visuals: sticky search pill, `<details>` styling (Safari may need `[&::-webkit-details-marker]:hidden`), hover label swap, palette focus.
- Business Home win-back button placement/styling (reuses `homePill`); it opens Customers but does not preselect "gone quiet".
- Analytics "unify card" changes in the Business app came through the 3-way patch without visual review.
