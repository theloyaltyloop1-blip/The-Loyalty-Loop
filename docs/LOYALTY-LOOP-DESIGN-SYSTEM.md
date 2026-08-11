# The Loyalty Loop — Design System

The single source of truth for colors, type, shape, and motion across the web app
(`apps/web`) and the native apps (`apps/shopper`, `apps/retailer`). Values live in
`packages/design-tokens/tokens.ts`; the web app mirrors them in
`apps/web/src/index.css`'s `@theme` block (Tailwind v4 CSS-based config).

## Colors

| Token | Hex | Use |
|---|---|---|
| `background` | `#F7ECDC` | Page background — warm cream |
| `foreground` | `#1a1a1a` | Body text — near-black, never a "true" pure black |
| `card` | `#FBF6EC` | Card/surface background — pale cream |
| `primary` | `#E8703B` | Brand orange — buttons, links, primary actions |
| `primary-hover` | `#C9622E` | Darker orange for hover/active states on primary elements |
| `accent` | `#F6AF23` | Gold — highlights, secondary CTAs, badges |
| `fun-green` | `#3FA34D` | Success states, positive stats, decorative accent |
| `ink` | `#40281C` | Deep brown — dark surfaces (e.g. sidebar text, stamped card art) |
| `destructive` | `#DC2626` | Errors, delete actions |
| `border` | `#ded6c9` | Hairline borders (most UI actually uses `border-black/10` opacity instead) |

This is the palette that's actually live across the app today — it was formalized as the
canonical system in place of two other palettes that had drifted into the codebase
unused (an unused muted-terracotta `@theme`, and an unused "chunky sticker" coral/Baloo 2
system that was drafted but never implemented). Both were retired in favor of this one.

## Typography

- **Display/headings**: Libre Baskerville (serif).
- **Body**: DM Sans.
- Use the same pairing across web and both native apps — do not introduce a second font
  stack for mobile.

## Shape & shadow

- Border radius: components mostly use explicit Tailwind classes (`rounded-lg`,
  `rounded-xl`, `rounded-2xl`) rather than a single fixed radius token.
- Shared `Card`/`Button` primitives (`apps/web/src/components/ui/`) use a soft, subtle
  drop shadow (`shadow-sticker` / `shadow-sticker-lifted` in `@theme`) — not a hard offset
  "sticker" shadow.
- Borders on functional UI are thin (`border-black/10` or the `border` token), not thick.

## Motion

- Easing: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entering/exiting elements;
  `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for elements moving on-screen.
- Buttons get `active:scale-[0.97]` press feedback at `duration-150`.
- Keep all interactive-UI transitions under ~300ms; only marketing/hero moments may run
  longer.

## Cross-platform consistency

`packages/design-tokens/tokens.ts` exports `colors`, `fonts`, `radius`, `shadow`, and
`easing` as plain JS/TS constants (hex strings, not CSS custom properties — React Native
doesn't support those). `apps/shopper` and `apps/retailer` import this package directly
(via npm workspaces) instead of declaring their own local color constants, so the three
apps can't drift out of sync again.
