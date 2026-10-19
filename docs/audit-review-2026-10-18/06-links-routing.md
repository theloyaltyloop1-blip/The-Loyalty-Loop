# Audit 06 – Broken Links & Asset Routing

Method: `vite build` (placeholder Supabase env) + `vite preview`, custom Playwright crawler (seeds = every route in `App.tsx` + unknown path; follows all internal `<a href>`; records any same-origin response ≥400, failed requests, and `href="#"`). Static grep of `to=`, `href=`, `navigate()`, `redirectTo`, `src=`.

## Issues found & fixed
| # | Issue | Fix |
|---|---|---|
| 1 | No catch-all route: unknown URLs rendered a blank page | `src/pages/NotFound.tsx` + `<Route path="*">` |
| 2 | No SPA fallback for deploy: deep links (`/dashboard`, `/reset-password` from email) 404 on Vercel | `apps/web/vercel.json` rewrite → `/index.html` (excludes `/assets/`, favicon, icons) |
| 3 | Landing "See all shops" was dead `href="#"` | `<Link to="/dashboard">` |
| 4 | `<title>web</title>` | `The Loyalty Loop` |

## Verified OK
- All 28 declared routes + nav arrays (`dashboard-layout`, `owner-layout`) resolve; every internal link target exists.
- `/dashboard/admin` → `/access` redirect: single hop (then auth guard → `/login`), no chains/loops.
- `redirectTo` for password reset → `/reset-password` (route exists).
- Assets: favicon, logo PNG, hashed JS/CSS — 0 errors. Canonical tags: none present.
- External: Google Fonts 200; Google Maps blocked by sandbox egress (URL format standard `maps/search/?api=1`); `mailto:` not checkable.

## Raw crawl output (post-fix)
```
200 / -> /
200 /dashboard -> /login
200 /dashboard/shop/demo -> /dashboard/shop/demo
200 /dashboard/rewards -> /dashboard/rewards
200 /dashboard/news -> /dashboard/news
200 /dashboard/favourites -> /login
200 /dashboard/profile -> /dashboard/profile
200 /dashboard/activity -> /dashboard/activity
200 /dashboard/inbox -> /dashboard/inbox
200 /terms -> /terms
200 /privacy -> /privacy
200 /dashboard/admin -> /login
200 /access -> /login
200 /brand -> /login
200 /owner -> /owner
200 /owner/onboarding -> /owner/onboarding
200 /owner/scan -> /login
200 /owner/tools -> /login
200 /owner/settings -> /login
200 /owner/notifications -> /owner/notifications
200 /owner/announcements -> /owner/announcements
200 /owner/reviews -> /owner/reviews
200 /owner/support -> /owner/support
200 /login -> /login
200 /signup -> /signup
200 /signup/owner -> /signup/owner
200 /forgot-password -> /forgot-password
200 /reset-password -> /reset-password
200 /does-not-exist [NotFound page] -> /does-not-exist
ISSUES: 0

```

Result: **0 404s / 0 failed requests / 0 empty-hash links.**

## Pass 2 – signed-in crawl (mocked Supabase, `06-scripts/authcrawl.js`)
Each role was crawled with a fake session, with Supabase REST/auth/functions intercepted. Total: 145 page loads across admin, business_owner, staff, consumer and brand_head.
- 0 same-origin 4xx/5xx responses, 0 failed requests, 0 broken `<img>`, 0 `href="#"`.
- Role redirects are each a single hop: admin→`/access`, brand_head→`/brand`→`/owner`, business_owner→`/owner`, staff→`/owner/scan`, consumer→`/dashboard`, a bad shop slug→`/dashboard`.
- An initial admin JS error (`null.length`) only happened because the mock returned `null` from RPCs; with realistic `[]` responses there was no error. This is not an app bug.

## External links (sandbox egress blocks most hosts)
| URL | Result |
|---|---|
| fonts.googleapis.com | 200 |
| i.postimg.cc logo (thank-you email) | blocked here. **Risk:** the email logo is on a free third-party image host; move it to Supabase storage or `/public` |
| esm.sh, react.dev, oxc.rs, swc.rs, github.com (README) | blocked/403 by the proxy; not verifiable |

## Re-tests
- Re-test 1–2 (2026-10-18T03:04Z, the 01:59 and 02:59 runs combined): public crawl + 5 role crawls, 0 issues each.
- Re-test 3 (2026-10-18T04:04Z): 6 crawls, 0 issues.
- Re-test 4 (2026-10-18T05:04Z): 6 crawls, 0 issues.
- Re-test 5 / final (2026-10-18T06:04Z): 6 crawls, 0 issues.

**Final: 5-hour window complete — 0 broken links/assets across all re-tests.**

## Follow-up: email logo
- `main` had already moved email logos off postimg to `https://www.the-loyalty-loop.com/logo-for-emails` (`apps/web/public/logo-for-emails.png` + a root `vercel.json` rewrite). This branch is behind `main`, so the risk flagged above was already fixed there.
- As requested, there is now also a copy in Supabase Storage: public bucket `brand`, at `https://tgukdabfvvoywawmzbdo.supabase.co/storage/v1/object/public/brand/loyalty-loop-logo.png` (400×248 PNG, 8,788 bytes, sha256 `e96797868e30…548e`, verified byte-for-byte). The email templates were not changed.
- Also note that `apps/web/vercel.json` on this branch duplicates the SPA rewrite already in the root `vercel.json` on `main`. Drop it when merging.
