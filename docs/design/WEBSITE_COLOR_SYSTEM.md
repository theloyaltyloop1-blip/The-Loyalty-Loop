# Website colour system — 9 October 2026

The owner requested both linked palette sources installed and applied across the website. The implementation uses their palette scales, semantic roles, theme separation and contrast-checking guidance. It preserves the orange/olive consumer identity and the recently approved blue admin identity. These colour refinements are Codex implementation choices, not a newly selected product-owner palette.

## Installation and provenance

- [claude-skills-hub colour palette](https://github.com/ShadmanSakibRahman/claude-skills-hub/blob/b90edd9c9bea064ea47a3b5a5364af9742816414/skills/creative-design/color-palette.md): pinned source installed as `color-palette`, with a required skill name added to its frontmatter. Project copies in `.agents/skills` and `.claude/skills`; also installed in the user's Codex skill directory.
- [UI Color Palette](https://github.com/a-ng-d/claude-ui-color-palette): inspected source at `498c0a932cae1137847b90fd54602d2766234941`, plugin version 1.0.6. Five core standalone skills installed via the official skill installer in `.agents/skills` and copied into `.claude/skills`: scale-palette, build-color-system, audit-palette, generate-code, generate-semantic-code (all prefixed `ui-color-palette-`). Full source retained in `tools/claude-ui-color-palette`.
- Standalone skills are available on the next turn/session. No marketplace or full plugin registration was completed. Automatic approval review rejected the separate Yelbolt marketplace due to marketplace commands and persistent MCP/network configuration. Full plugin activation requires owner approval of those additional effects.
- The external UI Color Palette MCP is absent from this Codex session. This is a local deterministic implementation of the guidance, **not** output from `get_palette`, `get_color_system`, `generate_code` or an APCA audit. Design-tool synchronization and publishing were not performed.

## Source of truth and coverage

Edit `scripts/build-website-palette.py`, then run it to regenerate:

- `apps/web/src/color-system.css`: 88 primitive shades (50–950) in eight families; semantic light, dark and admin roles.
- `docs/design/website-palette.json`: HEX/RGB/HSL exports and resolved semantic themes.
- `docs/design/website-palette.html`: portable visual reference.

`index.css` imports the colour system. Existing semantic utilities automatically apply it across public, auth, shopper, owner, brand workspace and admin routes, including dialogs, cards, menus and fields. Landing-specific fields and shopper wallet literals now reference semantic roles; admin surfaces, tools, tables and five chart colours use the same system. Owner verification statuses use explicit semantic foreground/background pairs. Shared toast colours and secondary button hover variables are corrected.

Use `primary` with `primary-foreground` for actions; `sage/peach/olive/amber/orange` with the corresponding `*-ink` for brand fields. Use `success`, `warning`, `info` and `destructive` with their `*-subtle` backgrounds for status messages, or matching `*-foreground` for filled controls. Include labels/icons: colour must not be the only status signal. Charts retain category labels and numeric values. Admin remains intentionally light under the global dark theme, using scoped tokens.

Avoid white text on the consumer dark primary, which is light peach. Avoid concatenating alpha hex suffixes onto CSS variable strings; wallet progress tracks now use `color-mix`. Use `--color-*` variables for shared components, not undefined unprefixed variables.

Intentional exceptions: merchant-selected colours and colour-picker options, provider logos, photography overlays, Google Maps image URL colours, illustration artwork, print posters/QR code and existing video assets retain their purpose-specific colours. Native apps were not changed. Arbitrary merchant colours, photo backgrounds, transparency and embedded artwork are not guaranteed by the semantic token audit.

## Verification

| Check | Result |
| --- | --- |
| `npm run build` in `apps/web` | TypeScript + Vite passed; existing vendor-size warning |
| `npx --no-install oxlint src` in `apps/web` | Exit 0; existing warnings |
| `python scripts/audit-website-palette.py` | 129/129 supported pairings pass |
| Chrome production-bundle smoke | 16 public route/theme/viewport checks; no overflow or page errors |
| Admin CSS under dark mode | Blue/white action and white fields confirmed using actual built CSS |
| Screenshot inspection | Desktop dark landing and phone light login inspected; further captures saved |

The local audit requires >=4.5:1 for supported normal text, action, semantic status and brand ink pairs; >=3:1 for focus, input borders and chart marks. Evidence: `website-palette-contrast.json`. This is a colour-pair contract audit, not an exhaustive accessibility certification or APCA result.

Browser test: `scripts/check-website-palette.cjs <bundled-node-modules-path>`, using bundled Playwright/Chrome and its own localhost static server. It blocks remote traffic and exercises landing, login, signup and forgot-password at 1440px/390px in both themes. Reduced-motion capture avoids misleading initial entrance states. Results/screenshots are in `palette-browser/`. Admin is an isolated CSS fixture, **not** signed-in admin data.

Recorded failures: initial protected skill writes/network denied then succeeded under scoped escalation; full plugin registration auto-review blocked; root `npm run build` had no script; unscoped lint scanned vendor dependencies and was interrupted; separate sandbox/server browser access denied/timed out; admin hex-case assertion was corrected before passing rerun. None is claimed as a passed check.

Signed-in shopper/owner/admin visual checks and merchant-colour/photo combinations remain unverified. No commit, push, backend change, native release or deployment occurred. Merge these bounded website changes onto the current production baseline before a separately authorized release; preserve existing Sentry, WhatsApp and other contributors' changes.
