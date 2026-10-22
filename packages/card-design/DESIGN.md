---
name: Loyalty Loop In-app Cards
description: Fixed card compositions with each shop's material, type and progress character.
colors:
  forest: "#234C40"
  sage: "#9ABBA3"
  roast: "#3B2A20"
  copper: "#CE925B"
  barber-black: "#121212"
  barber-gold: "#D3AC24"
  paper: "#F7ECD8"
  bakery-orange: "#C26912"
  gym-navy: "#0C1C2A"
  gym-orange: "#FF6927"
  cream-ink: "#F4E9D7"
  brown-ink: "#633719"
  control-ink: "#1C2620"
  control-copy: "#35443D"
  control-border: "#AAB5AE"
  white: "#FFFFFF"
  black: "#000000"
typography:
  title:
    fontFamily: "BricolageGrotesque_700Bold"
    fontSize: "30px"
  card-name:
    fontSize: "28px"
    lineHeight: "34px"
  progress:
    fontSize: "18px"
    lineHeight: "25px"
  reward:
    fontSize: "14px"
    lineHeight: "20px"
  body:
    fontSize: "15px"
    lineHeight: "22px"
  label:
    fontSize: "16px"
    fontWeight: 700
rounded:
  card: "24px"
  chip: "22px"
  input: "12px"
  template: "14px"
  save: "25px"
spacing:
  choice-gap: "8px"
  field-gap: "10px"
  control-padding: "12px"
  section-gap: "16px"
  compact-padding: "20px"
  card-padding: "24px"
components:
  save-button:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.save}"
    height: "50px"
  selected-choice:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.chip}"
    padding: "12px 16px"
  colour-input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.input}"
    padding: "12px"
---

# Design System: Loyalty Loop In-app Cards

## Overview

**Creative North Star: "Walking into your shop"**

This local system describes `model.ts`, `LoyaltyCard.tsx` and the retailer's `CardDesigner.tsx`. The user reference supplies four shop worlds: concentric roast café, black-and-gold barber pinstripe, fine-paper bakery and navy-and-orange gym. The build expresses them through curated templates and fixed compositions. This document applies to the card package and its editor, not the apps' wider visual identity.

**Key Characteristics:**
- Material patterns rendered as SVG beneath readable progress and reward text.
- Shop-specific palettes and curated type choices within a consistent rounded card.
- Shared live preview and customer renderer; reward semantics stay independent of appearance.

## Colors

### Primary
- Forest selects controls and fills the save button; sage is the default secondary card colour.

### Secondary
- Roast/copper, barber-black/barber-gold, paper/bakery-orange and gym-navy/gym-orange are paired template colours. The secondary colour also drives progress fills and stamp outlines when its contrast permits.

### Neutral
- Cream ink and brown ink provide warm card text. Black or white is the fallback. Control ink, control copy, control border and white belong to the editor.

**The Readable Ink Rule.** `cardInk` accepts warm ink only at a contrast ratio of at least 4.5 against the base colour; otherwise it selects black or white. `cardAccent` requires at least 3 against the base colour, otherwise it also falls back. Photo and gradient text use opaque base-colour backplates. Other materials remain continuous; their decorative opacity is bounded against both light and dark line extremes to preserve base ink contrast. Photo and gradient headings add padded panels; photo and gradient content add padded panels. Bar tracks use foreground ink at 16% opacity, with the accent reserved for the fill.

## Typography

The shared bundled modern face is Bricolage Grotesque Bold; the editor title uses it upright and modern card names use italic styling. The shared `fonts.ts` registry maps `CardClassic` to Cardo-Italic.ttf, `CardHandwritten` to PatrickHand-Regular.ttf and `CardRetro` to Anton-Regular.ttf under `fonts/`. Both apps load this registry through `useFonts`. Retro names are uppercase with (2px) tracking. No platform-specific system display mapping is part of this system. Native rendering and font-loading behavior still require device acceptance.

Names use the card-name token and stop at two lines. Names, progress counts and ordinary rewards multiply their base sizes and line heights by `scale = min(1.7, max(1, cardWidth / 640))`. Ring numbers remain (21px); ring/jar labels remain (20px/28px). Handwritten rewards use (18px) with the scaled reward line height. Editor labels use the label token; choice labels are (15px), colour inputs and save text (16px).

## Layout

Cards use fixed header/content ordering and selectable grid, row, ring, jar or bar compositions. Left/centre/right positioning aligns the header group, including the logo. Card padding and radius use the frontmatter tokens, with a (30px) header/content gap. Compact cards use compact padding and a (22px) gap. Normal minimum height is the larger of (240px) and 34% of measured width; compact minimum height is (240px).

Grid stamps wrap at (34px × scale) diameter and (9px) gaps. Row stamps resize between (22px) and (38px × scale), keeping (6px) gaps; horizontal scrolling preserves overflow for large targets. Visible slots cap at 20. Ring and jar share horizontal icon/label compositions with (18px) separation. Progress is clamped to its target. The shared `designForProgress` helper converts grid/row to ring for continuous programmes in both editor and renderer; their available controls are ring, jar and bar.

Editor choices wrap with the choice-gap token; colour fields grow with a minimum width of (120px). Controls have minimum tap heights of (44px), with the save button at (50px). There are no package-specific breakpoint thresholds.

## Elevation & Depth

Cards and controls have no shadows. Depth comes from material lines, low-opacity tracks and filled progress. Pinstripe uses a (2px) accent border; other cards retain a transparent (1px) border. Material geometry stretches from an SVG (360 × 240) coordinate space.

## Shapes

Rounded cards clip their backgrounds. Stamps have (1.5px) outlines and a corner radius equal to half their measured diameter, preserving circles at every scale. The ring is (96px × scale) across with a (12px) stroke. The progress bar is (14px) high with (7px) rounding. Logos sit in white (38px) squares with (10px) corners. Photo and gradient name panels have (8px) padding and corners; photo content panels have (12px) padding and (16px) corners.

## Components

### Loyalty card

Templates choose material, palette, icon, typography, layout and entrance. Stamp symbols are inline SVG coffee, scissors, paw, donut or star, with shop-logo image support and star fallback after a failed logo. The decorative barber pole appears for pinstripe without a shop logo. Failed background photos reveal the base material; failed header logos disappear.

**The Reward Truth Rule.** Appearance never manufactures visits or changes reward thresholds. Continuous progress uses continuous graphics rather than discrete stamps. Wallet passes keep their provider layouts.

Opening effects are opt-in. Stamp uses scale from .92 to 1; flip rotates from −65° with perspective 900. Both use the same spring, recorded in the sidecar. Coffee adds a fading upward steam detail. Reduced-motion preference skips the effect; enabling it during playback stops the animation and restores the settled state.

### Designer controls

Radio choices use bordered pills, forest fill and white text when selected. Template buttons contain actual miniature `LoyaltyCard` previews: a (310px) compact card scaled to .4 within a clipped (124 × 96px) window with (8px) corners. Colour inputs have a thin control-border stroke. Replay and discard use underlined forest text. Save is disabled at half opacity without changes or while busy; uploads and saves lock editing. Existing source does not specify additional hover or focus decoration.

Photo selection checks JPEG/PNG/WebP, maximum 5 MB, minimum 640 × 360 and maximum 12,000 pixels per dimension. These are file checks; they do not establish content moderation.

## Do's and Don'ts

### Do:
- **Do** reuse the shared renderer for preview and shopper cards.
- **Do** keep measured stamp sizing, readable photo panels and reduced-motion handling.
- **Do** retain the selected shop material and reward semantics when extending a surface.

### Don't:
- **Don't** turn fixed template compositions into a free-position canvas without a new product decision.
- **Don't** infer completed visits, streaks or reward rules from decorative template examples.
- **Don't** extend this package's shop palettes into global app overrides.

Not canonized or repaired: the reference's spinning pole, scissor snip and streak badge are not implemented system rules. Device/native typography, authenticated photo-upload and shopper-refresh acceptance remain unverified in this documentation pass. Product boundaries are recorded in the adjacent PRODUCT.md; this document does not assert deployment or acceptance results.
