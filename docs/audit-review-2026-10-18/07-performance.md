# Audit 07 — Core Web Vitals & Performance Budget

Scope: `apps/web` (Vite 8 + React 19 SPA). Tool: Lighthouse CI (`@lhci/cli`), mobile preset (simulated 4G / 4× CPU), 3 runs per URL, median reported. Config: `apps/web/lighthouserc.cjs` (`npm run lhci`).

Notes on method:
- Build uses dummy `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (app throws without them). Auth-gated routes (`/dashboard*`, `/owner`) redirect to landing when logged out, so their numbers mostly reflect shell + redirect cost, not authenticated content.
- Baseline measured from a clean worktree of the pre-audit commit.
- Full HTML/JSON reports (~21 MB per run) not committed; manifests (per-run scores) in `audit-reports/raw/`.

## Results

### Baseline (pre-audit)
| Route | Perf | FCP ms | LCP ms | CLS | TBT ms | Transfer KB |
|---|---|---|---|---|---|---|
| / | 98 | 1817 | 1967 | 0.000 | 31 | 199 |
| /dashboard | 98 | 1804 | 2103 | 0.000 | 0 | 333 |
| /dashboard/shop/demo | 98 | 1806 | 1956 | 0.000 | 0 | 199 |
| /login | 86 | 1805 | 2707 | 0.187 | 5 | 333 |
| /owner | 98 | 1808 | 1955 | 0.000 | 6 | 199 |
| /signup | 85 | 1804 | 2706 | 0.210 | 8 | 333 |
| /terms | 98 | 1807 | 1953 | 0.000 | 0 | 199 |

### Final
| Route | Perf | FCP ms | LCP ms | CLS | TBT ms | Transfer KB |
|---|---|---|---|---|---|---|
| / | 96 | 2118 | 2418 | 0.000 | 42 | 233 |
| /dashboard | 94 | 2212 | 2628 | 0.000 | 25 | 243 |
| /dashboard/shop/demo | 94 | 2215 | 2621 | 0.000 | 6 | 246 |
| /login | 95 | 2000 | 2567 | 0.000 | 6 | 239 |
| /owner | 94 | 2134 | 2630 | 0.000 | 29 | 239 |
| /signup | 95 | 1965 | 2573 | 0.000 | 10 | 239 |
| /terms | 94 | 2217 | 2622 | 0.000 | 0 | 234 |

### Intermediate runs

After image/CLS + code-split + Google Fonts `<link>` (fonts became render-blocking):
| Route | Perf | FCP ms | LCP ms | CLS | TBT ms | Transfer KB |
|---|---|---|---|---|---|---|
| / | 89 | 2796 | 2796 | 0.036 | 0 | 234 |
| /dashboard | 89 | 2798 | 3016 | 0.000 | 0 | 244 |
| /dashboard/shop/demo | 88 | 2786 | 2861 | 0.000 | 0 | 247 |
| /login | 92 | 2720 | 2720 | 0.000 | 0 | 240 |
| /owner | 95 | 2264 | 2364 | 0.000 | 0 | 240 |
| /signup | 92 | 2718 | 2718 | 0.000 | 0 | 240 |
| /terms | 88 | 2797 | 2872 | 0.001 | 0 | 235 |

After self-hosted fonts, before `<picture>` flex fix and font preload:
| Route | Perf | FCP ms | LCP ms | CLS | TBT ms | Transfer KB |
|---|---|---|---|---|---|---|
| / | 95 | 2415 | 2415 | 0.036 | 24 | 233 |
| /dashboard | 93 | 2507 | 2617 | 0.000 | 18 | 244 |
| /dashboard/shop/demo | 95 | 2358 | 2457 | 0.000 | 2 | 246 |
| /login | 85 | 2407 | 2568 | 0.188 | 23 | 239 |
| /owner | 93 | 2508 | 2608 | 0.000 | 4 | 239 |
| /signup | 83 | 2409 | 2560 | 0.228 | 7 | 239 |
| /terms | 94 | 2362 | 2610 | 0.000 | 0 | 234 |

### Summary
| Metric | Baseline | Final |
|---|---|---|
| Worst CLS | 0.210 (/signup), 0.187 (/login) | 0.000 all routes |
| Worst perf score | 85 | 94 |
| Initial JS (gzip) | 193.6 KB, 1 chunk (704 KB raw) | ~164 KB across vendor/app chunks; other routes lazy |
| Logo image | 137 KB PNG (1005×624) | 5.8 KB AVIF / 7.2 KB WebP (640w), ~1 KB (96w) |
| Web fonts | **Never loaded** (invalid `@import` order → system fallback) | Self-hosted variable woff2, preloaded |

FCP/LCP rose ~0.1–0.4 s vs. baseline on some routes. Expected: baseline never downloaded Baloo 2/Quicksand (CSS `@import` after other rules was dropped — warning in build log), so it rendered system fonts. Final loads the intended brand fonts (62 KB) with preload + `font-display: swap`. LCP ≤2.63 s (2.5 s budget is `warn`; LCP element = landing hero text).

## Issues found & resolved

### LCP
1. Oversized logo: 137 KB 1005px PNG shown at ≤320px → AVIF + WebP (+ PNG fallback) at 640w/96w via `<picture>` (`src/components/brand-logo.tsx`). −95% bytes.
2. Above-fold priority: `fetchpriority="high"`/eager on auth/layout logos and ShopDetail shop logo.
3. Below-fold lazy: gallery photos, shop cards, rewards, news logos get `loading="lazy"` + `decoding="async"`.
4. Broken font loading: removed invalid Google Fonts `@import` from `index.css`; replaced with `@fontsource-variable/baloo-2` + `@fontsource-variable/quicksand`. `preloadFonts` plugin in `vite.config.ts` injects `<link rel=preload>` for latin subsets.
5. Hero media: landing hero is text + inline SVG (no image to preload). `src/assets/hero.png`, `vite.svg` unused → deleted. Font preload covers the real LCP dependency.

### CLS
1. Auth logo (0.19–0.21 on /login, /signup): no dimensions → added `width`/`height` (640×397). Second root cause: `<picture>` as a flex item collapsed to 0 width until load → `display: contents`. PerformanceObserver probe: 0.187 → 0.0008.
2. All `<img>` given explicit dimensions: shop-card (`size`), News (40), Rewards (56), ShopDetail logo (64)/gallery (300, `aspect-square`), Settings logo (48)/gallery (300).
3. Scan `<video>` given `width/height`; container already `aspect-square`.
4. Dynamic banner: cookie consent is `position: fixed` (no shift). No ad slots exist. Cover images are CSS backgrounds in fixed-size containers.

### Bundle
- Baseline: single 704 KB (194 KB gz) chunk with every page.
- Route-level code splitting (`React.lazy` + `Suspense`) for all routes except `/`, `/login`, `/signup`.
- `advancedChunks`: `react-vendor`, `supabase`, `icons` — cacheable, avoids ~25 sub-1 KB icon chunks.
- Dependency review: nothing oversized/unused. Largest: react-dom, `@supabase/supabase-js` (53 KB gz, needed at boot by `AuthProvider`), `tailwind-merge`, `@tanstack/query-core`. `qrcode.react` now loads only with Tools/Scan.
- Misc: `__dirname` → `import.meta.dirname` (Vite 8 warning); `<title>` "web" → "The Loyalty Loop". Lint: 0 errors (pre-existing exhaustive-deps warnings only).

### Final bundle
```
dist/index.html 1.12 kB 0.47 kB
dist/assets/loyalty-loop-logo-96-BNSuUphI.png 5.13 kB  
dist/assets/loyalty-loop-logo-640-BJoRmvJP.avif 5.79 kB  
dist/assets/loyalty-loop-logo-640-B04Sladw.webp 7.19 kB  
dist/assets/quicksand-vietnamese-wght-normal-ei70gACF.woff2 8.84 kB  
dist/assets/baloo-2-vietnamese-wght-normal-C4ZonJY6.woff2 9.88 kB  
dist/assets/quicksand-latin-ext-wght-normal-CrJ75Ewg.woff2 26.61 kB  
dist/assets/baloo-2-latin-ext-wght-normal-Dz43yst_.woff2 27.38 kB  
dist/assets/quicksand-latin-wght-normal-Buj9m_3d.woff2 28.24 kB  
dist/assets/baloo-2-latin-wght-normal-B_TVFhwJ.woff2 33.18 kB  
dist/assets/loyalty-loop-logo-640-BtJF6mR7.png 71.87 kB  
dist/assets/baloo-2-devanagari-wght-normal-B4j4n2PV.woff2 115.14 kB  
dist/assets/index-DZWLrzvc.css 46.73 kB 8.78 kB
dist/assets/supabase-DQwRF-NE.js 0.10 kB 0.11 kB
dist/assets/rolldown-runtime-CbXtAM7H.js 0.58 kB 0.36 kB
dist/assets/card-CPNFg9rM.js 0.63 kB 0.39 kB
dist/assets/engagement-_ugpS7nd.js 1.22 kB 0.46 kB
dist/assets/ResetPassword-CcsHacB-.js 1.38 kB 0.75 kB
dist/assets/ForgotPassword-1nXv9mXw.js 1.42 kB 0.75 kB
dist/assets/Favourites-I0G9Ai3V.js 1.49 kB 0.81 kB
dist/assets/Notifications-mOYhgAzH.js 1.89 kB 0.89 kB
dist/assets/Legal-DJ-JCLmT.js 1.96 kB 0.82 kB
dist/assets/shop-card-Cg-hIfE3.js 1.97 kB 0.91 kB
dist/assets/Inbox-CxrSy-pG.js 2.14 kB 1.05 kB
dist/assets/dashboard-layout-6i7wGtZV.js 2.28 kB 0.99 kB
dist/assets/News-B1tU2zEh.js 2.38 kB 1.08 kB
dist/assets/Activity-B3FU2soh.js 2.50 kB 1.16 kB
dist/assets/Rewards-B0wNzcjI.js 3.76 kB 1.47 kB
dist/assets/owner-layout-QdgYAtSx.js 3.87 kB 1.46 kB
dist/assets/Home-D4AwE7ye.js 4.00 kB 1.70 kB
dist/assets/BrandWorkspace-C5RH8-Ig.js 4.08 kB 1.44 kB
dist/assets/Support-BWxIIEb_.js 4.15 kB 1.63 kB
dist/assets/Announcements-CriPN0Ne.js 4.75 kB 1.85 kB
dist/assets/Reviews-Cjpkp5wr.js 4.91 kB 1.93 kB
dist/assets/Tools-Dyf1b2js.js 6.30 kB 2.21 kB
dist/assets/Onboarding-CBug6kPu.js 6.77 kB 2.48 kB
dist/assets/Profile-BspEZl-X.js 6.92 kB 2.48 kB
dist/assets/AccessPanel-CVyYzlA5.js 8.16 kB 2.61 kB
dist/assets/Scan-Cw1jPYws.js 11.20 kB 3.32 kB
dist/assets/Analytics-DDAUIGAh.js 14.88 kB 4.03 kB
dist/assets/icons-VnF6-Gzl.js 16.16 kB 6.00 kB
dist/assets/esm-DnGWL4tC.js 16.18 kB 6.01 kB
dist/assets/ShopDetail-BjoRkAew.js 16.37 kB 5.26 kB
dist/assets/Settings-CL_xvTu_.js 30.18 kB 7.84 kB
dist/assets/index-CPUhF1mM.js 100.35 kB 30.46 kB
dist/assets/supabase-CV0_D-zB.js 207.02 kB 53.40 kB
dist/assets/react-vendor-BiD0kjwC.js 228.85 kB 73.22 kB
```

## Recommendations (not done)
- Lazy-create the Supabase client inside `AuthProvider` (−53 KB gz initial).
- Metric-matched fallback `@font-face` (`size-adjust`) to cut residual swap shift.
- Use Supabase image transforms (`?width=`) for user-uploaded logos/covers.
- Run LHCI authenticated for dashboard/owner templates; wire `npm run lhci` into CI.
