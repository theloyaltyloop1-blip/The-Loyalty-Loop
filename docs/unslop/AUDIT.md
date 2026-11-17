# Website unslop audit (apps/web), 2026-11-17

Method: the `unslop` skill by Damir Sokolovsky (@heydamir, CC BY 4.0), run under the Fable 5.2 playbook.
Base: `origin/main` 9aa527a. Screens were rendered locally with made-up sample data
(a mocked database in the browser; nothing touched production). "Before" screenshots: `docs/unslop/before/`.

The owner's standing decisions win over the skill where they differ:
the chosen palette and typefaces stay, owner dashboard tiles keep their colours and bold borders,
Whirl stays, the logo is never restyled, and the admin panel is left alone (its new dark look
from 16 Nov is waiting for the owner's verdict).

## Direction

- **Product.** Digital loyalty cards that independent neighbourhood shops give their regulars: shoppers keep every card in one place, owners record visits and see who comes back.
- **Character.** Warm, neighbourly, exact.
- **World.** The high-street counter: paper stamp cards, receipts, a shop window in the afternoon. Already expressed by the chosen brand: warm paper #F4F1EA, near-black #0E0E0F, stone #E7E2D8, sapphire #0042AC on the main action, Inter with an Instrument Serif italic accent.
- **Moments.** The stamp card (landing hero stack, the play-along demo, the shopper's card on a shop page) and, for owners, the coloured stat tiles with the AI summary card.
- **Signature.** The stamp row: filled and empty circles counting towards a reward, used wherever progress is shown, and nowhere as decoration.

## Verdict per area

| Area | Verdict | Why |
| --- | --- | --- |
| Landing | Light slop | Deliberate premium brand. Slop is in the labels and the gimmick motion layered on top. |
| Sign up / log in | Light slop | Greeting headline, a few craft details. |
| Shopper pages (home, map, shop, rewards, favourites, profile, news) | Light slop | Designed; hover lifts, uppercase kicker, glyphs used as icons, heavy weights in one component. |
| Owner pages | Light slop | Colour is the owner's choice and stays. Slop is uppercase tracked labels, sparkle-for-AI, a bouncing icon, a few motion details. |
| Shared components | Light slop | `transition-all` in three primitives, tight tracking on every heading size. |
| Help, 404 | Light slop / none | Clean. Small copy and spacing points only. |
| Admin panel | Left alone | Rebuilt 16 Nov (9aa527a), owner's verdict pending. |

## Signs found

### Shared foundations
- `index.css`: every heading h1 to h6 gets `letter-spacing: -0.035em`, so 14 to 18 px card titles have negative tracking (small text must be 0).
- `ui/badge.tsx`, `ui/switch.tsx`, `ui/tabs.tsx`: `transition-all`.
- `ui/dropdown-menu.tsx`: shortcut text `tracking-widest`.
- `owner-command-palette.tsx`: group labels uppercase, 11 px, tracked.
- `owner-layout.tsx`: sidebar group labels (Daily, Grow, Manage) uppercase, 11 px, tracked.

### Landing (`pages/Landing.tsx`, `pages/landing.css`, `components/poster-fx.*`)
- Uppercase tracked labels: top frame row, footer frame row, "For shop owners" and "Try it" kickers, "Scroll" cue, shop names on the hero cards, "Record a visit" label.
- Preloader: a full-screen counter (000 to 100) hides the page for about 2.4 s on the first visit of each session.
- Page wipe: a 1 s full-screen curtain on every change between public pages (landing, help, sign-up, log-in).
- Magnetic buttons: the main buttons slide up to about 20 px towards the mouse (the skill's limit is a few pixels).
- Context cursor: a dot chases the mouse in a `requestAnimationFrame` loop that never stops while the page is open.
- Hero parallax: the card stack moves with scroll.
- Reveal: every block rises 28 px over 1.2 s; tokens say 6 to 12 px over 300 to 500 ms.
- Sideways "how it works" panels pinned for 320 vh of scrolling: an elements-move-on-scroll sign, but it is the page's one signature moment from the owner's premium pass. **Left in place, owner to decide.**

### Sign up / log in (`components/auth-layout.tsx`, `pages/Login.tsx`)
- "Welcome back" greeting as the log-in headline.
- Arbitrary values on the decorative cards (`rounded-[20px]`, custom shadow).

### Shopper pages
- `home-collection.tsx`, `shop-card.tsx`, `store-badges.tsx`: cards lift (`hover:-translate-y`) and cover photos zoom (`hover:scale`) on hover.
- `shop-profile.tsx`: `font-extrabold` on eleven labels, uppercase tracked "How it works" kicker, `✓` glyphs as list icons.
- `ShopDetail.tsx`: `★` glyph as the rating icon; logo tile clipped by the cover (to check).
- `Rewards.tsx`, `Profile.tsx`, `ShopDetail.tsx`: codes in mono with wide tracking (kept: tracking helps people read a code aloud at the till).

### Owner pages
- `Analytics.tsx`, `Customers.tsx`: uppercase tracked labels on section heads and stat tiles ("CUSTOMERS", "NEW MEMBERS", "CUSTOMER HEALTH", "BACK THIS MONTH").
- `programme-builder.tsx`, `Onboarding.tsx`: uppercase tracked 11 px labels.
- Sparkle icon for anything AI: Analytics summary card, Reviews ("AI replies", "Write with AI", "AI is writing"), programme builder, Onboarding, Tutorial.
- `Customers.tsx`: win-back heart icon bounces on hover (`animate-bounce`).
- `Reviews.tsx`: pulsing sparkle while AI writes.
- `Onboarding.tsx`: step dots animate `width` with `transition-all`.
- `Settings.tsx`: "Saved ✓" glyph in three save buttons.
- `owner-walkthrough.tsx`: `font-extrabold` tip text.
- `Scan.tsx`: manual-code placeholder inherits the wide code tracking.

### Not slop (kept on purpose)
- Instrument Serif italic accents on the landing: chosen brand.
- Coloured owner tiles, the peach (lime) AI card, the sapphire sidebar, lime active nav: owner's choice (15 Nov "boring" feedback).
- Emoji in the stamp-icon picker (`Settings.tsx`): shop owners pick their stamp, it is content.
- The printable QR poster's uppercase kicker: print typography on a poster.
- Whirl loaders and moments.
- Skeleton pulses while loading: they mean "loading".

## Claims I could not verify (left as they are)

| Claim | Where |
| --- | --- |
| "The Loyalty Loop is free for shoppers" | Landing FAQ, Landing closing row ("Free for shoppers") |
| "Yes, completely free, with no ads, and we don't sell your data" | Help, "Is it free?" |
| "Nothing. The Loyalty Loop for Business is free to use, with no subscriptions or in-app purchases" | Help, "How much does it cost?" |
| "you're live to nearby shoppers in minutes" | Help, "How do I set my shop up?" |
| "We're a real person away" | Help header |
| "Est. 2026" | Landing top frame row |
| "Twenty seconds on how a shop records a purchase" (the video is described as 21 s in its label) | Landing film section |

## Coordination
The "Fable 5.2 skills and site audit" session is running read-only auditors for the website and both apps.
Its website findings will be folded in below when they arrive. This session is the only writer under `apps/web`.

## Findings from the "Fable 5.2 skills and site audit" session (folded in 2026-11-17)

Full report: shared notes folder, `website-audit-from-fable-session.md`. Status of each item after this session:

| # | Finding | Status |
| --- | --- | --- |
| 1 | Signed-out map shows personal tabs and "Sign out" | Fixed (`dashboard-layout.tsx`): Map tab plus Log in and Sign up |
| 2 | Auth, Help, 404 on the old blue-navy system | Fixed: `.surface-paper` tokens in `color-system.css` (home page palette, light and dark) |
| 3 | Logo shown black/white by filters on the home page | **Owner decision**, untouched |
| 4 | Home-page videos show a retired look | **Owner decision**, untouched |
| 5 | "View shop" signed out ends on a bare login | Fixed for log-in (`?next=` limited to shop pages). Sign-up and Google/Apple do not carry it yet |
| 6 | Uppercase tracked labels | Fixed in 74754dc |
| 7 | White text on shop colours | Fixed with `onBrandColor` (Rewards, Activity, Discover, News, Announcements) |
| 8 | Map error state and button contrast | Fixed: error with Try again; light button on the navy panel |
| 9 | Motion overload | Preloader, curtain, cursor, magnetic and parallax removed in 74754dc; sideways panels kept for the owner |
| 10 | Faded text forced to black | **Owner decision**, untouched |
| 11 | Owner pages jump on load | Not done |
| 12 | Copy drift | "Retailer" → "Sign up your shop"; Help paper-card answer matches the home page; FAQ numerals removed; arrow and sparkle done. Fidel paragraph (privacy text) and raw server errors left |
| 13 | Dead weight | Rubik import removed. Unused CSS, old design-system doc and palette names left |
| 14 | Dark-mode flash | Fixed: theme applied before first paint in `index.html`; theme-color values match the surfaces |
| 15 | No phone menu on the home page | Not done |
| 16 | Hover lift | Fixed in 74754dc |
| 17 | Cookie banner storage | Fixed: read and write guarded |
| 18 | Admin text contrast | Admin out of scope, reported only |
