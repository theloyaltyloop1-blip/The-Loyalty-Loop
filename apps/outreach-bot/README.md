# Outreach bot

3-step cold email sequence + LinkedIn message queue. Every message has a CTA: **book a call** (`BOOKING_URL`) or **sign up** (`SIGNUP_URL`).

| Step | Email (day) | LinkedIn |
|---|---|---|
| 1 Pain points | day 0 | connection note (≤300 chars) |
| 2 Features & benefits | day 3 | pain-point DM, then features DM |
| 3 My story | day 7 | story DM |

The sequence stops for a lead once their status is `booked`, `replied`, `signed_up`, `unsubscribed` or `bounced`.

## Setup (Node 20.6+)
1. `cp .env.example .env` and fill it in (Resend key, verified sending domain, Calendly link).
2. `cp leads.example.csv leads.csv` and add leads.
3. Edit the `[bracketed]` story text in `templates.mjs` (email 3 + LinkedIn story DM).

## Daily run
```bash
node --env-file=.env bot.mjs email          # preview
node --env-file=.env bot.mjs email --send   # send (max DAILY_LIMIT)
node --env-file=.env bot.mjs linkedin       # writes linkedin-queue.md
node bot.mjs li-sent owner@shop.co.uk       # after sending each LinkedIn message
node bot.mjs mark owner@shop.co.uk booked   # when they book / reply / sign up
node bot.mjs status                         # funnel + book rate
```

## Notes
- **LinkedIn is semi-manual on purpose**: automated sending breaks LinkedIn's terms and gets accounts restricted. The bot writes the personalised messages + profile links; you paste and send.
- Use a separate sending domain/subdomain, warm it up (start at ~10/day) and set SPF/DKIM/DMARC in Resend.
- UK PECR/GDPR: B2B cold email to company addresses is OK with a clear opt-out (included in every email). Sole traders/partnerships count as individuals and need consent. Honour "stop" replies with `mark <email> unsubscribed`.
