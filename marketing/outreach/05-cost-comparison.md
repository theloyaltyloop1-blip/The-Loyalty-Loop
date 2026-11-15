# 5. Reel cost claims vs what I could verify (2026-11-15)

Method: web search snippets only (I did not open vendors' own pricing pages), so every figure is "reported", and sources disagree on several. Re-check each vendor's pricing page before budgeting. The reel is a paid ad (#ad) for treg.

| Reel claim | What I found | Verdict |
|---|---|---|
| Apollo $65/mo | Reported 2026 tiers: Free $0; Basic $49 annual / about $65 monthly; Professional $79 annual / $99 monthly; Organization $119 annual, 3-seat minimum. Older sources list other figures. | **Plausible** (matches the monthly-billed Basic price). |
| Clay $185/mo | Reported Launch from $185/mo (some sources $167 annual); Growth from $495; repriced March 2026, a plan removed June 2026. | **Plausible.** |
| Instantly $107/mo | Reported Growth $47, Hypergrowth $97, Light Speed $358 (monthly billing; about 20% less annual). Add-ons (verification credits, mailboxes, lead data) are extra. | **Not matched**: no single plan equals $107; may be a plan plus add-ons. Unverified. |
| "Over $350/mo" total | 65 + 185 + 107 = 357. | Arithmetic only as good as the Instantly figure. |
| Leads under $4 per 1,000 | Apify Store Google Maps actors: from $1.50 per 1,000 places (compass crawler), $2.10 to $5 tiered (extractor), email-extractor actors about $3 to $4 per 1,000 leads. | **Plausible for Apify-type tools.** I found **nothing** about treg itself (no pricing, no terms). |
| About $35 per 1,000 emails via Cloudflare | Cloudflare's pricing page (via search result) lists 3,000 emails/month included, then **$0.35 per 1,000**, needs a paid plan, sending in public beta since April 2026. Amazon SES about $0.10 per 1,000. | **Doesn't match**: about 100 times the Cloudflare list price. Either misquoted, a different unit, or bundled costs. Unverified. |

Other relevant real prices: Resend (what the repo already uses) free 3,000/month with 100/day cap; Pro about $20 for 50,000/month, per third-party summaries; confirm on resend.com. This account's Apollo connection shows 200 lead credits/month, 0 export credits, 0 used.

## What the numbers miss

- The costs that matter are not list prices: deliverability (domain reputation), legal exposure, and time to review drafts.
- Cheap lead credits make it cheap to email many people who legally cannot be emailed (sole traders) or who are not a fit.
- At 5 to 15 emails a day, the reel's whole price comparison is irrelevant: 15/day is about 330 a month, inside Resend's free allowance and Cloudflare's included 3,000.

## Recommendation

**No paid outreach tool is worth it at The Loyalty Loop's size.** Do instead:
1. Start with `requested_shops` (free, demand-led, already built).
2. Use the existing Places key plus manual reading of shop websites and free Companies House checks.
3. Send via the existing Resend account from a dedicated subdomain, capped, human-approved. Cost about £0.
4. Use Apollo's free tier only to look up a few company role contacts if a specific target needs it, after the owner OKs any credit use; do not buy a plan.
5. Revisit tools only if outreach demonstrably produces signups at 15/day and the limiting factor becomes sourcing or sending, not review time. At that point compare treg/Apollo Basic against doing it by hand, with a real legal check first.
Paying for Clay or Instantly (cold-email machinery built for volume and mailbox rotation) is the wrong direction: it is the volume problem 02 deliberately avoids.
