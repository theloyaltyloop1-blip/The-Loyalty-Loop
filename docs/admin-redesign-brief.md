# Admin panel redesign: brief (ready, not started)

Status: written 2026-11-15, NOT started. Start only on the owner's word, after the dark-mode chat ("Dark mode for the website and both apps", branch cut from `claude/reel-release`) has finished, and build on that chat's branch/work so the panel follows the new light/dark switch.

## Task
Redesign the admin panel at `/access` (apps/web/src/pages/AccessPanel.tsx, apps/web/src/pages/admin/*, `admin-*` classes in apps/web/src/index.css and colour roles in color-system.css). The owner says it "looks kind of bad". It must follow the site-wide light/dark switch (not dark-only), using the dark palette tokens the dark-mode chat adds.

## What is wrong now (seen live on 2026-11-15, signed in as admin)
- Everything has equal weight: four identical stat cards, charts, a queue panel, then 16 identical "System checks" cards, each with "View details".
- The 16 green-tick check cards take the most space and matter least. Healthy = one line; failures should surface at the top.
- Cold: pale grey on white, a thin border on every card, cyan sidebar highlight is the only colour. The owner dashboards use coloured tiles and clear hierarchy; the admin panel has none.
- 15 nav items in a scrolling sidebar, some hidden below the fold.

## Reference images (in `docs/admin-redesign-refs/`)
The owner says the last four are the best and most important: `4-lifestats-glass.png`, `5-alexatel-dark.png`, `6-felix-dark.png`, `7-hynex-glass.png`. The first three are lesser references (`1-medlink`, `2-loud-dark`, `3-intelly-colour`: colour blocks and a bold left rail).
Shared traits to take: one hero number with a small change pill and a big chart; a strip of four numbers in one card with up/down arrows; segmented toggles (Today / Week / Month); pill status tags (Paid / Pending / On going); soft rounded cards; one or two accent colours; grouped, labelled sidebar sections (Felix, Hynex) or a slim icon rail (Alexatel); one focal card for "what needs you"; frosted glass on Lifestats and Hynex (use sparingly, must still pass contrast).

## Proposed layout (adjust after looking at the refs)
1. "Needs you today": pending business listings, open owner support, reported reviews as three bold tiles; "all caught up" when empty. First thing on the page.
2. Hero: total shoppers and shops as one big number with a change pill (vs previous 30 days) and a 30-day line chart with Week / Month toggle; below it one card with businesses, memberships, transactions, rewards and arrows.
3. Middle: most-used features and activity by app as cards; recent activity list with status pills.
4. System checks: collapse the 16 into one "16 / 16 passing" card; failing checks listed at the top of the page only when something is wrong; keep the detail drawer and links (Storage, platform-health function).
5. Navigation: about six labelled groups instead of 15 flat items; no hidden-below-the-fold items; the current badge counts (listings, support, reports) stay.
6. Other tabs (Users, Businesses, Loyalty data, Audit log, Release emails, Listings queue, Support, Reported reviews, Trending, Shop requests, Controls, Backups, Paused features) get the same card, table and pill styling; do not change their behaviour, permissions or data calls.
Keep the colourful tiles and bold borders the owner likes (memory: dont-flatten-dashboards). No grey system boxes.

## Constraints
- Presentation only: no changes to RPCs, RLS, edge functions or migrations; every existing admin action must still work (approve/reject listing, resolve support, remove review, backups, trending, release emails, user roles).
- Build on the dark-mode branch; contrast must pass WCAG AA (4.5:1 text, 3:1 large text and UI) in both light and dark; test at desktop and phone width.
- Verify with `tsc -p tsconfig.app.json`, `npm run build`, and a browser preview signed in as admin (the owner's Chrome login works at www.the-loyalty-loop.com/access; locally the admin needs a Supabase session, so check what the preview can reach and say what could not be checked).
- No EAS builds or OTAs, no push to origin/main, no database changes. Update CLAUDE_HANDOFF.md with changes, checks and what was not verified.
