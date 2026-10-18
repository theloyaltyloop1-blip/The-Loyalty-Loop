# Audit 09 — Domain Context & Business Logic

## Scope crawled
- Taxonomy: `CATEGORIES` (Onboarding, Settings), `businesses.category` (free text, migrations 0004/0006/0019), seed data.
- Filters/search: Home category chips + search box. No facet schemas, booking/time pickers, or product types exist in the codebase.
- Forms/placeholders: Onboarding, Settings (profile/loyalty/rewards/verification/staff), Announcements, Reviews, Support, Access tools, Brand workspace, auth pages.

## Findings & resolutions
| # | Issue | Fix |
|---|---|---|
| 1 | Restaurant loyalty stamp rendered as a **coffee cup** (`ShopDetail` `STAMP_ICON`) | Category icon map centralised in `lib/categories.ts`; Restaurant → cutlery; Salon/Bakery/Retail icons added |
| 2 | Reward placeholders "Free coffee" / "Any size, any time" / "Free coffee just for joining" shown to barbers, salons, retail | Placeholders now derived from shop category |
| 3 | Announcement placeholder "Our summer menu is here" shown to non-food shops | Category-specific example |
| 4 | Home search input was non-functional (decorative) | Wired to filter by name/category/description, combined with category chip |
| 5 | Null category counted as "Other" chip but filtering on "Other" returned nothing | Filter now treats null as "Other" |
| 6 | Settings category `<select>` silently showed "Café" for legacy/custom stored values (e.g. seed data) — saving would overwrite | Current non-standard value kept as an option |
| 7 | `CATEGORIES` duplicated in two files | Single source in `lib/categories.ts` |

## Not changed (verified valid)
- Loyalty units (stamp/point/visit) apply to all categories.
- Opening hours apply to all physical-shop categories (no digital-product category exists).
- Verification placeholder "VAT certificate" is UK-generic, valid across categories.

## Checks
- `tsc -b`: pass. `oxlint src`: 0 errors (3 pre-existing exhaustive-deps warnings in Settings.tsx).

## Pass 2
| # | Issue | Fix |
|---|---|---|
| 8 | ShopDetail reward tile said "N stamps" for points/visit-based shops | Uses loyalty unit |
| 9 | Owner test button said "Simulate stamp" for points/visit shops | Uses loyalty unit |
| 10 | Landing promised a "map" — no map feature exists | Copy changed to list/browse |
- Verified: Scan, Activity, Rewards, Analytics, win-back/thank-you emails use loyalty-neutral or unit-aware wording.
