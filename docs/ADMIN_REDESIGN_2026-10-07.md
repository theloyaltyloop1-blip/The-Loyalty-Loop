# Admin redesign, 7 October 2026

Implemented locally, not deployed. This changes the admin UI; existing database and admin permissions remain in use.

- Light slate background, white panels, blue accent and shared responsive navigation.
- Overview platform counts are all-time records, explicitly labelled; memberships are not unique shoppers.
- Charts use existing admin_usage_analytics(_days: 30): top six feature/surface combinations, switch between actions and people within that feature/surface, and total actions by app. Only opted-in activity is included. No time series/revenue/unique-platform-user statistic is invented.
- All ten views, including Trending shops and Shop requests, use /access?view=... (overview is /access). Legacy /admin/trending and /admin/shop-requests redirect into the shared shell. Browser back and bookmarked views work.
- Explicit data errors, retry, refresh lock, checked role/override/takedown errors, and truthful download-started backup messages.

## Verification

- In apps/web: npm run build passed, including TypeScript. Existing vendor chunk size warning remains.
- In apps/admin: npx --no-install tsc --noEmit passed. Native device not tested.
- Scoped oxlint: no errors, four pre-existing effect/state pattern warnings.
- Chrome with temporary local mock auth/Supabase fixture (no production API): desktop 1440px and phone 390px, no horizontal document overflow; chart measure toggle; Trending and requests retain sidebar/main; URL/reload/back; empty/failed analytics; rejected and successful role operations; backup download initiated with failed history confirmation message; global dark theme isolation; no browser page errors. Screenshots visually inspected.
- Screenshots in admin-redesign/ are illustrative mock data, not live statistics.
- Live authenticated data, real role/ownership/announcement changes, production backup export, native device and deployment not tested.

## Review

Review AccessPanel.tsx, AccessTools.tsx, admin-panel.css, admin-dashboard.tsx, TrendingAdmin.tsx, ShopRequests.tsx, App.tsx and apps/admin/App.tsx. No database migration or new runtime/chart package required. Other dirty Sentry/WhatsApp work is unrelated and must not be bundled into a release by accident.
