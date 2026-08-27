# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versioning follows
[Semantic Versioning](https://semver.org/) — PATCH for fixes, MINOR for new
compatible features, MAJOR for breaking changes.

## [Unreleased]

### Fixed
- Google Wallet passes ("Add to Google Wallet") failing with a generic error
  in the Wallet app — the loyalty class now gets created via a real REST call
  before any object references it, matching what Google's API actually
  requires.
- Google Wallet pass balances now push a live update to an already-saved
  pass immediately after a stamp is awarded or a reward is redeemed, instead
  of only reflecting the balance from whenever the pass was first added.
- Discover tab (shopper app) no longer shows the bottom tab bar over the
  full-bleed photo feed — replaced with a single back button.

### Added
- Sign in with Google on the web app and shopper app.
- Skeleton loading screens across the web app's main pages.
- `VERSION` / `CHANGELOG.md` for tracking releases going forward.

### Removed
- WhatsApp loyalty onboarding — paused and moved to a separate repo
  (`loyalty-loop-whatsapp-wip`) while unfinished. Nothing was lost: the live
  database tables were archived (not dropped, and were empty), and the full
  source + a restore script live in that repo for when this resumes.

## [1.0.0] — 2026-08-24

Baseline: the point this changelog starts tracking from. Loyalty Loop is
live with the web app (customer + business owner dashboard), the retailer
Expo app, the shopper Expo app, and the Supabase backend (auth, database,
storage, edge functions).
