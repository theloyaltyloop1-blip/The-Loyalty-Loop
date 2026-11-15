# Onboarding voice: rewritten script (concept)

Status: **proposal only. No app or website code has been changed.** Old lines are quoted from the code on `claude/reel-release` (5736301) so you can see what each one replaces. Where a line is a heading and a sub-line, they are shown together.

Mascot names below are placeholders: `[M]` means "the chosen mascot" (Dot, Whirl or Pip, see `brand/mascot/README.md`). Poses: wave, stamp, celebrate, sleepy, think, thumbs.

Rules used for every line: short, warm, a bit cheeky, no jargon, UK English, plain claims only. No numbers, speeds or promises that are not already true in the product (so "free" is kept because the sign-up copy already says it; "in minutes" is dropped because we cannot show it is true for everyone).

---

## A. Shopper first-run flow

The shopper app is browse-first now: no intro slides. The first-run moments are the sign-up screen that appears when someone taps Join, the confirm-email message, the one-time ping pop-up after the first join, and the three empty screens.

| # | Screen (file) | Old | New | Mascot |
|---|---|---|---|---|
| 1 | Sign-up headline (`apps/shopper/App.tsx` ~560; web `Signup.tsx` 79) | **Collect stamps at your local shops** | **Your local shops want to say thanks.** | `[M]` wave, top of screen |
| 1b | Sign-up sub-line | A free account keeps your cards, stamps and rewards together. No card to carry. | A free account keeps your stamps and rewards in one place. Nothing to carry, nothing to lose in a coat pocket. | (same) |
| 1c | Sign-up when arriving from a shop's Join button (reason line) | Make a free account to save your {shop} card. We'll join it for you straight away. | One quick account and your {shop} card is yours. We'll join it for you the moment you're in. | `[M]` thumbs |
| 2 | Sign-up button | Create shopper account | Let's go | none (button) |
| 2b | Switch link | New here? Create an account / Already have an account? Sign in | New here? Make an account / Been here before? Sign in | none |
| 3 | Confirm-email message (alert title and body) | Nearly there, {name} / Check your email and confirm your address, then sign in to start collecting rewards. | Nearly there, {name}. / Pop over to your inbox, tap the link, then come back and sign in. Your first stamp is waiting. | `[M]` think |
| 4 | Ping pop-up after first join (`pingTitle` / `pingCopy`) | Get a ping when you earn a reward? / We'll tell you when a reward is ready and when your shops post news. Nothing else. | Want a nudge when a reward is ready? / We'll tap you when a reward is ready and when your shops have news. That's all. Promise. | `[M]` wave |
| 4b | Ping pop-up buttons | Not now / Turn on | Not now / Yes please | none |
| 5 | Empty "Rewards" tab | Your unlocked rewards will appear here. Keep collecting! | Nothing to claim yet. Get a few stamps and your first reward lands right here. | `[M]` sleepy |
| 6 | Empty "Favourites" | Tap the heart on a shop's page to save it here. | No favourites yet. Tap the heart on any shop you like and it'll live here. | `[M]` think |
| 7 | Empty "Announcements" | No announcements yet. Check back soon. | Quiet in here. When your shops have news, you'll see it first. | `[M]` sleepy |
| 8 | First reward earned (moment, new, uses existing event) | (no dedicated line today) | You've earned a reward. Go on, treat yourself. | `[M]` celebrate |

Same number of steps as today: sign-up, confirm email, ping pop-up, three empty states. Row 8 is an optional extra moment, listed separately so you can leave it out.

---

## B. Business-owner flow

### Business app (`apps/retailer/src/shop-onboarding.tsx`)

The wizard has four steps (shown as "Step n of 4"; the account step is step 4), then a "You're live" screen. A custom-programme path swaps the rewards step for the AI programme designer.

| # | Screen | Old | New | Mascot |
|---|---|---|---|---|
| 1 | What kind of shop | **What kind of shop is it?** / Pick the closest match. We'll suggest rewards your regulars will actually want. | **What kind of shop are we dealing with?** / Pick the closest match. We'll suggest rewards your regulars will actually like. | `[M]` wave |
| 1b | "Something different" tile | Something different / Describe your own programme and our AI sets it up | Something different / Tell us your idea and our AI sets it up. | none |
| 2 | Shop name | **What's your shop called?** / This is what customers see at the top of their loyalty card. | **What do we call you?** / This goes at the top of your customers' loyalty card. | `[M]` think |
| 3 | Rewards (standard) | **Your rewards** / We've filled these in for {shop}. Change anything, then tap Looks good. | **Here's what we'd give them.** / We've filled these in for {shop}. Change anything you fancy, then tap Looks good. | `[M]` stamp |
| 3b | Rewards (membership levels) | **Your membership levels** | **Your membership levels** (unchanged: it is already clear) | none |
| 3c | Custom programme | **Design your programme** / Describe it like you'd explain it to a customer. Keep changing it until it's right. | **Tell us how it should work.** / Explain it the way you would to a customer. Keep tweaking until you're happy. | `[M]` think |
| 4 | Save your shop (account) | **Save your shop** / {shop} is ready. A free account keeps it safe and puts it live. | **Nearly done.** / {shop} is ready. A free account keeps it safe and puts it live. | `[M]` thumbs |
| 4b | Save button | Save and go live (or Save and design it) | Save and go live (or Save and design it) (unchanged) | none |
| 4c | Check your email | **Check your email** / We've sent a link to {email}. Tap it, then sign in. {shop} is saved on this phone and goes live as soon as you're in. | **Check your email.** / We've sent a link to {email}. Tap it, then sign in. {shop} is saved on this phone and goes live as soon as you're in. | `[M]` sleepy (waiting) |
| 5 | You're live | **You're live!** / Customers can join {shop} now. This is their card: | **You're open for stamps!** / Customers can join {shop} now. This is the card they'll see: | `[M]` celebrate |
| 5b | Next buttons | Print your QR poster / Scan your first customer / Go to my dashboard | Print your QR poster / Scan your first customer / Take me to my dashboard | none |
| 6 | Push pop-up (4s after first sign-in) | Get a ping about your shop? | Want a nudge when something happens in your shop? | `[M]` wave |

### Website sign-up (`apps/web/src/pages/Signup.tsx`)

| # | Screen | Old | New | Mascot |
|---|---|---|---|---|
| 1 | Owner sign-up headline | Set up your shop's loyalty card | Give your regulars a reason to come back. | `[M]` wave |
| 1b | Owner sub-line | Free to start, no hardware needed. Name your shop, pick a reward and you're live in minutes. | Free to start, no hardware needed. Name your shop, pick a reward, and you're ready to hand out stamps. | (same) |
| 2 | Owner switch link | Signing up as a business? / Sign up as a Loyalty Loop Retailer | Running a shop? / Sign up as a business | none |
| 3 | Shopper sign-up on the web | Collect stamps at your local shops / Join a shop's card for free and earn the rewards it offers. No card to carry. | Your local shops want to say thanks. / Join a shop's card for free and earn the rewards it offers. Nothing to carry. | `[M]` wave |
| 4 | Check-email screen | Nearly there, {first name} | Nearly there, {first name}. | `[M]` think |

The website's own onboarding wizard (`apps/web/src/pages/owner/Onboarding.tsx`) mirrors the Business app step for step ("What kind of shop is it?", "What's your shop called?", "Design your programme", "You're live!"), so use the same lines from the table above.

---

## C. Voice guide (5 lines)

1. **Talk like the nice person behind the till.** Warm, direct, a little cheeky. Never corporate, never a sales pitch.
2. **Do:** use "you" and "your shop", short sentences, plain words. **Don't:** use jargon ("programme engine", "loyalty ecosystem", "engagement") or exclamation marks in a row.
3. **Do:** one light joke per screen at most, and only where nothing is going wrong. **Don't:** joke about money, errors, refunds or anything that has gone wrong. There, be calm and clear.
4. **Do:** say exactly what is true ("free", "no hardware needed"). **Don't:** invent numbers, speeds or promises ("in 60 seconds", "double your sales").
5. **Do:** keep UK English (programme, colour, favourite, "nudge", "have a go"). **Don't:** use US spellings, slang that dates fast, or emoji in running text. The mascot does the emoting.

---

## D. What is verified and what is not

- Old lines: copied from the code on `claude/reel-release` at 5736301; I did not run either app to confirm every string is still on screen in that exact place.
- New lines: **proposed copy only.** Not wired into the apps or website and not reviewed by the owner.
- Some old strings contain `{shop}`, `{name}` and `{email}` placeholders that the code fills in; the new lines keep them in the same places.
- Not covered: push-notification copy, email copy, error messages, any other language.
