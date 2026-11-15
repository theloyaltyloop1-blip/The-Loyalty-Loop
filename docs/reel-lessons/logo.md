# Reel lesson: "using just one logo for your brand is a trap" (Nabi Designs)

Lesson: one detailed lockup shrunk into a favicon, avatar or app icon turns to mush. A brand needs a **logo family**: primary (full detail), secondary (alternate layout), brand mark (stripped-down symbol for tiny and circular spaces).

Status: uncommitted work in worktree `reel-logo-b66eb6`. Nothing committed, pushed, deployed, built or OTA'd.

## 1. Audit (what existed)

The identity today is **one logo**: a detailed olive/orange/rust looped-leaf ring on warm paper (`#F8E4C6`) with a light wordmark, supplied only as raster PNGs (no SVG, no source). The logo's colours are olive/orange/rust; "sapphire" is the UI palette on another branch and is not in this worktree's logo, so the family keeps the logo's own colours.

Wrong-variant / too-detailed-shrunk cases found:

| # | Where | Problem |
|---|---|---|
| 1 | `apps/web/public/favicon.svg` | Still the **Vite starter purple bolt**, not our brand. (`index.html` used the PNG, so it was mostly hidden.) |
| 2 | `apps/web/public/favicon.png` (1024 px) used as favicon and apple-touch icon | Detailed ring with a faint border artefact scaled to 16/32 px; mushy. |
| 3 | `apps/web/src/assets/loyalty-loop-mark.png` rendered at 28-32 px in headers (`auth-layout`, `dashboard-layout`, `owner-layout`, `LoopMark` on Landing/Help) | Detailed 8-shape mark shrunk to 28-32 px; soft raster. |
| 4 | `og:image`, `twitter:image`, JSON-LD `logo`, `DEFAULT_OG_IMAGE` all = `logo-for-emails.png` (1005x624) | Not a 1.91:1 share image; JSON-LD logo should be square. |
| 5 | `supabase/functions/create-wallet-pass/index.ts:197` `platformLogoUri` = `logo-for-emails.png` | The function's own comment says Google Wallet needs a square (>= 660 px) logo; this is the wide lockup. |
| 6 | `apps/shopper/App.tsx` `headerLogo` (32x32), `markImage` (46x46), `onboardingLogo` (66x66), all `resizeMode: contain` on `loyalty-loop-logo.png` (1005x624 **full lockup**) | Whole wordmark lockup squeezed into a 32-66 px box; text unreadable and the mark ends up ~20 px. |
| 7 | `apps/shopper/assets/icon.png`, `apps/retailer/assets/icon.png`, Android adaptive foreground (= `icon.png`), splash | Detailed mark at ~60% of canvas; the adaptive foreground is the full opaque icon (cropped by masks); the retailer icon **lacks the orange leaves** so the two apps' icons differ. |
| 8 | Emails (`send-visit-thank-you`, `send-winback-emails`) | Primary lockup at 160 px is the right variant. But the URL is `/logo-for-emails` **without `.png`**; relies on Vercel resolving it. Not tested, left alone. |
| 9 | `packages/card-design` | **Does not exist** in this branch (only `packages/design-tokens`). Nothing to audit; wallet logo is #5. |
| 10 | Retailer app in-app header | No platform logo used in-app (only business logos). Admin app reuses the shopper icon. Nothing to fix. |

## 2. Logo family created (`brand/`)

- Primary: `loyalty-loop-primary-{colour,reversed,dark,white}.svg` (stacked, detailed mark with orange leaves, wordmark outlined to paths). Same layout as today's logo.
- Secondary: `loyalty-loop-secondary-*.svg` (horizontal, simplified mark + wordmark) for headers and narrow banners.
- Brand mark: `loyalty-loop-mark-*.svg` (four-blade loop with diamond core, bolder than the original so it survives 16 px).
- `app-icon/`: `app-icon-paper.svg`, `app-icon-dark.svg`, `android-foreground.svg` (transparent, inside the 66% safe zone), `android-monochrome.svg`, `favicon.svg`.
- `png/`: 1024 app icons, Android foreground/monochrome, splash, favicons 16/32/48/64, apple-touch 180, OG 1200x630, wallet logo 1024, in-app mark 512.
- `src/build.py` (generates the SVGs), `src/render.py` (PNGs via headless Chrome), `README.md` (usage rules).

The simplified mark is my redrawing (procedural crescents), not a trace: same rotating four-part loop and the same sampled palette (`#5E6839`, `#CF7A37`, `#AA521E`), but the original's tear-drops and exact leaf shapes are dropped on purpose. **The owner should approve it before it goes on store icons.** The wordmark uses Bricolage Grotesque SemiBold (the design-token display font) instead of the original light Raleway-style face; confirm with the owner.

## 3. Applied in code (no native rebuild needed)

- Web: `favicon.svg` replaced with the brand mark; new `favicon-48.png`, `apple-touch-icon.png` (180, paper tile); `index.html` icon links updated.
- Web: new `og-image.png` (1200x630, primary lockup) used by `index.html` og/twitter tags and `DEFAULT_OG_IMAGE` in `use-page-meta.ts`.
- Web: new square `logo-mark.png` used for JSON-LD `logo`.
- Web headers: new `src/assets/loyalty-loop-mark.svg`; imports switched from `.png` to `.svg` in `auth-layout`, `dashboard-layout`, `owner-layout`, `loop-mark`, `Onboarding`, `Tools`. Old PNGs left in place.
- Shopper `App.tsx`: header, mark and onboarding images now use the new square `assets/brand/loyalty-loop-mark.png` instead of the wide lockup. JS plus asset only, so it can ship by **OTA** (`eas update --environment production`, per platform).
- `create-wallet-pass/index.ts`: platform fallback logo now `logo-mark.png`. **Needs an edge-function deploy**, and `logo-mark.png` must be live on Vercel first.

## 4. Needs a native build (assets prepared, NOT swapped)

Swap at the next planned build: `apps/shopper/assets/icon.png` and `apps/retailer/assets/icon.png` <- `brand/png/app-icon-1024.png` (also unifies the two icons); `android-icon-foreground.png` and `android-icon-monochrome.png` <- `brand/png/android-icon-*.png`; `splash-icon.png` <- `brand/png/splash-icon.png`; point the adaptive icon `foregroundImage` at the transparent foreground (it currently uses `icon.png`). The notification small icon also uses `android-icon-monochrome.png`, so it changes with a build. App Store / Play listing icons are separate uploads. The retailer and shopper apps would then share an icon; add a tint or badge if they must stay distinguishable.

## 5. Legibility check

Method: `brand/src/legibility.html` rendered with headless Chrome at device scale 1 (real 16, 32 and 64 px) comparing the old full lockup, old mark, new mark in colour, reversed on `#121714`, and one-colour dark on white, then enlarged 4x with nearest-neighbour. Result: `brand/legibility-16-32-64.png`.

Observed: the old lockup's text is unreadable at 32 px and gone at 16 px; the old mark at 16 px is a speckled ring; the new mark keeps four distinct blades and the diamond core at 16 px, and the reversed and one-colour versions hold too. This is a by-eye check in one rendering engine, not a user test, and not seen on real devices.

## 6. Untested / open

- No `npm install`, `tsc` or Vite build or browser run (no node_modules in this worktree). The `.svg` import swap relies on Vite's `vite/client` types; please run `npm run build` in `apps/web`.
- Not viewed on a phone; the shopper header with the new mark has not been run.
- Dark-mode web headers still use the colour mark (olive on dark is low contrast). The `reversed` SVG exists but is not wired to the theme.
- Emails still use `/logo-for-emails` (no extension) and the wide PNG; unchanged.
- iOS `.pkpass` artwork is not in the code paths found here; only the Google Wallet fallback logo was addressed.
- Git shows many web component files as modified purely from line-ending normalisation (`git diff --stat` lists 11 real changes); worth a look before committing.
- Next: owner approves the mark; then native build swap (section 4), edge-function deploy, OTA for the shopper header.
