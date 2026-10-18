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

## Pass 2 – deeper testing

### Supabase security advisors (project tgukdabfvvoywawmzbdo)
- `rls_enabled_no_policy` (INFO, 25 tables): RLS on and no policies, so access is deny-by-default. These are internal or log tables, so this is OK.
- `anon_security_definer_function_executable` (WARN, 2): `deliver_shop_announcement()`, `notify_reward_redeemed()` are trigger functions exposed via RPC → **fixed in `supabase/migrations/0026_revoke_trigger_fn_execute.sql`** (file only, not yet applied to prod).
- `authenticated_security_definer_function_executable` (WARN, 62): every function was checked for an auth guard. All mutating/admin functions call `admin_assert()`, `has_role`, or check `auth.uid()` ownership. Helpers (`has_role`, `is_active_staff_of`, `staff_has_permission`, `spend_next_tier`, `card_linked_business_ids`) are read-only boolean/lookup helpers; minor info-disclosure only.
- `auth_leaked_password_protection` (WARN): **enable in Dashboard → Auth → Password security** (manual).
- Storage: `owner_verification_docs` is private, with owner-folder/admin read policies. Public buckets (logos/covers/gallery) only allow image MIME types up to 5 MB, and owners can only write into their own business folder. OK.

### CRITICAL – membership balance forgery (fixed in migration, not yet applied)
- `memberships_insert_self` only checks `user_id = auth.uid()`, and `authenticated` has INSERT on `stamp_count`, `points_balance`, `visit_count`, `reward_progress_pence`, `current_tier`. The `enforce_membership_update_scope` trigger only covers UPDATE.
- **Proof** (transaction forced to roll back, prod unchanged): as a customer, `insert into memberships(user_id,business_id,stamp_count,points_balance,visit_count) values (me, shop, 999, 99999, 500)` → **succeeded, stamp_count=999 points=99999**.
- **Fix:** `supabase/migrations/0027_membership_insert_balance_guard.sql`, a BEFORE INSERT trigger that resets every balance/progress column when `current_user` is `authenticated`/`anon` (direct API). SECURITY DEFINER RPCs and service-role paths are unaffected. The app's own insert (`upsert {user_id,business_id}`) is unaffected.
- **Re-test with fix** (rolled back): same insert → `stamp_count=0 points=0 visits=0`. Verified afterwards that no trigger/function persisted.
- Other INSERT/UPDATE policies were reviewed (rewards, transactions, notifications, reviews, review_replies, support_requests, reward_catalog, etc.). All are scoped to self, owner, staff permission, or admin. Minor: `reviews_update_author_or_admin` lets authors edit any column of their own review.

### HIGH – self-verified / self-trending shops on insert (migration 0029, not yet applied)
- `businesses_insert_self_owner` only checks owner and role. `enforce_businesses_update_scope` blocks these columns on UPDATE but not on INSERT.
- Proof (rolled back): an owner insert with `trending=true` succeeded. `verification_status='verified'` is the same path and shows the public "verified" badge on `shop-card.tsx`.
- Fix: a BEFORE INSERT trigger resets verification_*, trending/trending_position, approved_at/by and rejection_reason for non-admin API inserts. Rollback re-test: `verification=unverified trending=f pos=NULL`.
- Note: the `approval_status` default is `'approved'` (auto-approve by design). If that default changes to `'pending'`, add `approval_status` to this trigger.

### MEDIUM – profile protected columns (migration 0028, not yet applied)
- `profiles_update_self` + column grants let a user rewrite `email` (the recipient for winback/thank-you emails, so a user could point platform email at any address), `stamp_code` and `referred_by`.
- Fix: a BEFORE UPDATE trigger rejects direct API changes to those 3 columns. Rollback test: name edit succeeded; email change was blocked. The app's profile form only edits first/last name, phone and postcode.
- Referral farming checked: `referrals.referred_id` is unique, so it's not exploitable.

### Edge function bugs fixed
| Function | Issue | Fix |
|---|---|---|
| `send-visit-thank-you` | Staff check queried non-existent column `is_active` (real: `status`), so staff were always rejected | `.eq('status','active')` |
| `send-visit-thank-you` | Owner/staff could email **any** user by passing an arbitrary `user_id` (non-member ⇒ `member` null ⇒ opt-out bypassed) | Require membership; reject otherwise |
| `delete-my-account` | Skipped `can_delete_current_account()` guard; a direct call deleted shop owners (cascade risk) | Server now calls the RPC as the user and refuses if not allowed |

| `send-winback-emails` | Shop name, customer `first_name` and `brand_color` were put into the email HTML without escaping, so a customer could inject HTML into marketing emails sent from the platform | Escape HTML; `brand_color` must be a hex value |
| `business-coach-chat`, `deep-business-report` | No rate limit on paid AI/scrape calls | `check_daily_limit` per user: 60 chats/day, 5 reports/day → HTTP 429 |

(Syntax-checked with the TypeScript compiler: 0 diagnostics. A full `deno check` was blocked because the sandbox couldn't resolve esm.sh imports.)

### Browser test (Chromium, prod headers incl. CSP served locally)
9 routes (`/ /login /signup /signup/owner /terms /privacy /forgot-password /dashboard /owner`): all render, per-route titles correct, manifest served, **0 CSP violations / page errors**. CSP tightened: removed unused `maps.googleapis.com`/`www.google.com` (Maps is only an outbound link; hCaptcha kept for future captcha).

### Performance fixes
- Route-level code splitting (`React.lazy` + `Suspense`); Landing stays eager. Single 705 kB bundle → initial ≈279 kB app + 207 kB supabase + per-route chunks.
- Logo PNG 137 kB → WebP 9 kB.
- Google Fonts moved from CSS `@import` (render-blocking chain) to `<link>` + preconnect.

### Lighthouse (mobile, local server)
| Page | Perf | A11y | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` before | 71 | 92 | 100 | 100 | – | – |
| `/` after | 75 | 92 | 100 | 100 | 4.2 s | 0 |
| `/login` before | 59 | 85 | 100 | 100 | 5.7 s | 0.187 |
| `/login` after | 71 | 85 | 100 | 100 | 5.0 s | 0 |

The remaining a11y failures are brand colours: `#C9622E` links on `#E8ECE2` have 3.3:1 contrast, white on `#E8703B` buttons has 3.1:1, and the cookie-banner button is under the 24px target size. These are design decisions, so I left them unchanged.

- Client: no `dangerouslySetInnerHTML`/`eval`, and no open redirects (password reset uses `window.location.origin`).

## Open items / follow-ups
- Set `VITE_SITE_URL` in prod env; default `https://theloyaltyloop.app` is a placeholder.
- **Apply migrations 0026–0029 ASAP (0027 is critical)** and deploy edited edge functions (`supabase db push`, `supabase functions deploy delete-my-account send-visit-thank-you send-winback-emails business-coach-chat deep-business-report`).
- Edge functions use `Access-Control-Allow-Origin: *`; recommend restricting to the prod origin (risk low since auth is bearer-token).
- CSP allows `'unsafe-inline'` styles (Tailwind/React inline styles). Verify hCaptcha/Maps load in a preview deploy; adjust CSP if Maps embed hosts differ.
- If not deploying on Vercel, port headers to the host (Netlify `_headers`, nginx, etc.).
- SPA: crawlers see per-route titles only after JS executes; consider prerendering `/`, `/terms`, `/privacy`.
