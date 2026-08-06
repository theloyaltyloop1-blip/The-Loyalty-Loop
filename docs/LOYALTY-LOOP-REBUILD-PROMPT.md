# The Loyalty Loop — Rebuild Prompt

Paste this into whatever AI builder or coding agent you're using to start
the rebuild (Lovable, Claude Code, etc.). It references three companion
files that should be uploaded/attached alongside it:

- `LOYALTY-LOOP-FEATURE-LIST.md` — every feature, in build order, as a
  checklist (also split into one file per section in `features/`, if you'd
  rather hand off one milestone at a time)
- `LOYALTY-LOOP-DATA-MODEL.md` — the exact database schema, RLS policies,
  triggers, and RPCs to recreate in a **new** Supabase project
- `LOYALTY-LOOP-DESIGN-SYSTEM.md` — colors, fonts, shape language

---

## The prompt

> I'm rebuilding an existing, working product from scratch for a cleaner
> codebase — not designing something new. The product, every feature, the
> full database schema, and the visual identity are already fully specified
> in three attached documents (`LOYALTY-LOOP-FEATURE-LIST.md`,
> `LOYALTY-LOOP-DATA-MODEL.md`, `LOYALTY-LOOP-DESIGN-SYSTEM.md`). Don't
> invent product decisions that are already answered in those files — follow
> them exactly. Where something genuinely isn't specified, ask me rather
> than guessing.
>
> **What this is**: "The Loyalty Loop" — a neighbourhood digital loyalty-card
> platform. Local independent shops (cafés, salons, barbers, bakeries) run
> digital stamp/points/tier loyalty cards; customers collect stamps on their
> phone and redeem rewards; shop owners get a dashboard, staff accounts, and
> basic marketing tools (targeted promos, win-back emails). Three client
> surfaces, one shared backend:
> 1. A consumer-facing web + owner/staff dashboard (single web app, role-gated
>    routes)
> 2. A retailer/owner mobile app (Expo/React Native)
> 3. A consumer mobile app (Expo/React Native, separate codebase from #2)
>
> **Backend**: a **new** Supabase project (Postgres + Auth + Storage + Edge
> Functions) — recreate the exact schema, RLS policies, triggers, and RPCs
> from `LOYALTY-LOOP-DATA-MODEL.md`. That document is not a rough guide, it's
> the real production schema exported directly from the live database,
> including the actual business logic (the stamp/reward trigger is
> genuinely non-trivial — tiered catalog rewards with cycle resets, not a
> simple counter). Implement it faithfully, including the RLS patterns (every
> table locked down by real ownership/role checks, never left open), the
> "customers can only touch `promos_opted_out`" trigger lock on `memberships`,
> and the "ledger is append-only, balances are derived" pattern on
> `transactions`/`memberships`.
>
> **Frontend stack** (match what's already proven to work, unless you have a
> specific reason to deviate — ask first): React + Vite + TypeScript +
> Tailwind + shadcn/ui + React Query + React Router for the web app; Expo +
> expo-router + NativeWind for both mobile apps.
>
> **Build order — this matters.** I'm implementing and testing one feature
> at a time, not all at once. Work through `LOYALTY-LOOP-FEATURE-LIST.md`
> roughly in the order it's written:
> 1. Foundations + Auth (§0–1) — get sign-up/login/roles working and
>    verifiable before anything else.
> 2. The core consumer loop (§2) — join a shop, get stamped, earn and redeem
>    a reward. This is the entire value proposition; get this fully working
>    and tested before building anything downstream of it.
> 3. Owner shop setup and dashboard (§3).
> 4. Staff accounts (§4).
> 5. Brands/franchises (§5) — this is genuinely more complex than it sounds,
>    build it last among the "core" features.
> 6. Admin panel (§6).
> 7. AI features (§7) — nice-to-have, not launch-blocking.
> 8. Apply the design system (§8) throughout, not as an afterthought bolted
>    on at the end.
> 9. Platform/infra features (§9) and legal/compliance (§10) before any real
>    launch.
> 10. **Security checklist (§11) is not optional and not last** — apply the
>     "must carry forward" items (RLS everywhere, hashed PINs, restricted
>     storage buckets, rate limiting, no client-shipped API keys, real secret
>     management, security headers, CAPTCHA on auth forms) *as you build each
>     feature*, not as a retrofit. Also fix the two real gaps called out
>     there (no error boundary in either mobile app; unverified Android Maps
>     API key restriction) from the start — don't reintroduce them.
>
> After each numbered section, stop and let me test before continuing to the
> next. Don't build ahead of what I've confirmed works.
>
> **Visual identity**: follow `LOYALTY-LOOP-DESIGN-SYSTEM.md` exactly —
> specific hex values, specific fonts, the "chunky sticker" shadow/border
> language, not a generic default component-library look. Keep the color
> tokens defined once and shared consistently across all three client apps
> (the original build let the mobile apps and web drift to different font
> pairings — don't repeat that).
>
> **What I'm deliberately starting fresh on**: a brand-new Supabase project
> with no live data — every current user/business will need to re-register.
> The current production app stays running untouched throughout as a working
> reference I can compare against and a live fallback if the rebuild takes a
> while.

---

## Notes for you (not part of the pasted prompt above)

- If the AI builder you're using can only take one file at a time, paste the
  prompt above first, then paste the contents of the three companion docs
  in order (feature list → data model → design system) as follow-up
  messages before starting.
- The `features/` subfolder has 12 small files (`00-` through `11-`), one
  per milestone in the feature list — hand off one at a time to whatever
  you're using to build, and don't let it "helpfully" jump ahead to the next
  one. That's exactly how the original codebase accumulated bugs that were
  hard to isolate.
- When something breaks during the rebuild, the **old app's actual code is
  still sitting on disk and still running in production** — you can always
  go look at exactly how the original handled the same screen/flow, since
  the documents describe *what* it does but not always *every* line of
  *how*.
