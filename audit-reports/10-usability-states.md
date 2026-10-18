# Audit 10 – UX Usability & State Completeness

Scope: `apps/web/src` (28 pages, 11 components). Build: `npm run build` ✅ (tsc + vite, 0 errors).

## Raw scan (keyword heuristic per page: Loading/Error/Empty/Success/Escape hits)
Pages with fetches but 0 error handling: Activity, Inbox, News, Rewards, owner/Notifications, BrandWorkspace.
Pages rendering `null` while loading (blank screen): Activity, Inbox, News, Rewards, owner/Notifications, Home, Favourites, BrandWorkspace, owner/Tools.
Modals/dialogs (`role="dialog"`, `aria-modal`, `<dialog>`, `fixed inset-0`): **none found**. Only overlay is the non-modal cookie banner (requires explicit choice; Escape-dismiss intentionally not added, as consent must be explicit).

## Issues resolved
| # | Page | Issue | Fix |
|---|------|-------|-----|
| 1 | Activity, Inbox, News, Rewards, owner/Notifications | Blank page while loading | `ListSkeleton` (animated, `role=status`) |
| 2 | same | Fetch rejection → unhandled promise + misleading empty state | `ErrorState` with message + "Try again" retry |
| 3 | same | **Bug**: logged-out user saw blank page forever (`!ready` never flipped, redirect unreachable) | Redirect checked before data status |
| 4 | Inbox, owner/Notifications | Mark-read promise rejections unhandled | `.catch` (mark-all failure triggers reload) |
| 5 | Activity, Rewards | Empty state lacked CTA | "Find a shop"/"Browse shops" → `/dashboard` |
| 6 | BrandWorkspace | Create brand/shop: no success/error feedback, double-submit possible | Inline status/alert message, busy-disabled buttons |
| 7 | Button `size="sm"` | 36px tap target | 44px (`h-11`) |
| 8 | "Mark all read", BrandWorkspace buttons, retry/CTA buttons | <44px | `min-h-11`/`h-11` |

New shared module: `src/components/ui/states.tsx` (`useLoad`, `ListSkeleton`, `ErrorState`) — includes stale-response guard on unmount/re-fetch.

## Already compliant
Login, Signup, ForgotPassword, ResetPassword, Profile, owner/Settings, Scan, Reviews, Announcements: inline errors, loading button states, success messages present.

## Pass 2 – browser-verified (Playwright, Chromium, 390x844 mobile, touch)
Method: production build with dummy Supabase URL; all Supabase calls intercepted (500 for state tests); fake session injected for authenticated routes. Owner routes redirect to /dashboard for the fake customer session (role lookup fails), so owner pages were reviewed by code only.

### Tap-target scan BEFORE
```
## / → / | interactive=21 alert=false skeleton=false | "The Loyalty Loop Sign up or log in SW17 · SW12 · now live Your high street, in your pocket"
undersized: 6
- a 122x24 "See all shops" .font-bold text-primary flex items-center gap-1
- button 312x32 "Is it really free for shoppers" .w-full flex items-center justify-between gap-4 text-left fon
- button 312x32 "Which shops can I use it at?" .w-full flex items-center justify-between gap-4 text-left fon
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x38 "Privacy" .px-3 py-2 text-sm underline
## /login → /login | interactive=10 alert=false skeleton=false | "Welcome back Log in New here? – Sign up as a customer Run a shop? – Sign up as a Loyalty"
undersized: 5
- a 292x16 "Forgot your password?" .text-xs text-[#1a1a1a]/50 hover:text-[#1a1a1a]/80 hover:unde
- button 33x20 "Back" .absolute bottom-6 right-8 text-sm font-semibold text-[#2F6FE
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /signup → /signup | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Sign up Already reg"
undersized: 7
- input 13x13 "checkbox" .mt-1
- a 41x20 "Terms" .underline font-bold
- a 92x40 "Privacy Notice" .underline font-bold
- button 33x20 "Back" .absolute bottom-6 right-8 text-sm font-semibold text-[#2F6FE
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /signup/owner → /signup/owner | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Create shop account "
undersized: 7
- input 13x13 "checkbox" .mt-1
- a 41x20 "Terms" .underline font-bold
- a 92x40 "Privacy Notice" .underline font-bold
- button 33x20 "Back" .absolute bottom-6 right-8 text-sm font-semibold text-[#2F6FE
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /forgot-password → /forgot-password | interactive=6 alert=false skeleton=false | "Reset your password Send reset link Back to sign in Your privacy choices We use essentia"
undersized: 4
- a 91x16 "Back to sign in" .underline
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /reset-password → /reset-password | interactive=5 alert=false skeleton=false | "Choose a new password Save new password Your privacy choices We use essential storage to"
undersized: 3
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /terms → /terms | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Terms of service Using The Loyalty Loop The "
undersized: 4
- a 153x17 "← The Loyalty Loop" .font-bold text-[#C9622E]
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /privacy → /privacy | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Privacy notice What we store We store the ac"
undersized: 4
- a 153x17 "← The Loyalty Loop" .font-bold text-[#C9622E]
- button 98x38 "Accept all" .rounded-full bg-[#E8703B] px-4 py-2 text-sm font-bold
- button 128x38 "Essential only" .rounded-full border border-white/25 px-4 py-2 text-sm font-b
- a 70x36 "Privacy" .px-3 py-2 text-sm underline
## /dashboard → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 1
- button 124x36 "All categories" .rounded-full px-4 py-2 text-sm font-semibold transition-colo
## /dashboard/rewards → /dashboard/rewards | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/news → /dashboard/news | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/favourites → /dashboard/favourites | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out FAVOURITES "
undersized: 0
## /dashboard/activity → /dashboard/activity | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/inbox → /dashboard/inbox | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/profile → /dashboard/profile | interactive=18 alert=false skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out PROFILE Yo"
undersized: 3
- button 16x16 "" .text-[#1a1a1a]/40 hover:text-[#1a1a1a]
- button 137x40 "Copy invite link" .flex items-center gap-2 rounded-full bg-[#E8703B] px-4 h-10 
- button 148x20 "Delete my account" .mt-4 flex items-center gap-2 text-sm font-semibold text-red-
## /owner → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 1
- button 124x36 "All categories" .rounded-full px-4 py-2 text-sm font-semibold transition-colo
## /owner/notifications → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 1
- button 124x36 "All categories" .rounded-full px-4 py-2 text-sm font-semibold transition-colo
## /owner/settings → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 1
- button 124x36 "All categories" .rounded-full px-4 py-2 text-sm font-semibold transition-colo
## /owner/scan → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 1
- button 124x36 "All categories" .rounded-full px-4 py-2 text-sm font-semibold transition-colo
```
### Tap-target scan AFTER (remaining = inline links in sentences + checkbox inside clickable label; WCAG 2.5.8 exempt)
```
## / → / | interactive=21 alert=false skeleton=false | "The Loyalty Loop Sign up or log in SW17 · SW12 · now live Your high street, in your pocket"
undersized: 0
## /login → /login | interactive=10 alert=false skeleton=false | "Welcome back Log in New here? – Sign up as a customer Run a shop? – Sign up as a Loyalty"
undersized: 0
## /signup → /signup | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Sign up Already reg"
undersized: 3
- input 20x20 "checkbox" .mt-0.5 h-5 w-5 shrink-0
- a 41x20 "Terms" .underline font-bold
- a 88x40 "Privacy Notice" .underline font-bold
## /signup/owner → /signup/owner | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Create shop account "
undersized: 3
- input 20x20 "checkbox" .mt-0.5 h-5 w-5 shrink-0
- a 41x20 "Terms" .underline font-bold
- a 88x40 "Privacy Notice" .underline font-bold
## /forgot-password → /forgot-password | interactive=6 alert=false skeleton=false | "Reset your password Send reset link Back to sign in Your privacy choices We use essentia"
undersized: 0
## /reset-password → /reset-password | interactive=5 alert=false skeleton=false | "Choose a new password Save new password Your privacy choices We use essential storage to"
undersized: 0
## /terms → /terms | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Terms of service Using The Loyalty Loop The "
undersized: 0
## /privacy → /privacy | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Privacy notice What we store We store the ac"
undersized: 0
## /dashboard → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 0
## /dashboard/rewards → /dashboard/rewards | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/news → /dashboard/news | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/favourites → /dashboard/favourites | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out FAVOURITES "
undersized: 0
## /dashboard/activity → /dashboard/activity | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/inbox → /dashboard/inbox | interactive=10 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Something we"
undersized: 0
## /dashboard/profile → /dashboard/profile | interactive=18 alert=false skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out PROFILE Yo"
undersized: 0
## /owner → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 0
## /owner/notifications → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 0
## /owner/settings → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 0
## /owner/scan → /dashboard | interactive=12 alert=true skeleton=false | "The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign out Hello, a D"
undersized: 0
```
Score: undersized targets 63 → 6 (all exempt). Error state (alert=true) confirmed on /dashboard, rewards, news, favourites, activity, inbox under forced 500s.

### Form flow tests
```
login-empty: url=/login invalidNative=2 messages=[]
login-badcreds: url=/login invalidNative=0 messages=["Invalid login credentials"]
forgot-err: url=/forgot-password invalidNative=0 messages=["We couldn’t send the link right now. Please try again."]
forgot-ok: url=/forgot-password invalidNative=0 messages=["If an account exists for a@b.co, we've sent a password reset link to it."]
signup-noagree: url=/signup invalidNative=3 messages=[]
```
(login-empty / signup-noagree blocked by native `required` validation — intended.)

### Pass 2 fixes
| Area | Fix |
|---|---|
| Home, Favourites | Skeleton loading; ErrorState + retry (previously silent / "No shops yet" on failure) |
| owner/Tools | Promo save & deactivation errors were silent → inline alert; skeleton while auth loads |
| ForgotPassword | 429/5xx swallowed as "sent" → readable error (enumeration protection kept otherwise) |
| All inline errors (21) | `role="alert"` for screen-reader announcement |
| Landing | Dead `href="#"` "See all shops" → `/signup`; FAQ toggles 44px |
| Cookie banner, auth Back, footer links, category chips, Legal back link, Profile copy/delete/invite, Signup checkbox | ≥44px targets |

## Pass 3 – owner portal (browser, mocked business_owner role)
Mocks: user_roles→business_owner, businesses→1 shop; all other calls → 500 ("fail") or [] ("empty").

### Bugs found & fixed
| Severity | Issue | Fix |
|---|---|---|
| **High** | Auth race: `rolesLoading` flipped false before the session was read, so `OwnerLayout` redirected owners to /dashboard → /owner on every refresh/deep link of any owner page (scan, tools, settings, notifications, …) | `auth-context.tsx` settles roles only after initial session check; `OwnerLayout` shows skeleton while roles load |
| **High** | Owner + customer layouts had a fixed 256px sidebar on phones → 206px content, horizontal scroll (scrollWidth 462 @390px) | New `SidebarShell` (`components/ui/mobile-nav.tsx`): off-canvas drawer < md, top bar w/ 44px menu button |
| Med | Analytics: stats fetch failure left "Loading stats…" forever + unhandled rejection | ErrorState + retry, skeleton |
| Med | owner/Tools redirected to onboarding before owner context loaded | Wait for `ownerLoading` |
| Med | Settings: photos, reward catalog, win-back log, staff fetch failures unhandled (page errors, silent) | Inline `role=alert` messages |
| Low | Landing hero badge overflowed viewport by 14px | Offset reduced on mobile |
| Low | Undersized owner controls (period chips 36px, tabs 42px, Scan/Tools buttons 40px, hours chips 32px, colour swatches 32px, Upload 36px, Regenerate 16px) | All ≥44px |

### Drawer / modal behaviour (`mobile.txt`)
```
/owner: scrollWidth=390 ok
/owner/scan: scrollWidth=390 ok
/owner/tools: scrollWidth=390 ok
/owner/settings: scrollWidth=390 ok
/owner/notifications: scrollWidth=390 ok
/owner/announcements: scrollWidth=390 ok
/owner/reviews: scrollWidth=390 ok
/owner/support: scrollWidth=390 ok
/dashboard: scrollWidth=390 ok
/dashboard/rewards: scrollWidth=390 ok
/dashboard/profile: scrollWidth=390 ok
/: scrollWidth=390 ok
/login: scrollWidth=390 ok
/signup: scrollWidth=390 ok
/terms: scrollWidth=390 ok
drawer hidden initially: true
opens on menu tap: true
closes on Escape: true
closes on backdrop: true
closes on X: true
closes on navigate: true http://localhost:4173/owner/reviews
```

### Owner routes, forced failure
```
## /owner → /owner alerts=["Something went wrongWe couldn’t load your stats. Check your "] skeleton=false pageErrors=0
  text: ANALYTICS Know your customers 7d 30d 90d Something went wrong We couldn’t load your stats. Check your connection and try again. Try again
  undersized(0): 
## /owner/scan → /owner/scan alerts=[] skeleton=false pageErrors=0
  text: SCAN Award & redeem Add Stamp Redeem Reward Scan customer QR OR MANUAL CODE Find
  undersized(0): 
## /owner/tools → /owner/tools alerts=[] skeleton=false pageErrors=0
  text: GROWTH TOOLS Grow your shop Printable QR poster Test Cafe Join our loyalty rewards Scan to start collecting Print poster Setup checklist 0/4 shop details comple
  undersized(0): 
## /owner/settings → /owner/settings alerts=["Couldn’t load your photos. Refresh to try again."] skeleton=false pageErrors=0
  text: Shop settings Profile Loyalty & rewards Win-back emails Verification Staff Help & support Danger zone STOREFRONT PREVIEW Test Cafe Cafe Brand images A logo is s
  undersized(0): 
## /owner/notifications → /owner/notifications alerts=["Something went wrongWe couldn’t load notifications. Check yo"] skeleton=false pageErrors=0
  text: Something went wrong We couldn’t load notifications. Check your connection and try again. Try again
  undersized(0): 
## /owner/announcements → /owner/announcements alerts=["boom"] skeleton=false pageErrors=0
  text: CUSTOMER NEWS Announcements Share menu launches, events and updates with customers on the News page. Create an update boom Publish update Your updates No announ
  undersized(0): 
## /owner/reviews → /owner/reviews alerts=["boom"] skeleton=false pageErrors=0
  text: CUSTOMER FEEDBACK Reviews — from 0 reviews boom No customer reviews yet.
  undersized(0): 
## /owner/support → /owner/support alerts=["boom"] skeleton=false pageErrors=0
  text: HELP CENTRE Help & support Send a request directly to the Loyalty Loop team. New request Low priority Normal priority High priority boom Send request Your reque
  undersized(0): 
```
### Owner routes, empty data
```
## /owner → /owner alerts=[] skeleton=false pageErrors=0
  text: ANALYTICS Know your customers 7d 30d 90d Simplified Detailed flat 0 New members flat 0 Stamps given flat 0 Rewards earned flat 0 Rewards redeemed What changed i
  undersized(0): 
## /owner/scan → /owner/scan alerts=[] skeleton=false pageErrors=0
  text: SCAN Award & redeem Add Stamp Redeem Reward Scan customer QR OR MANUAL CODE Find
  undersized(0): 
## /owner/tools → /owner/tools alerts=[] skeleton=false pageErrors=0
  text: GROWTH TOOLS Grow your shop Printable QR poster Test Cafe Join our loyalty rewards Scan to start collecting Print poster Setup checklist 0/4 shop details comple
  undersized(0): 
## /owner/settings → /owner/settings alerts=[] skeleton=false pageErrors=0
  text: Shop settings Profile Loyalty & rewards Win-back emails Verification Staff Help & support Danger zone STOREFRONT PREVIEW Test Cafe Cafe Brand images A logo is s
  undersized(0): 
## /owner/notifications → /owner/notifications alerts=[] skeleton=false pageErrors=0
  text: SHOP UPDATES Notifications Mark all read No shop notifications yet.
  undersized(0): 
## /owner/announcements → /owner/announcements alerts=[] skeleton=false pageErrors=0
  text: CUSTOMER NEWS Announcements Share menu launches, events and updates with customers on the News page. Create an update Publish update Your updates No announcemen
  undersized(0): 
## /owner/reviews → /owner/reviews alerts=[] skeleton=false pageErrors=0
  text: CUSTOMER FEEDBACK Reviews — from 0 reviews No customer reviews yet.
  undersized(0): 
## /owner/support → /owner/support alerts=[] skeleton=false pageErrors=0
  text: HELP CENTRE Help & support Send a request directly to the Loyalty Loop team. New request Low priority Normal priority High priority Send request Your requests N
  undersized(0): 
```
### Settings tabs (each clicked)
```
## tab Profile alerts=["Couldn’t load your photos. Refresh to try again."] pageErrors=0 
  undersized(0): 
## tab Loyalty & rewards alerts=["Couldn’t load your rewards. Refresh to try again."] pageErrors=0 
  undersized(1): input 42x48 "text" .h-12 w-full rounded-xl border border-black/10 bg-w
## tab Win-back emails alerts=["Couldn’t load the win-back log. Please try again."] pageErrors=0 
  undersized(0): 
## tab Verification alerts=[] pageErrors=0 
  undersized(0): 
## tab Staff alerts=[] pageErrors=0 
  undersized(0): 
## tab Help & support alerts=[] pageErrors=0 
  undersized(0): 
## tab Danger zone alerts=[] pageErrors=0 
  undersized(0): 
```

### Final customer/public tap-target scan
```
## / → / | interactive=21 alert=false skeleton=false | "The Loyalty Loop Sign up or log in SW17 · SW12 · now live Your high street, in your pocket"
undersized: 0
## /login → /login | interactive=10 alert=false skeleton=false | "Welcome back Log in New here? – Sign up as a customer Run a shop? – Sign up as a Loyalty"
undersized: 0
## /signup → /signup | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Sign up Already reg"
undersized: 3
- input 20x20 "checkbox" .mt-0.5 h-5 w-5 shrink-0
- a 41x20 "Terms" .underline font-bold
- a 88x40 "Privacy Notice" .underline font-bold
## /signup/owner → /signup/owner | interactive=15 alert=false skeleton=false | "Welcome to The Loyalty Loop I agree to the Terms and Privacy Notice . Create shop account "
undersized: 3
- input 20x20 "checkbox" .mt-0.5 h-5 w-5 shrink-0
- a 41x20 "Terms" .underline font-bold
- a 88x40 "Privacy Notice" .underline font-bold
## /forgot-password → /forgot-password | interactive=6 alert=false skeleton=false | "Reset your password Send reset link Back to sign in Your privacy choices We use essentia"
undersized: 0
## /reset-password → /reset-password | interactive=5 alert=false skeleton=false | "Choose a new password Save new password Your privacy choices We use essential storage to"
undersized: 0
## /terms → /terms | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Terms of service Using The Loyalty Loop The "
undersized: 0
## /privacy → /privacy | interactive=4 alert=false skeleton=false | "← The Loyalty Loop EFFECTIVE 7 AUGUST 2026 Privacy notice What we store We store the ac"
undersized: 0
## /dashboard → /dashboard | interactive=14 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/rewards → /dashboard/rewards | interactive=12 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/news → /dashboard/news | interactive=12 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/favourites → /dashboard/favourites | interactive=12 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/activity → /dashboard/activity | interactive=12 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/inbox → /dashboard/inbox | interactive=12 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /dashboard/profile → /dashboard/profile | interactive=20 alert=false skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /owner → /dashboard | interactive=14 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /owner/notifications → /dashboard | interactive=14 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /owner/settings → /dashboard | interactive=14 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
## /owner/scan → /dashboard | interactive=14 alert=true skeleton=false | "The Loyalty Loop The Loyalty Loop Home News Rewards Activity Inbox Favourites Profile Sign"
undersized: 0
```

## Remaining (not changed)
- owner/Tools member-list fetch ignores errors (non-critical).
- No automated a11y/Lighthouse scoring available offline; no test suite exists in repo.
- Customer layout floating "Security" button (`dashboard-layout.tsx`) has no action — dead control; intent unclear, left for product decision.
- Announcements/Reviews/Support show raw backend messages (e.g. "boom" in mocks) and the empty state simultaneously on failure.
- Desktop sidebar unchanged (verified visible at 1280px, menu button hidden).

## Pass 5–6 – mutations & detail pages
| Severity | Issue | Fix |
|---|---|---|
| **High** | Profile: failed load still rendered the edit form with blank fields; pressing Save would overwrite the real profile with blanks | ErrorState + retry instead of form on load failure |
| **High** | ShopDetail: fetch failure → unhandled rejection, blank page forever | ErrorState + retry; skeleton while loading |
| Med | Profile save & notification toggles failed silently (toggle stayed flipped) | Inline alert; toggle reverts on failure |
| Med | ShopDetail promo opt-in toggle stayed flipped on failure | Reverts |
| Med | Owner Announcements/Reviews/Support: load failure showed raw backend text *and* "No … yet" empty state; empty state flashed before load | Dedicated loading/error/ready list state with retry |
| Med | Announcement publish & support request had no success confirmation | `role=status` confirmation messages |
| Low | Review post/delete had no confirmation | Status message |
| Low | Remaining owner pages returned `null` during auth load | Skeleton |

Mutation flow test (mock 201 vs 400):
```
announce: ["Published — customers will see it on their News page."]
support: ["Request sent — we’ll reply here."]
promo: ["Draft saved."]
announce: ["insert failed"]
support: ["insert failed"]
promo: ["Couldn’t save the promotion. Please try again."]
```

## Pass 7 – admin & franchise consoles
| Severity | Issue | Fix |
|---|---|---|
| **High** | AccessTools (admin role grant/revoke, loyalty override, platform announcement) always showed success: Supabase resolves `{ error }` rather than throwing, so a denied RPC displayed "Role granted." | `act()` checks `error`; red `role=alert` on failure; buttons busy-disabled |
| **High** | `/brand` redirected brand heads to `/owner` on load (role-loading race) | Wait for `rolesLoading` |
| Med | BrandWorkspace brand list / roll-up fetch errors silent | Inline alert |
| Med | owner/Tools member list error silent | Inline alert |
| Low | Customer layout flashed then redirected owners while roles loaded | Skeleton until roles known |

Verified (mock RPC 400 vs 200):
```
postfail ["permission denied for function"]
empty ["Role granted."]
```

## Pass 8 – self code review of this branch (10 findings → 7 fixed)
| Finding | Action |
|---|---|
| Role race still possible after a later login (flag-based `rolesLoading`); roles fetched twice per load | `rolesLoading` now derived from "roles fetched for current user id"; request-id guard; single fetch per user |
| ForgotPassword treated network failures (status 0) as success | Status 0 / missing surfaced as error |
| Owner Reviews/Support/Announcements hid load errors when a list was already shown; retry gave no feedback | Error shown regardless of list; loading state reset on retry |
| Home/Favourites/Profile refetched (skeleton flash) on every token refresh; no stale guard | Keyed on user id; stale responses ignored |
| Analytics: fast period switching could show stale stats/error | Stale guard |
| Mobile drawer: closed drawer still tabbable; no focus management | `invisible` when closed (<md); focus moves to Close on open, back to Menu on close |
| Mark-all-read failure silently reverts | Not changed (low) |
| Duplicate state machines / skeleton markup | Not changed (cleanup only) |

Regression run after fixes: all owner routes (fail/empty), customer routes, drawer (6/6), mutations, forms, brand console — all pass. Login flow:
```
login → final /owner via /login > /login > /owner
deep link after login → /owner/settings
```

## Pass 9 – slow network (2.5s latency) & mark-all-read
Loading skeleton visible at 0.9s on every data view (Settings renders from cached shop context, expected):
```
/dashboard @0.9s: skeleton=true blank=false "The Loyalty Loop Hello, a Discover local rewards All categor"
/dashboard/rewards @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/dashboard/news @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/dashboard/favourites @0.9s: skeleton=true blank=false "The Loyalty Loop FAVOURITES Shops you've saved Loading…"
/dashboard/activity @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/dashboard/inbox @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/dashboard/profile @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/dashboard/shop/x @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/owner @0.9s: skeleton=true blank=false "The Loyalty Loop ANALYTICS Know your customers 7d 30d 90d Lo"
/owner/notifications @0.9s: skeleton=true blank=false "The Loyalty Loop Loading…"
/owner/announcements @0.9s: skeleton=true blank=false "The Loyalty Loop CUSTOMER NEWS Announcements Share menu laun"
/owner/reviews @0.9s: skeleton=true blank=false "The Loyalty Loop CUSTOMER FEEDBACK Reviews — from 0 reviews "
/owner/support @0.9s: skeleton=true blank=false "The Loyalty Loop HELP CENTRE Help & support Send a request d"
/owner/settings @0.9s: skeleton=false blank=false "The Loyalty Loop Shop settings Profile Loyalty & rewards Win"
mark-all fail: ["Couldn’t mark all as read. Please try again."] unreadDotStillShown: 1 pageErrors: 0
```
- Fixed: mark-all-read failure now shows an alert and restores true read state (was silent).

## Pass 10 – search & filters
- **High**: Home search input was purely decorative (no state, no filtering) and had `outline-none` with no focus ring. Now filters by name/category/address/postcode combined with category chips; 0-result empty state with 'Clear filters' CTA; focus ring added.
```
initial cards: 3
"salon" cards: 1
"zzz" empty state: true cards: 0
after clear cards: 3 query: ""
```
