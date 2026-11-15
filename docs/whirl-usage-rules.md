# Whirl usage rules ("everywhere, but never annoying")

Owner's brief (2026-11-15): "I want Whirl everywhere, as many places as possible, but without it being annoying."
These rules are enforced in shared code (`packages/whirl/core.ts`, tested by `packages/whirl/core.test.mjs`), not left to
each screen. Anything new that uses Whirl goes through the kit, so the rules come with it.

## The kit

| Piece | Native (shopper, Business) `packages/whirl/native` | Web `apps/web/src/components/whirl-kit` |
|---|---|---|
| `Whirl` pose (9 poses, light/dark, full and 40 px `mini`) | yes | yes |
| `WhirlSpinner` (the loop turning, replaces ActivityIndicator / Loader icons) | yes | yes |
| `WhirlProgress` (upload and AI-report bar, determinate or sweep) | yes | yes |
| `WhirlSkeleton` (warm shimmer cards, tiny Whirl only on slow loads) | yes | yes |
| `WhirlRefreshIndicator` (pull-to-refresh companion) | yes | n/a |
| `WhirlMoment` (pose + line, once-only memory, dismissible) | yes | yes |
| Settings switch hook `useWhirlSettings()` | yes (`WhirlProvider`) | yes (`localStorage`) |
| Light/dark choice `useWhirlVariant()` | `WhirlProvider isDark` (falls back to light) | follows `html.dark` |

Poses: wave, stamp, celebrate, sleepy, think, thumbs, plus new oops (errors, offline), point (tips, tours), peek (home
greeting, drawn only from the chest up so it can sit on the top edge of a card).

## The rules

1. **Frequency budget.** At most **one** non-loading Whirl moment per screen (`createFrequencyBudget`, shared `whirlBudget`).
   A second moment on the same `screenId` is refused, not queued. Loading indicators do not count.
2. **Celebrations once per event.** `shouldCelebrate(eventId)` is true once per reward/stamp id per session.
3. **First-time tips once ever.** `WhirlMoment once` checks storage, shows the tip, and writes "seen" immediately (so a crash or
   force-quit cannot bring it back). If storage cannot be read the tip is **not** shown (fail closed).
4. **Never block a task.** No modal Whirl. Moments are ordinary views that sit in the layout; tips dismiss with a tap or the close
   button; nothing waits for an animation to finish before the next action works.
5. **Short, subtle, eased.** Loops take under 1.2 s per turn (spinner 1.1 s, bar sweep 1.1 s, skeleton breath 1.1 s). One-shots finish
   inside 1.5 s (wave 0.96 s, celebrate 1.3 s, pop 0.42 s, oops 0.36 s, stamp 0.42 s, peek 0.52 s). Character poses never loop,
   only the loading loop does. The numbers are asserted in code (`assertDurations`) and tested.
6. **Reduced motion.** With the OS "reduce motion" setting (apps: `AccessibilityInfo.isReduceMotionEnabled`, live; web:
   `prefers-reduced-motion: no-preference` wraps every animation, the same condition as Tailwind `motion-safe:`) Whirl is a still pose, the
   spinner is a still loop, bars show a static segment, the skeleton does not breathe, moments appear without fading.
7. **No flicker.** `WhirlSpinner` stays invisible for the first 300 ms (space reserved, no layout jump). Where a spinner is rendered
   conditionally use `useDelayedVisible(loading)`: shows after 300 ms, then stays at least 400 ms.
8. **No sound.** The kit never plays audio. Haptics are left to the caller and, for celebrations, once per event only.
9. **"Show Whirl" switch.** Settings of both apps and a `localStorage` flag on the web (`whirl.settings.v1`). Off removes every
   decorative Whirl (greetings, empty states, tips, celebrations, the Whirl riding a progress bar, the skeleton's peek). Loading
   indicators stay, as the plain four-part loop with no character. Default is on.
10. **Never where it must be fast or readable.** Not in: the stamp card itself, tables, payment or SumUp till flows, QR scan or
    stamp-award screens, the card designer and QR poster artwork, admin pages, anything customer-facing that carries a shop's
    own brand. Not in the sign-in and password screens' fields area (above the fields only, and never pushing a button off screen).
11. **Light and dark.** Art is chosen in one place, `useWhirlVariant()`, never by guessing from a colour. The dark art has a cream
    outline and the reversed brand colours.
12. **Accessibility.** Decorative Whirl is hidden from screen readers. Give `label` only when he carries meaning. Spinner and bar are
    `progressbar` with a label and busy state.
13. **Small sizes.** Below 48 px the plain `mini` face is used automatically. Below 32 px use the logo mark, not Whirl.

## Where Whirl is wired (Phase 2, branch `claude/whirl-everywhere`)

- **Spinners:** every `ActivityIndicator` in both apps is now `WhirlSpinner` (on coloured buttons it takes the button's text colour, in four strengths). Web: the upload drop zone and the toast loading icon.
- **Bars:** Business app AI research report, AI summary and card-designer photo upload show `WhirlProgress`.
- **Skeletons:** both apps' `SkeletonBlock`/`SkeletonScreen` and the website's `PageSkeleton` use the warm breathing shapes; a tiny Whirl appears only after 2.5 s.
- **Pull-to-refresh:** iOS shows the turning loop (native wheel hidden); Android keeps the native control tinted in the brand colours.
- **Intro:** a waving Whirl above the wordmark in both apps' `AppIntro` (already skipped with reduced motion).
- **Home:** shopper signed-in home (peek beside the greeting), guest home (wave), Business home (peek beside the shop name). Each leaves an empty marked spot for the future "Ask Whirl" row; nothing fake is drawn.
- **Celebration:** shopper reward-unlocked screen (dark art, once per new reward via the existing seen-reward memory).
- **Errors and offline:** `showAlert` error pop-ups show an oops Whirl in place of the "!" badge (both apps); outage banner shows a 32 px oops Whirl instead of its dot; website 404 and owner load error.
- **Permission pop-up:** Business push prompt shows a wave via `showAlert(..., { whirl: 'wave' })`.
- **Empty states:** Business members, announcements and rewards (sleepy); website Rewards (sleepy) and Favourites (think). The shopper empty tabs, sign-up, onboarding and "you're live" screens were wired earlier by the mascot branch and now go through the kit (switch, dark art, animation).
- **Tips:** Business tour tips get a small pointing Whirl unless the screen already has its one moment.
- **Sign-in / lock screen (Business):** the "↻" badge becomes Whirl; it returns when the switch is off.
- **Settings:** "Show Whirl" switch in both apps, the website profile and the owner Settings help tab.
- Status banners use their own slot (`status-banner`), because they are a system strip and not screen content.
- Not touched on purpose: stamp card, scan and stamp-award screens, SumUp/payment flows, card designer and QR poster artwork, admin pages, shop pages, map.

## Using it (for the next session)

```tsx
// apps (once, near the root): isDark from the app theme, storage = a small SecureStore adapter
<WhirlProvider isDark={isDark} storage={secureStoreAdapter}> ... </WhirlProvider>

<WhirlSpinner />                                          // replaces ActivityIndicator
<WhirlProgress progress={0.4} label="Uploading" />        // or no progress for the sweep
<WhirlMoment screenId="rewards" momentId="rewards-empty" pose="sleepy" line="Nothing to claim yet." layout="stack" effect="peek" />
<WhirlMoment screenId="home" momentId="tip-ping" pose="point" line="Tap the bell for pings." once />
<Whirl pose="celebrate" size={200} effect="celebrate" />   // call only if shouldCelebrate(rewardId)
```

Web: same names from `@/components/whirl-kit` (no provider needed). A Settings screen adds a switch bound to
`const { showWhirl, setShowWhirl } = useWhirlSettings()`.

## Regenerating the art

`python brand/mascot/src/build_kit.py` rewrites `packages/whirl/art.generated.ts` (layers, pivots, mini set, loop blades) and the
flat review SVGs in `brand/mascot/svg/kit/`. The hand-written shapes live in `brand/mascot/src/build.py`.

## Not verified

Native components are type-checked and written to the Reanimated 4 / react-native-svg API but have **not been run on a device**.
The web kit was viewed in a browser (light and dark, switch on and off). Timings are set from the plan and not yet judged on a phone.
