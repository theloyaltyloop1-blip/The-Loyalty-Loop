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

## Remaining (not changed)
- Home, Favourites, owner/Tools still return `null` during auth-loading (brief); Tools member fetch ignores errors.
- No automated a11y/Lighthouse scoring available offline; no test suite exists in repo.
