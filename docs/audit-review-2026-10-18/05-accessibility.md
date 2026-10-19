# Audit 05 — Accessibility (WCAG 2.1 AA)

Tool: axe-core 4.x via `@axe-core/playwright` + Chromium, tags `wcag2a wcag2aa wcag21a wcag21aa`, against `vite preview` production build. 27 routes.
- Pass 1: unauthenticated (protected routes redirect to `/login`).
- Pass 2: authenticated, Supabase mocked (fake session + REST/RPC stubs) for roles `consumer`, `business_owner`, `admin`, so dashboard/owner/admin pages actually render.
Raw output + scripts: `audit-reports/raw/`.

## Scores (axe violation nodes)
| Scan | Before | After |
|---|---|---|
| Public / unauth (27 routes) | 99 | 0 |
| Auth: business_owner | 18 (first run) → 11 | 0 |
| Auth: consumer | 14 | 0 |
| Auth: admin | 11 | 0 |

## Resolved
- **Contrast (1.4.3)**: brand tokens darkened — primary `#ee5a2c`/`#E8703B`→`#B93D0E`, `#C9622E`→`#A8431A`, link blue→`#1D4ED8`, greys→`#5F5C57`, greens→`#24722B`/`#1a7048`, violet→`#6b46b8`/`#6B3FA0`, `#3B82C4`→`#1D5A94`; low-alpha text (`/35–/65`) raised to `/70–/80`; reds → `red-700/800`; dimmed "unavailable" cards use `grayscale` instead of `opacity-65`.
- **Form labels (1.3.1/4.1.2)**: ~60 unlabelled `input/textarea/select` given `aria-label` (TS-AST script `raw/labels.cjs`, then hand-corrected names; opening-hours inputs labelled per day).
- **Button names (4.1.2)**: delete review/announcement/photo, coach send, favourite toggle (`aria-pressed`), copy code; Profile settings toggles now `role="switch"` + `aria-checked`.
- **SVG images (1.1.1)**: QR codes given `title`.
- **ARIA**: FAQ accordion `aria-expanded`, decorative icons `aria-hidden`, business switcher `aria-expanded/aria-haspopup`, cookie banner `role="dialog"`.
- **Focus visible (2.4.7)**: unlayered global `:focus-visible` 3px outline overriding Tailwind `outline-none`; hover-only photo delete button now visible on focus. Verified: Tab focus shows `solid 3px` outline.
- **Escape (2.1.2/1.4.13)**: Escape closes business switcher dropdown and dismisses cookie banner (essential only). Verified by `raw/keys.mjs`.
- `<img>`: all have `alt` (none missing).

## Limits
- Authenticated pass uses mocked data; data-dependent states (empty/error/modals beyond those listed) partly covered.
- Automated tools catch ~30–40% of WCAG issues; manual screen-reader testing still recommended.
- Brand colour changes alter visual palette — design review advised.
