# 2. Outreach workflow (design only; nothing here sends)

## What the reel does vs what we change

Reel: scheduled routine -> bulk lead database -> enrich/verify emails -> Claude writes one message per business -> bulk send.
Ours: same shape, but **small, demand-led, human-approved, and lawful**. The reel's hidden risk is the scale: 1,000/day is how domains get blocklisted and how PECR fines happen. We copy the useful part (Claude personalises from facts, and runs the research on a schedule) and drop the bulk send.

## Sources we may use

| Source | Use | Cost / terms (honest) |
|---|---|---|
| `requested_shops` / `shop_requests` (own data) | **First priority.** Shops shoppers already asked for. Truthful hook, warm. | Free. Already designed (`docs/SHOP_REQUESTS_PLAN.md`), live. |
| Google Places API (key already used by `shop-request-search`) | Find shops by category + area, get `place_id`, website. | Paid per request by Google. Existing design keeps **only `place_id`** because of Places caching rules; keep that: fetch name/website transiently, do not copy listing data into a lead table. Scraping Google Maps via Apify is against Google's terms **[verify]** and is not used. |
| The shop's own website / contact page | Read a published business address (`hello@`, `info@`) and facts (menu, opening hours). | Free. Fair, and it is the shop's own publication. Needs a person or Claude reading, not a harvester. |
| Companies House | Corporate vs sole trader check. | Free public data/API. |
| Apollo (owner's MCP connection) | Optional lookup of company role contacts. | See below. |
| Apify (owner's MCP connection) | Not recommended for this. | See below. |

**Apollo, as connected here:** I read only the credit summary (no spend). The account shows lead credits 200/month (0 used), direct-dial 160, export credits 0, AI credits 5,000, cycle 2 Nov to 2 Dec 2026. Export credit = 0 suggests the free tier restricts export. Apollo is a US B2B database of mostly larger/professional companies, so its coverage of corner cafes and barbershops is probably thin **[unverified; not tested because testing spends credits]**. Its terms on cold email and use of its data in UK/EU are not verified.
**Apify:** connected, not run. The Google Maps scrapers on the Store start at about $1.50 to $5 per 1,000 places (varies by actor and tier; see 05). Third-party scrapers of Google Maps inherit Google's terms risk and add email scraping, which is the exact "harvest" pattern PECR/GDPR guidance warns about. No run was made, no credits spent.

## Daily routine (when built)

1. **Pick (Claude, scheduled, read-only):** take up to N `ready` rows from `requested_shops` first, then category/area leads from Places. Skip any `place_id` or domain on the suppression list.
2. **Classify:** Companies House look-up -> `entity_type` (`company`, `sole_trader_or_partnership`, `unknown`). Sole/unknown never get the email template; they get the "in-person/letter/inbound only" lane.
3. **Find contact:** only a published role address from the shop's own site, or a contact form. Record `email_source_url`. No guessing, no bought email.
4. **Verify the address:** syntax + MX check. Paid verifiers (credits) are not worth it at this volume; a bounce on a 10/day cap is cheap, but stop at the first bounce threshold.
5. **Draft (Claude):** pick a template from 03 and fill only verifiable facts (shop name, town, shopper request count, the shop's own listed category). Store as `drafted` with the final text and a one-line "why we think this is relevant".
6. **Human approval (owner or a delegate, mandatory):** an admin screen (or a sheet, see 04) lists drafts. Approve / edit / reject / suppress. Claude cannot flip `approved`; only an admin session can. Re-read the shop's website for each approval.
7. **Send (not built):** a function, running only on `approved` rows, re-checks suppression, applies the daily cap, sends via the existing Resend account from a dedicated subdomain, writes the result.
8. **Handle replies:** a person replies. Opt-outs and bounces go to suppression within minutes. One follow-up, 14 days later, only if no reply and the shop request count grew by 3+ (matches the shop-request plan).

## Caps and domain protection

- Start at **5 sends/day for the first week, max 15/day** thereafter, weekdays only, spread through the day. A global kill switch (`outreach_paused`).
- Send from a subdomain, e.g. `hello@invite.the-loyalty-loop.com`, **not** the main domain that carries login/reset emails and the product's own mail (a blocklisting must not break password resets). Set up SPF, DKIM, DMARC for it. Domain choice and DNS are the owner's call; nothing set up.
- Auto-pause if: any spam complaint, bounce rate above 2% over the last 50 sends, or two opt-outs in a day. A person investigates before restart.
- Plain text or very light HTML, no tracking pixels or link rewrites (also helps the LIA).
- At most 1 email per business, plus 1 follow-up, ever. No re-contact after "no".

## What Claude may and may not do in this workflow

May: research from public pages, classify, draft, log, report stats. May not: approve, send, edit suppression downward, sign up for services, spend credits without the owner's yes in chat, or message anyone.
