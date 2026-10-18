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
