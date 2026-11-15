# Onboarding lessons, v2 (re-applied onto current main)

Branch `claude/v2-onboarding-77d0c5`, cut from `claude/reel-release` (origin/main 9c96a41 + merged work). Original: `snap/onboarding` (base 593f736), not merged; re-implemented by hand.

## What current main already had (so not redone)
- Shopper app no longer has the 3-slide intro or analytics-consent screen (browse-first guest home; analytics is a Settings switch). The step counter / "Not now" analytics changes have nothing to attach to there.
- Shopper push: `registerPushToken` already needs `{ ask: true }`, and a friendly "Get a ping when you earn a reward?" sheet (Not now / Turn on) already appears ~1s after a **first card join**, once (SecureStore `push_ping_asked`). I kept that: it is more contextual than "a few seconds after sign-in".
- Retailer `registerPushToken` already had the `ask` gate; the Business app had no pop-up at all.
- Business app first screen is now the shop-setup wizard (`src/shop-onboarding.tsx`), not slides.

## Re-applied
1. **Retailer push pop-up** (`apps/retailer/src/push.ts`, `App.tsx`): new `offerPushPrompt` shows a one-time "Get a ping about your shop?" pop-up (Not now / Turn on) 4s after sign-in; only when permission is undetermined and canAskAgain, flag `loyalty-loop-business-push-prompt-asked` in SecureStore. Already-allowed users still register silently.
2. **Shop wizard** (`shop-onboarding.tsx`): dots replaced by a progress bar with "Step n of 4" (account step counts as step 4); checkmark badge on selected shop-kind, "Something different" and programme-picker cards; shop name reused in the rewards-step copy ("We've filled these in for Bean & Bird"); step-0/step-1 copy reworded around value.
3. **Shopper auth** (`apps/shopper/App.tsx`): sign-up hero "Collect stamps at your local shops", subtitle "…No card to carry."; email-confirm alert greets "Nearly there, <first name>".
4. **Web**: `AuthLayout` optional `subtitle`; `Signup.tsx` situation-led titles/subtitles (shopper: "Collect stamps at your local shops"; owner: "Set up your shop's loyalty card" + free/no-hardware/minutes), "Nearly there, <first name>" on check-email, "First name", button "Create free account" (shopper).
5. Wording: no "trial"/"launch gift" anywhere touched; "reward" only.

## Changed vs first attempt
- Shopper intro/consent edits dropped (screens gone); shopper push pop-up not added (main's post-join sheet kept); wizard structure used for the Business app as the brief suggested; owner subtitle adds "no hardware".

## Typecheck
`npx tsc --noEmit` in apps/shopper and apps/retailer, `npx tsc -b` in apps/web: all clean, no errors.

## Untested
Nothing run on a device or browser. Untested: the retailer pop-up timing/once-only flag, existing Business users with undetermined permission now see our pop-up (previously nothing asked on launch after the `ask` gate), the progress bar layout and check badges, web signup page visuals.
