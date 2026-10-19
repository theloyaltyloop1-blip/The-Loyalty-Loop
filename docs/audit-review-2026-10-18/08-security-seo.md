# Audit 08 – Production readiness, SEO & security (2026-10-18)

The first pass ran on a branch cut from an old commit (253 commits behind `main`). That work is kept on
`audit/08-security-seo-stale-base`. This branch was rebuilt on `main` (763fb37) and carries only the fixes
that `main` and production were still missing.

## Already in place on main (verified, no change)
- Root `vercel.json` sets CSP, HSTS (2y, preload), X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy.
- `apps/web/index.html` has a title, description, canonical, OpenGraph, Twitter card and JSON-LD. `public/robots.txt` and `public/sitemap.xml` are present.
- The AI edge functions already have per-minute and daily rate limits.
- `npm audit --omit=dev`: 0 vulnerabilities. Secret scan: none; service-role key only via `Deno.env`.

## Fixed and APPLIED to production (project tgukdabfvvoywawmzbdo)
| Severity | Issue | Fix | Migration / deploy |
|---|---|---|---|
| CRITICAL | Customers could self-insert a membership with any stamp/points/visit/spend-progress values (RLS only checked `user_id`; the guard trigger only covered UPDATE). Proven: insert of 999 stamps / 99,999 points succeeded. | BEFORE INSERT trigger resets balances for direct API inserts | `20261018120704_membership_insert_balance_guard.sql` |
| HIGH | Owners could create a shop with `verification_status='verified'` (public badge) and `trending=true`. Proven. | BEFORE INSERT trigger resets admin-only columns | `20261018120729_business_insert_privileged_columns.sql` |
| MEDIUM | Users could rewrite `profiles.email` (the recipient for platform emails), `stamp_code` and `referred_by` | BEFORE UPDATE trigger rejects direct changes | `20261018120725_profile_protected_columns.sql` |
| LOW | Trigger fns `deliver_shop_announcement`, `notify_reward_redeemed` callable via RPC | Revoke EXECUTE | `20261018120228_revoke_trigger_fn_execute.sql` |
| MEDIUM | `send-visit-thank-you`: owner/staff could email any user id that wasn't a member of their shop | Require membership | Deployed v22 |
| MEDIUM | `send-winback-emails`: shop name, first name and brand colour went into the email HTML unescaped | `escapeHtml` + hex-only colour | Deployed v24 |

**Post-apply verification on prod.** One transaction, forced to roll back: membership insert gave stamps=0 points=0; email change was blocked; trigger RPC was blocked; business insert gave verification=unverified, trending=false.
Every client insert/update path in `apps/web`, `apps/shopper` and `apps/retailer` was checked: they only send `user_id`/`business_id` or editable profile fields. Service-role and SECURITY DEFINER paths run as a different `current_user` and are unaffected.

Notes:
- apply_migration hung on SQL containing `drop trigger if exists`, presumably waiting on a destructive-statement confirmation. The applied versions omit the drop; the repo files keep it.
- The repo's `send-visit-thank-you` had a mis-encoded 📍 emoji, and production had the correct one. Both now use the correct emoji.

## Reviewed, no action
- All 62 SECURITY DEFINER RPCs callable by `authenticated` have admin, role or ownership guards.
- Storage: verification docs bucket is private with owner/admin policies. Public image buckets are MIME- and size-limited, with owner-folder writes only.
- RLS write policies on rewards, transactions, notifications, reviews, review_replies, support_requests and reward_catalog are correctly scoped.

## Open (owner)
- Turn on leaked-password protection: Supabase Dashboard → Auth → Password security.
- Performance advisors (41 auth_rls_initplan, 26 multiple_permissive_policies, 59 unindexed FKs) are low impact at current data size.
- Optionally restrict edge function CORS (`*`) to `https://www.the-loyalty-loop.com`.
