# Audit 08 – Production Readiness, SEO & Security (2026-10-18)

## Raw scan results
- `npm audit --omit=dev` (apps/web): **found 0 vulnerabilities**
- Secret grep (sk_live/sk_test/JWT/service_role/hardcoded API keys): **none**; service-role key only read via `Deno.env` in `supabase/functions/*`.
- `git log --all -- '*.env*'`: no `.env` ever committed; `.gitignore` covers `.env`, `.env.local`.
- Edge functions (8): all verify the caller via `auth.getUser` + `Authorization` header; owner-scoped ones check `owner_id`.
- `npm run build`: pass. `npm run lint`: 0 errors, 2 pre-existing warnings (`owner/Settings.tsx` exhaustive-deps).

## Resolved
| Area | Before | After |
|---|---|---|
| Security headers | none (no host config) | `apps/web/vercel.json`: CSP, HSTS (2y, preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; immutable cache for `/assets/*`; SPA rewrite |
| Title | static `web` | default title + `RouteTitle` component sets per-route `<title>` (`Page \| The Loyalty Loop`) |
| Meta | none | description, canonical, theme-color, OpenGraph, Twitter `summary_large_image`, `og-image.png` (1200×630) |
| robots.txt / sitemap.xml | missing | generated at build by `seoFiles` Vite plugin from `VITE_SITE_URL`; app routes disallowed |
| Favicon / PWA | svg only | `favicon.ico`, `apple-touch-icon.png`, `manifest.webmanifest`, 192/512 + maskable icons |

## Open items / follow-ups
- Set `VITE_SITE_URL` in prod env; default `https://theloyaltyloop.app` is a placeholder.
- Edge functions use `Access-Control-Allow-Origin: *`; recommend restricting to the prod origin (risk low since auth is bearer-token).
- CSP allows `'unsafe-inline'` styles (Tailwind/React inline styles). Verify hCaptcha/Maps load in a preview deploy; adjust CSP if Maps embed hosts differ.
- If not deploying on Vercel, port headers to the host (Netlify `_headers`, nginx, etc.).
- SPA: crawlers see per-route titles only after JS executes; consider prerendering `/`, `/terms`, `/privacy`.
