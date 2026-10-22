# In-app loyalty card design

## Confirmed user scope

Shop owners can design their in-app loyalty card through curated templates and a live preview in the business app. The visual reference establishes four starting characters: roast café with coffee stamps, black-and-gold striped barber with scissors, fine-paper handwritten bakery with a progress ring, and navy/orange gym with a progress bar.

Owners control background material or their own photo, colours, a curated font style, stamp icon or shop logo, fixed progress layout, logo alignment and a short opening effect. Background options include solid, gradient, kraft, chalkboard, marble and wood, alongside the reference-specific materials. Template composition keeps the experience approachable and readable. A free-position canvas is outside this scope.

The shopper app renders the saved design through the same card component used in the editor. Existing reward calculations and progress remain authoritative. Decorative examples must not fabricate establishment dates, streaks, completed visits or reward entitlement.

## Boundaries

This design system governs in-app cards. Apple and Google Wallet retain their provider-defined layouts; custom in-app layouts must not be presented as Wallet capabilities.

Templates, bundled fonts and textures ship with the apps. Selecting already-shipped options changes saved shop data; adding new shipped assets requires an app release. Acceptance of actual customer refresh timing remains to be verified; do not promise an immediate push from the design editor alone.

Uploaded photos require size, format and resolution checks. Current checks accept JPEG, PNG and WebP up to 5 MB, at least 640 × 360 and at most 12,000 pixels per dimension. These checks do not detect inappropriate content or establish that an image is sharp. Content moderation remains an unresolved product/operational decision.

## Implementation and acceptance status

The package supplies versioned design data, normalization, contrast fallbacks, shared progress adaptation, a shared renderer and bundled card fonts. The business editor supplies template selection, settings controls, preview, replay, upload, save and discard flows. Reduced-motion preferences suppress entrances.

Device/native typography, authenticated upload and customer-refresh behavior require end-to-end acceptance. This document records scope and boundaries, not a completed deployment or device test. Establishment labels, fabricated streak badges, spinning barber poles and scissor-specific entrance effects from illustrative references are not claimed as implemented features.
