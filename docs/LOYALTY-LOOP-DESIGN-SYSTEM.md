# The Loyalty Loop — Design System (for rebuild)

Pulled from the live `src/index.css` / `tailwind.config.ts` of the current
web app. This is the current, live palette (already fixed — see the note on
green/violet below).

## Colors

| Token | HSL | Hex (approx) | Use |
|---|---|---|---|
| Background | `30 65% 93%` | `#F9EDE2` | Page background — warm peach cream |
| Foreground | `20 40% 18%` | `#40281C` | Body text — cozy warm brown, never pure black |
| Card | `30 60% 97%` | `#FDF9F5` | Card surfaces — warm ivory |
| Primary | `16 85% 55%` | `#EE5A2C` | Vivid coral-orange — the brand color |
| Primary-glow | `16 90% 65%` | lighter coral | Hover/glow states |
| Secondary | `32 70% 88%` | warm apricot | Secondary surfaces |
| Accent | `40 92% 55%` | `#F6AF23` | Golden-orange — CTAs, highlights |
| Fun-green | `152 55% 42%` | `#30A66F` | Decorative accent — **fixed**; was previously `16 90% 65%`, an accidental near-duplicate of coral |
| Fun-violet | `262 55% 62%` | `#9069D3` | Decorative accent — **fixed**; was previously `32 70% 88%`, an accidental near-duplicate of the tan/secondary tone |
| Destructive | `0 72% 51%` | red | Errors, delete actions |
| Border | `25 40% 82%` | warm tan | Hairline borders |

**Lesson for the rebuild**: when defining a "playful multi-color" palette,
actually check the hue values are spread out (e.g. 0°, 40°, 150°, 260° —
genuinely different families), not just different names with accidentally
similar hues. The bug that prompted the fix above was invisible in code
review (the values *looked* like independent constants) and only became
obvious visually.

## Typography

- **Display/headings**: Baloo 2 — bold, rounded, chunky. Weights 500–800.
- **Body**: Quicksand — rounded, friendly. Weights 400–700. Never use a thin
  weight anywhere.
- Mobile app font stack differs slightly (Bricolage Grotesque for display,
  Outfit for body) — close enough in spirit (bold/rounded display + clean
  body sans) that either is fine to reuse; pick one pairing and use it
  consistently across web + both mobile apps this time (the current split
  is an inconsistency worth fixing).

## Shape & shadow language

- Border radius: `1.25rem` as the default — bubbly, not sharp.
- "Chunky sticker" shadow: a **solid, offset** drop shadow (not blurred) —
  e.g. `3px 3px 0 0 hsl(20 40% 18% / 0.12)` for cards, `6px 6px 0 0 ...`
  for "lifted"/hover states. This is a deliberate flat-illustration look,
  not a soft material-design shadow.
- Borders: thick, 3–4px, in the dark brown foreground color — not the pale
  gray borders a default component library gives you.
- Slight rotation (±0.5–1deg) on cards in decorative/marketing contexts
  (the public homepage) for a hand-placed, energetic feel. Don't rotate
  functional UI (dashboards, forms) — only marketing/showcase surfaces.

## Component patterns

- Buttons: full-height (44px/`h-11` minimum tap target), rounded-full or
  large radius, bold label text, no all-caps unless it's a small tag/badge.
- Small tags/badges: uppercase, black/extra-bold weight, wide letter-spacing,
  pill-shaped, often with a colored background.
- Stat tiles: bordered card, large bold number, small uppercase label below.
- Empty states: friendly copy, not a bare "No data."

## Cross-platform consistency

- Keep the **same** color tokens (as hex, since RN doesn't do CSS custom
  properties) available to both mobile apps and the web app — define them
  once in a shared constants file/package if the rebuild's repo structure
  allows it, rather than re-declaring the palette three times and risking
  drift (which is close to what caused the green/violet bug above).
