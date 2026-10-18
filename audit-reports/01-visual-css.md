# Audit 01 – Visual & CSS Regression

- Date: 2026-10-18 · Branch: audit/01-visual-css
- Tooling: Playwright 1.56 + preinstalled Chromium, `vite preview` prod build (dummy Supabase env, backend unreachable)
- Breakpoints: 390, 768, 1280, 1920 · Routes: 27 (all in App.tsx) · 108 full-page screenshots per pass
- Checks: document h-overflow, elements past viewport right edge, clipped text (overflow hidden w/o ellipsis), WCAG AA contrast (alpha-composited fg/bg, inherited opacity)
- Script: `audit-reports/scripts/crawl.mjs` (`node crawl.mjs <outdir>`), summary: `sum.js`

## Scores
| Pass | h-overflow | offscreen | clipped | contrast |
|---|---|---|---|---|
| Before | 2 | 2 | 0 | 280 |
| After | 0 | 0 | 0 | 0 |

## Raw before-scan (count · issue · ratio · sample routes)
```
40 contrast button.absolute.bottom-6.right-8.text-sm Back 3.8 | 390/dashboard,390/dashboard/favourites,390/access,390/brand
36 contrast a.font-semibold.text-[#C9622E].hover:underline Sign up as a customer 3.33 | 390/dashboard,390/dashboard/favourites,390/access,390/brand
36 contrast a.font-semibold.text-[#C9622E].hover:underline Sign up as a Loyalty Loop Reta 3.33 | 390/dashboard,390/dashboard/favourites,390/access,390/brand
32 contrast a.text-xs.text-[#1a1a1a]/50.hover:text-[#1a1a1a]/80.hover:underline Forgot your password? 3.22 | 390/dashboard,390/dashboard/favourites,390/access,390/brand
8 contrast p.text-xs.font-bold.uppercase.tracking-wide Effective 7 August 2026 2.82 | 390/terms,390/privacy,768/terms,768/privacy
8 contrast p.mt-8.text-sm.text-black/50 Contact support through your o 3.95 | 390/terms,390/privacy,768/terms,768/privacy
8 contrast a.font-semibold.text-[#C9622E].hover:underline Log in 3.33 | 390/signup,390/signup/owner,768/signup,768/signup/owner
4 contrast em.text-primary.not-italic.font-display.italic in your 2.97 | 390/,768/,1280/,1920/
4 contrast em.text-primary.not-italic.font-display.italic pocket. 2.97 | 390/,768/,1280/,1920/
4 contrast button.inline-flex.items-center.justify-center.gap-2 Get started 3.42 | 390/,768/,1280/,1920/
4 contrast p.text-[11px].font-bold.uppercase.mt-3 3 more for a free flat white 3.85 | 390/,768/,1280/,1920/
4 contrast p.text-xs.font-bold.uppercase.opacity-70 STEP 1 3.74 | 390/,768/,1280/,1920/
4 contrast p.text-foreground/70 Browse shops, cafés and studio 3.76 | 390/,768/,1280/,1920/
4 contrast p.text-xs.font-bold.uppercase.opacity-70 STEP 2 2.25 | 390/,768/,1280/,1920/
4 contrast p.text-white/90 Tap to add a stamp or earn poi 2.79 | 390/,768/,1280/,1920/
4 contrast p.text-xs.font-bold.uppercase.opacity-70 STEP 3 2.38 | 390/,768/,1280/,1920/
4 contrast p.text-white/90 Hit the goal and a one-time re 3.05 | 390/,768/,1280/,1920/
4 contrast a.font-bold.text-primary.flex.items-center See all shops 2.97 | 390/,768/,1280/,1920/
4 contrast p.text-xs.text-foreground/60.mb-3 Coffee · Tooting 3.85 | 390/,768/,1280/,1920/
4 contrast p.text-[11px].font-bold.uppercase.text-foreground/50 Reward · Free flat white 2.94 | 390/,768/,1280/,1920/
4 contrast p.text-xs.text-foreground/60.mb-3 Bakery · Balham 3.85 | 390/,768/,1280/,1920/
4 contrast p.text-[11px].font-bold.uppercase.text-foreground/50 Reward · Free croissant 2.94 | 390/,768/,1280/,1920/
4 contrast p.text-xs.text-foreground/60.mb-3 Barber · SW17 3.85 | 390/,768/,1280/,1920/
4 contrast p.text-[11px].font-bold.uppercase.text-foreground/50 Reward · £10 off cut 2.94 | 390/,768/,1280/,1920/
4 contrast p.text-xs.text-foreground/60.mb-3 Pizza · Balham 3.85 | 390/,768/,1280/,1920/
4 contrast p.text-[11px].font-bold.uppercase.text-foreground/50 Reward · Free side 2.94 | 390/,768/,1280/,1920/
4 contrast a.text-primary.underline Drop us a line 2.97 | 390/,768/,1280/,1920/
4 contrast p.max-w-lg.text-white/90.mb-6 Set up your stamp card in five 3.64 | 390/,768/,1280/,1920/
4 contrast div.flex.items-center.gap-2.font-semibold Printable QR poster 4.08 | 390/,768/,1280/,1920/
4 contrast div.flex.items-center.gap-2.font-semibold Built-in promos 4.08 | 390/,768/,1280/,1920/
4 contrast div.flex.items-center.gap-2.font-semibold Customer analytics 4.08 | 390/,768/,1280/,1920/
4 contrast div.flex.items-center.gap-2.font-semibold Cancel anytime 4.08 | 390/,768/,1280/,1920/
4 contrast footer.border-t-[3px].border-foreground/10.py-8.text-center © 2026 The Loyalty Loop. Made  3.71 | 390/,768/,1280/,1920/
4 contrast button.inline-flex.items-center.justify-center.gap-2 Send reset link 3.42 | 390/forgot-password,768/forgot-password,1280/forgot-password,1920/forgot-password
4 contrast button.inline-flex.items-center.justify-center.gap-2 Save new password 3.42 | 390/reset-password,768/reset-password,1280/reset-password,1920/reset-password
2 offscreen div.absolute.-top-6.-right-6.h-24   | 390/,768/
1 h-overflow   403 | 390/
1 h-overflow   781 | 768/
```

## Fixes
- **Horizontal overflow (390/768, `/`)**: Landing hero "FREE to join" badge (`-right-6`) and stamp card (`-left-6`) now offset only at `lg:`.
- **Theme tokens (index.css)**: primary #ee5a2c→#c2410c (white text 3.42→5.18; on bg 2.97→4.5), fun-green #30a66f→#1e7a50, fun-violet #9069d3→#7a4fc4.
- **Hardcoded colors**: link orange #C9622E→#A84B1E (3.33→4.94), Back link blue #2F6FED→#1F56C7 (3.8→6.5), orange buttons `bg-[#E8703B]`→`bg-[#C2410C]` (white text).
- **Low-alpha text**: foreground/50,/60→/75; foreground/70→/80; white/90→white; white/70→white/85 (cookie banner); black/35,/40→/60; black/50→/65; "Forgot password" link /50→/75; step labels drop opacity-70.

## Altered files
- apps/web/src/components/auth-layout.tsx
- apps/web/src/components/cookie-consent.tsx
- apps/web/src/components/dashboard-layout.tsx
- apps/web/src/components/owner-layout.tsx
- apps/web/src/components/reviews-section.tsx
- apps/web/src/components/shop-card.tsx
- apps/web/src/index.css
- apps/web/src/pages/AccessPanel.tsx
- apps/web/src/pages/AccessTools.tsx
- apps/web/src/pages/Activity.tsx
- apps/web/src/pages/BrandWorkspace.tsx
- apps/web/src/pages/Home.tsx
- apps/web/src/pages/Inbox.tsx
- apps/web/src/pages/Landing.tsx
- apps/web/src/pages/Legal.tsx
- apps/web/src/pages/Profile.tsx
- apps/web/src/pages/ShopDetail.tsx
- apps/web/src/pages/owner/Analytics.tsx
- apps/web/src/pages/owner/Announcements.tsx
- apps/web/src/pages/owner/Notifications.tsx
- apps/web/src/pages/owner/Onboarding.tsx
- apps/web/src/pages/owner/Reviews.tsx
- apps/web/src/pages/owner/Scan.tsx
- apps/web/src/pages/owner/Settings.tsx
- apps/web/src/pages/owner/Support.tsx
- apps/web/src/pages/owner/Tools.tsx

Diff:  26 files changed, 63 insertions(+), 63 deletions(-)

## Limitations
- Authenticated routes (/dashboard/*, /owner/*, /access, /brand) redirect to the login screen without a live Supabase backend, so their in-app layouts were only audited via shared class replacements, not rendered. Rerun with real env vars to cover them.
- No z-index/overlap anomalies detected in rendered public pages; the detector covers overflow/clipping/contrast only for overlaps visible as offscreen elements.
- Pre-existing oxlint warnings (Settings.tsx exhaustive-deps) unrelated, left as is.

---
# Pass 2 – authenticated routes (2026-10-18 12:00 UTC)

- Added `scripts/mock.mjs`: Playwright route mock for Supabase (fake session in localStorage, fixture rows with long names, role via `ROLES` env). `scripts/run2.sh <out>` crawls as consumer, business_owner, admin+brand_head.
- Now rendered: /dashboard, /dashboard/{rewards,news,favourites,profile,activity,inbox}, /owner, /owner/{scan,settings,notifications,announcements,reviews,support}, /access. (/dashboard/shop/:id, /brand and /owner/tools error on mock data shape, not on real behaviour; not visually audited.)

## Scores (authed, 3 roles × 4 breakpoints)
| Pass | h-overflow | offscreen | contrast |
|---|---|---|---|
| Before | 4 | 224 | 224 |
| After | 0 | 0 | 4 (disabled "Post reply" button only; WCAG-exempt) |

## Raw before-scan
```
56 contrast button.flex.items-center.gap-3.rounded-2xl Sign out 3.24 | 390/dashboard,390/dashboard/rewards,390/dashboard/news,390/dashboard/favourites
28 contrast a.flex.items-center.gap-3.rounded-2xl Switch to customer view 3.24 | 390/owner,390/owner/scan,390/owner/settings,390/owner/notifications
8 contrast p.text-xs.font-semibold.uppercase.tracking-wide Coffee 3.3 | 390/dashboard,390/dashboard/favourites,768/dashboard,768/dashboard/favourites
8 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Your loyalty 2.46 | 390/dashboard/rewards,390/dashboard/activity,768/dashboard/rewards,768/dashboard/activity
4 contrast p.text-sm.text-[#1a1a1a]/50.mb-1 Hello, Customer 3.24 | 390/dashboard,768/dashboard,1280/dashboard,1920/dashboard
4 contrast p.flex.items-center.gap-2.text-xs Trending nearby 4.3 | 390/dashboard,768/dashboard,1280/dashboard,1920/dashboard
4 contrast p.flex.items-center.gap-1.5.text-sm Coffee 4.42 | 390/dashboard,768/dashboard,1280/dashboard,1920/dashboard
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Nearby 4.3 | 390/dashboard,768/dashboard,1280/dashboard,1920/dashboard
4 contrast p.text-[#1a1a1a]/55.mt-2.mb-7 Your earned rewards are ready  3.71 | 390/dashboard/rewards,768/dashboard/rewards,1280/dashboard/rewards,1920/dashboard/rewards
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide The Very Long Named Neighbourh 2.84 | 390/dashboard/rewards,768/dashboard/rewards,1280/dashboard/rewards,1920/dashboard/rewards
4 contrast p.mt-2.text-sm.text-[#1a1a1a]/55 Show this code to the shop whe 3.8 | 390/dashboard/rewards,768/dashboard/rewards,1280/dashboard/rewards,1920/dashboard/rewards
4 contrast p.text-xs.font-bold.text-[#1a1a1a]/45.uppercase Reward code 2.85 | 390/dashboard/rewards,768/dashboard/rewards,1280/dashboard/rewards,1920/dashboard/rewards
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide From local shops 2.46 | 390/dashboard/news,768/dashboard/news,1280/dashboard/news,1920/dashboard/news
4 contrast p.text-[#1a1a1a]/55.mt-2.mb-7 Fresh updates, menus and good  3.71 | 390/dashboard/news,768/dashboard/news,1280/dashboard/news,1920/dashboard/news
4 contrast p.text-xs.text-[#1a1a1a]/45 October 18 2.84 | 390/dashboard/news,768/dashboard/news,1280/dashboard/news,1920/dashboard/news
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Favourites 2.46 | 390/dashboard/favourites,768/dashboard/favourites,1280/dashboard/favourites,1920/dashboard/favourites
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Profile 2.46 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-sm.text-[#1a1a1a]/50.mb-4 Show this QR code or manual co 3.3 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-[10px].font-bold.uppercase.tracking-wide Manual code 2.49 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-sm Choose what shops can notify y 3.3 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-xs.text-[#1a1a1a]/50 When you earn a stamp, point o 3.3 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-xs.text-[#1a1a1a]/50 When a reward is ready to rede 3.3 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-xs.text-[#1a1a1a]/50 Occasional deals from shops yo 3.3 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-sm.text-[#1a1a1a]/55.mb-3 Share your personal link. When 3.8 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast button.mt-4.flex.items-center.gap-2 Delete my account 4.09 | 390/dashboard/profile,768/dashboard/profile,1280/dashboard/profile,1920/dashboard/profile
4 contrast p.text-[#1a1a1a]/55.mt-2.mb-7 Every stamp, point and reward  3.71 | 390/dashboard/activity,768/dashboard/activity,1280/dashboard/activity,1920/dashboard/activity
4 contrast p.text-xs.text-black/65 Keep going to unlock 3.04 | 390/dashboard/activity,768/dashboard/activity,1280/dashboard/activity,1920/dashboard/activity
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Analytics 2.46 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast button.px-4.py-2.5.text-sm.font-semibold detailed 2.46 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast span.flex.items-center.gap-1.text-xs flat 2.49 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/50.mt-0.5 New members 3.3 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/50.mt-0.5 Stamps given 3.3 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/50.mt-0.5 Rewards earned 3.3 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/50.mt-0.5 Rewards redeemed 3.3 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/50.mb-4 Scans Google reviews and your  3.3 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-sm.text-[#1a1a1a]/40 Ask anything — "How do I get m 2.49 | 390/owner,768/owner,1280/owner,1920/owner
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Scan 2.46 | 390/owner/scan,768/owner/scan,1280/owner/scan,1920/owner/scan
4 contrast span.text-xs.font-bold.uppercase.tracking-wide or manual code 1.93 | 390/owner/scan,768/owner/scan,1280/owner/scan,1920/owner/scan
4 contrast button.flex.items-center.gap-1.5.px-4 Loyalty & rewards 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.flex.items-center.gap-1.5.px-4 Win-back emails 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.flex.items-center.gap-1.5.px-4 Verification 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.flex.items-center.gap-1.5.px-4 Staff 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.flex.items-center.gap-1.5.px-4 Help & support 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.flex.items-center.gap-1.5.px-4 Danger zone 2.46 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast p.text-xs.font-bold.uppercase.tracking-wide Storefront preview 2.49 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast p.text-sm.text-[#1a1a1a]/50 Coffee 3.36 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast p.text-sm.text-[#1a1a1a]/50.mb-4 A logo is shown as your shop's 3.3 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast div.h-32.rounded-xl.border-2.border-dashed Drag image here or pick file 2.5 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast button.rounded-full.px-3.h-8.text-xs Closed 2.45 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast p.text-sm.text-[#1a1a1a]/50.mb-4 Extra photos shown on your sho 3.3 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast span.text-xs.font-semibold Add photo 2.49 | 390/owner/settings,768/owner/settings,1280/owner/settings,1920/owner/settings
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Customer news 2.46 | 390/owner/announcements,768/owner/announcements,1280/owner/announcements,1920/owner/announcements
4 contrast p.text-[#1a1a1a]/55.mt-2.mb-7 Share menu launches, events an 3.71 | 390/owner/announcements,768/owner/announcements,1280/owner/announcements,1920/owner/announcements
4 contrast p.mt-3.text-xs.text-[#1a1a1a]/40 Published 10/18/2026 2.49 | 390/owner/announcements,768/owner/announcements,1280/owner/announcements,1920/owner/announcements
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Customer feedback 2.46 | 390/owner/reviews,768/owner/reviews,1280/owner/reviews,1920/owner/reviews
4 contrast p.text-sm.text-[#1a1a1a]/50 from 3 reviews 3.3 | 390/owner/reviews,768/owner/reviews,1280/owner/reviews,1920/owner/reviews
4 contrast p.text-xs.text-[#1a1a1a]/40 10/18/2026 2.49 | 390/owner/reviews,768/owner/reviews,1280/owner/reviews,1920/owner/reviews
4 contrast button.rounded-xl.bg-[#C2410C].px-4.py-2 Post reply 2.79 | 390/owner/reviews,768/owner/reviews,1280/owner/reviews,1920/owner/reviews
4 contrast p.text-xs.font-extrabold.uppercase.tracking-wide Help centre 2.46 | 390/owner/support,768/owner/support,1280/owner/support,1920/owner/support
4 contrast p.mt-2.mb-7.text-[#1a1a1a]/55 Send a request directly to the 3.71 | 390/owner/support,768/owner/support,1280/owner/support,1920/owner/support
4 contrast p.text-xs.uppercase.tracking-wide.text-white/40 Platform operations 3.83 | 390/access,768/access,1280/access,1920/access
2 h-overflow   848 | 390/dashboard,768/dashboard
2 offscreen main.flex-1.p-8.max-w-5xl  848 | 390/dashboard,768/dashboard
2 offscreen div.relative.mb-8  816 | 390/dashboard,768/dashboard
2 offscreen input.h-14.w-full.rounded-full.border  816 | 390/dashboard,768/dashboard
2 offscreen p.text-sm.text-[#1a1a1a]/50.mb-1  816 | 390/dashboard,768/dashboard
2 offscreen h1.text-3xl.font-display.font-extrabold.text-[#1a1a1a]  816 | 390/dashboard,768/dashboard
2 offscreen div.flex.flex-wrap.gap-2.mb-8  816 | 390/dashboard,768/dashboard
2 offscreen p.flex.items-center.gap-2.text-xs  816 | 390/dashboard,768/dashboard
2 offscreen p.text-xs.font-extrabold.uppercase.tracking-wide  816 | 390/dashboard,768/dashboard
```

## Fixes
- **Bug: role-gated redirect race** (`lib/auth-context.tsx`): for one render after the session loads, `rolesLoading` was false with no roles, so `OwnerLayout` redirected deep links (e.g. /owner/scan, /owner/settings) to /dashboard → /owner. `rolesLoading` now stays true until roles have loaded for the current user. Guards added in `OwnerLayout`/`DashboardLayout`.
- **Mobile layout** (`dashboard-layout.tsx`, `owner-layout.tsx`, `AccessPanel.tsx`): fixed 256/288px sidebar crushed content to ~130px at 390px and caused horizontal scroll (848px on /dashboard, 640px on /access). Below `md` the sidebar is now a top bar with a horizontally scrolling nav; main gets `min-w-0` and smaller padding. BrandWorkspace padding reduced on mobile. Security FAB smaller on mobile.
- **Contrast**: `text-[#1a1a1a]/30–55`→/70, /60→/75, `text-black/30,45,55`→/65, `text-white/40,50`→/70 (Access panel), sidebar Sign out / Switch view /50→/75, Delete account red-600→red-700, locked badges in Activity no longer dimmed with opacity-65.

## Files changed in pass 2
- apps/web/src/components/dashboard-layout.tsx
- apps/web/src/components/owner-layout.tsx
- apps/web/src/components/reviews-section.tsx
- apps/web/src/components/shop-card.tsx
- apps/web/src/lib/auth-context.tsx
- apps/web/src/pages/AccessPanel.tsx
- apps/web/src/pages/Activity.tsx
- apps/web/src/pages/BrandWorkspace.tsx
- apps/web/src/pages/ComingSoon.tsx
- apps/web/src/pages/Favourites.tsx
- apps/web/src/pages/Home.tsx
- apps/web/src/pages/Inbox.tsx
- apps/web/src/pages/News.tsx
- apps/web/src/pages/Profile.tsx
- apps/web/src/pages/Rewards.tsx
- apps/web/src/pages/ShopDetail.tsx
- apps/web/src/pages/owner/Analytics.tsx
- apps/web/src/pages/owner/Announcements.tsx
- apps/web/src/pages/owner/Notifications.tsx
- apps/web/src/pages/owner/Onboarding.tsx
- apps/web/src/pages/owner/OwnerComingSoon.tsx
- apps/web/src/pages/owner/Reviews.tsx
- apps/web/src/pages/owner/Scan.tsx
- apps/web/src/pages/owner/Settings.tsx
- apps/web/src/pages/owner/Support.tsx
- apps/web/src/pages/owner/Tools.tsx
- audit-reports/scripts/crawl.mjs

---
# Pass 3 – overlap / z-index / covered controls / 320px (2026-10-18 13:35 UTC)

- New detectors in `crawl.mjs`: **covered** (elementFromPoint at centre of every in-viewport a/button/input/select/textarea), **overlap** (intersecting in-flow flex/grid siblings), **truncated** (ellipsis / line-clamp actually cutting text). Breakpoints now 320/390/768/1280/1920 (`W=` env to override).
- `states.mjs`: interactive states — FAQ open, cookie banner vs login form and landing hero CTAs, at 320/390/768/1280.

## Findings (before)
| Issue | Where | Fix |
|---|---|---|
| Cookie banner (fixed, z-50) covers hero CTAs, signup inputs, "Log in"/"Sign up" links; no way to scroll content out from under it | 320–768px: /, /login, /signup, /signup/owner | `cookie-consent.tsx`: reserves body `padding-bottom` = banner height (ResizeObserver) while open; compact padding/heading on mobile; `role="dialog"` + label |
| Scan manual-code row overflows (365px) | 320px /owner/scan (award + redeem) | input `min-w-0`, button `shrink-0` |
| Security FAB (fixed) covers right-edge controls (profile toggles) | 768px /dashboard/profile | dashboard `main` gets `pb-24` so content can scroll clear of FAB; FAB smaller on mobile (pass 2) |
| 35× truncated business name in switcher | 320px owner pages | Intentional `truncate` with full name elsewhere — no change |
| Sibling overlap | — | 0 found |

## After
- Authed 320/768 re-scan: 0 overflow, 0 overlap; remaining: disabled "Post reply" (WCAG-exempt), FAB over profile toggle only at initial scroll position (content scrollable clear).
- Cookie banner still overlays content on first paint by design (until a choice is made); page is now scrollable past it.

---
# Pass 4 – remaining routes, full regression, 200% text zoom (2026-10-18 14:46 UTC)

- Mock fixtures fixed (single-row responses for `id/slug=eq`, web-research report shape) → /dashboard/shop/:id, /brand, /owner/tools now render and are audited.
- Full regression: public + consumer + business_owner + admin + brand_head × 320/390/768/1280/1920.
- Text zoom: root font-size 200% (`ZOOM=200%`) at 390/1280 for consumer + owner.

## Findings & fixes
| Issue | Where | Fix |
|---|---|---|
| Bug: `/owner/tools` redirected to onboarding → /owner before owner data loaded | `pages/owner/Tools.tsx` | wait for `useOwner().loading` |
| Bug: `/brand` redirected to /owner before roles loaded | `pages/BrandWorkspace.tsx` | wait for `rolesLoading` |
| Shop hero: long name + verified badge overflowed (352px) at 320px; title under favourite button | `ShopDetail.tsx` | `text-3xl sm:text-4xl`, `pr-12`, name in `min-w-0` span, `p-6 sm:p-8` |
| Shop hero: white text on owner-chosen `brand_color` gradient unreadable for light brand colours | `ShopDetail.tsx` | 20% dark overlay layer + subtle text-shadow |
| 200% zoom: landing header (logo + CTA, `rounded-full`, no wrap) overflowed to 604px at 390 | `Landing.tsx` | header `flex-wrap`, `rounded-[2rem]`, logo nowrap |
| 200% zoom: shop card grid overflowed (454px @390, 1298px @1280) — grid items `min-width:auto` | `Home.tsx`, `Favourites.tsx` | `grid-cols-1 sm:grid-cols-2` (minmax(0,1fr)) |
| Deactivate-shop copy `text-red-700/75` on red-50 = 4.31 | `owner/Tools.tsx` | `text-red-700` |

## After
- 320px + 200% zoom re-scan (consumer): 0 overflow, 0 offscreen, 0 overlap, 0 contrast (excluding intentional `truncate` and disabled button).
