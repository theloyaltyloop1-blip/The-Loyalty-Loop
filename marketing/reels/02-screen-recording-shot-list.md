# Screen-recording shot list (real apps, test data only)

## Ground rules
- **Never record an account with real customers.** Use a dedicated test shop (project notes say a "Test Shop" exists) and test shopper accounts. Give the demo shop a harmless name ("Maple Street Coffee").
- Seed 8-15 invented members (fake names, `@example.com` emails), a few at 9/10 stamps, a few lapsed. Never show a real QR, stamp code, email, phone number or your home location.
- `scripts/wipe-test-data` exists for cleanup; read what it does before running it.
- Record on a real phone at 1080x1920, Do Not Disturb on, notification previews off, clean status bar.
- Screen names come from the source (`apps/shopper/App.tsx`, `apps/retailer/App.tsx`). The owner app was redesigned recently (floating pill tab bar; Home, Analytics, and others), so confirm tab names on the installed build before filming. I did not run the apps.

## Shopper app (`apps/shopper`), tabs: Home, Discover, Map, News, Rewards, Favourites
| ID | Screen | Show | Reels |
|---|---|---|---|
| S1 | Home | 2-3 cards with progress, one nearly full | 1, 2, 3, 7 |
| S2 | Discover | browsing shops | 7 |
| S3 | Shop page | a shop's page and card | 9 |
| S4 | Stamp earned | right after a scan, card ticks up | 1, 10 |
| S5 | Rewards tab | reward ready to redeem (test account code) | 1, 10 |
| S6 | Map | full-page map with pins, a city area not your home | 7 |
| S7 | News | an announcement arriving | 4 |
| S8 | Sign-up / intro | "Start collecting", intro slides | 7 |

## Owner app (`apps/retailer`)
| ID | Screen | Show | Reels |
|---|---|---|---|
| R1 | Onboarding | shop-type onboarding with the test shop | 8 |
| R2 | Scan | scanner reading a test shopper's QR (second test phone) | 1, 10 |
| R3 | Home | live stats on seeded data | 1, 2, 9 |
| R4 | Analytics / Customers | members list, near-reward, lapsed | 3, 4 |
| R5 | News composer | writing a shop announcement | 4 |
| R6 | Redeem scan | redeeming a reward | 10 |
| R7 | Reward setup | choosing reward and stamp count | 8 |

## Capture checklist
- Slow taps, hold 1-2 s on each result, two clean takes per ID.
- Name files `S1_home_take1.mp4`; keep in the project's `raw/` folder.
- Review every clip frame by frame for stray real data before it enters an edit.
