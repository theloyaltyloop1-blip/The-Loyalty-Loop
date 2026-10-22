# Custom in-app loyalty cards — 22 October 2026

Implemented locally in the shared project root. No migration application, commit, push, OTA or store release was performed.

## What ships

Business app: Shop → Design your card opens the existing branding page with the new live designer. Four templates follow the owner's supplied reference: coffee house, barbershop, bakery and training club. Owners can choose solid/gradient/material/photo backgrounds, two colours, drawn stamp icons or their logo, bundled type styles, grid/row/ring/jar/bar progress, logo position and stamp/flip/no entrance. Controls preserve programme semantics; continuous programmes adapt stamp templates to a ring.

Shopper app: saved designs render on home cards and the shop's loyalty card, retaining the existing plain QR/code surface and reward accounting. Legacy shops with no design keep their existing presentation. RLS-filtered realtime updates and foreground refresh fetch new design data.

Shared package: packages/card-design contains the versioned model, shared renderer, fonts and OFL licenses, tests and PRODUCT/DESIGN documentation. SVG materials and icons are authored code. No new native module or dependency was introduced. Existing expo-font loads the bundled TTFs.

## Persistence and uploads

Migration: supabase/migrations/20261022100247_business_card_design.sql. Adds nullable businesses.card_design, a strict bounded JSON validator, owner/admin update guard and businesses realtime publication membership when the publication exists. Existing businesses RLS remains authoritative. The photo URL must match that business's covers/card-* path. The validator assumes the existing hosted Supabase .supabase.co Storage URL shape, not a custom Storage domain.

Uploads reuse covers and its existing owner path policies and server file size/MIME restrictions. Client checks JPEG/PNG/WebP, actual upload bytes ≤5 MB and picker dimensions 640×360 through 12000×12000. This is a quality/size check, not sharpness detection or content moderation. Unsaved uploads are removed best-effort on discard/unmount/replacement; saved superseded assets may remain until shop Storage cleanup. No new moderation service was configured.

## Verification

- Eight shared model tests pass: malformed/legacy fallback, all templates/material/icon/layout combinations, colour-space text contrast, bounded progress, image constraints, reference palette, continuous layout adaptation and decoration contrast.
- Isolated embedded-PostgreSQL migration/permission test passes: null legacy state, valid owner/admin saves, foreign actor/anon refusal, additional trigger defence even under a broad update policy, invalid JSON/URLs/foreign-shop image paths refused. This is a focused fixture, not full production migration-history validation.
- Both apps pass TypeScript. Android and iOS exports for both apps passed with all three new bundled fonts. Subsequent minor visual/a11y corrections are checked by final TypeScript and browser tests; no native phone execution is claimed.
- Actual shared renderer browser checks pass at 390px and 1100px, zero page errors or horizontal overflow. Mocked editor verifies templates/materials, invalid colour, save failure/retry/payload, missing-photo refusal, discard cancel/confirm, replay and continuous-programme layout/one label.
- Preview app, harness, screenshots and JSON results are retained under .tmp/card-design (ignored evidence). All named shops/progress in that harness are illustrative test data, not live shops.
- Impeccable reviewer identified and prompted fixes to continuous templates, responsive sizing, fonts, progress track and template previews. Final review corrections were applied and browser-verified. Native screenshot review remains unavailable; do not describe browser captures as device acceptance.

Initial attempts failed because Python was unavailable, workspace folder creation/network/database process access needed escalation, and the first preview selected the native SVG entry. A DB reset assertion initially sent JSON null instead of SQL NULL; fixed test passes. React Native Web required explicit aria-checked for radio state. These attempts did not touch production.

## Release order and remaining acceptance

1. Reconcile these root changes with the newer integration/release worktrees before preparing a release; preserve other contributors' work. No programme-type migration is part of card design.
2. Apply this migration in a Supabase branch/test environment and verify against the real businesses RLS/update-scope triggers, covers policies and realtime publication. Test owner, staff and another shop's owner.
3. On actual Android and iPhone, verify all four fonts/templates, long shop names, QR scanning, keyboard/scrolling, reduced motion, photo permission/cancel/quality/upload/failure and unsaved navigation. Save a design and confirm another shopper session updates live and after offline/resume.
4. With product-owner release approval, apply the migration before publishing clients. Follow the existing EAS rule: --environment production and inspect uploaded bundles for required public settings. No release was requested or performed in this work item.

Apple/Google Wallet layout generation is unchanged. No establishment date, streak badge or free-form canvas is invented. The cafe includes a steam entrance detail; the barber pole is decorative rather than a continuously spinning animation. New product decisions are unnecessary for local implementation; hosted changes and release still need owner approval.
