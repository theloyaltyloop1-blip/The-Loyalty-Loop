# Loyalty Loop logo family

Derived from the existing logo (colours sampled from `apps/web/public/logo-for-emails.png`; wordmark set in Bricolage Grotesque SemiBold, the design-token display font, outlined to paths so no font install is needed).

| Role | File pattern | Use for |
|---|---|---|
| **Primary** (stacked, detailed mark with orange leaves) | `loyalty-loop-primary-*.svg` | website hero/footer, signage, packaging, OG image, posters (>= 120 px mark) |
| **Secondary** (horizontal, simplified mark) | `loyalty-loop-secondary-*.svg` | headers, emails, narrow banners, app headers with room for text (>= 24 px tall) |
| **Brand mark** (simplified four-blade loop) | `loyalty-loop-mark-*.svg`, `app-icon/*` | favicon, app icon, splash, wallet logo, circular profile images, anything < 64 px |

Variants: `colour` (on paper `#F8E4C6` or white), `reversed` (on `#121714`/dark), `dark` (one colour `#1C2620`), `white` (one colour, for photos/stamps).

`png/` holds rasters for stores/OG; regenerate with `python brand/src/build.py <BricolageGrotesque_600SemiBold.ttf>` then `python brand/src/render.py` (needs fonttools, Pillow not required, headless Chrome). `legibility-16-32-64.png` is the size test.
