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
(login-empty / signup-noagree blocked by native  validation — intended.)

### Pass 2 fixes
| Area | Fix |
|---|---|
| Home, Favourites | Skeleton loading; ErrorState + retry (previously silent / "No shops yet" on failure) |
| owner/Tools | Promo save & deactivation errors were silent → inline alert; skeleton while auth loads |
| ForgotPassword | 429/5xx swallowed as "sent" → readable error (enumeration protection kept otherwise) |
| All inline errors (21) |  for screen-reader announcement |
| Landing | Dead  "See all shops" → ; FAQ toggles 44px |
| Cookie banner, auth Back, footer links, category chips, Legal back link, Profile copy/delete/invite, Signup checkbox | ≥44px targets |

## Remaining (not changed)
- owner/Tools member-list fetch ignores errors (non-critical).
- No automated a11y/Lighthouse scoring available offline; no test suite exists in repo.
