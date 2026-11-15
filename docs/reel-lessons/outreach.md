# Reel lessons: finding and inviting local shop owners (Connor Davis / treg, #ad)

Date: 2026-11-15. Branch/worktree: `claude/reel-outreach-6fa3aa`. Design only. **Nothing was sent, no sign-ups, no Apollo/Apify actions that spend credits, no migration applied, nothing committed.** The only Apollo call was a read-only credit summary.

## Deliverables (all in `marketing/outreach/`; `marketing/` did not exist and was created)

1. `01-lawful-outreach.md`: UK GDPR/PECR design, markets, suppression, sender identity.
2. `02-workflow.md`: workflow, sources, human approval, caps.
3. `03-templates.md`: 3 emails and 3 first-DMs (cafe, salon, independent shop).
4. `04-lead-tracking.md` + `DRAFT_outreach_tables.sql`: sheet first, table later; the SQL is deliberately outside `supabase/migrations/`.
5. `05-cost-comparison.md`: reel claims vs reported real prices, recommendation.

## Lessons applied

- Worth copying: a scheduled Claude routine that researches and drafts per-business messages from facts.
- Not copied: bulk volume, bought/scraped emails, tracking, "verify to avoid bounces" as the whole compliance story.
- **Biggest finding:** many cafes/salons/shops are sole traders, who PECR treats like consumers. Cold email to them is not allowed without consent. Email outreach is limited to limited companies/LLPs (check Companies House); sole traders get in-person, post, or inbound.
- **The repo already designed this:** `docs/SHOP_REQUESTS_PLAN.md` makes `requested_shops` the "warm leads" queue (option 1 outreach bot), with phase A "operator notified, a person sends" and phase B bot sends only to an address on the shop's own website, once, with one-click suppression. The new design extends that rather than replacing it, and keeps the "store only `place_id`" Places rule.
- Recommendation: no paid tool; free sources, existing Resend from a dedicated subdomain, cap 5/day then 15/day.

## What I could not verify

- Everything legal is from search snippets, not the primary ICO/legislation pages: corporate vs individual subscriber rules, DMs counting as electronic mail, ICO fee, Pakistan PECA s.25 and data-protection status. Marked **[verify]** in the files.
- All prices come from third-party summaries and search snippets (Apollo, Clay, Instantly, Apify actors, Cloudflare Email Service, Resend); sources conflict (e.g. Apollo/Clay monthly vs annual). treg: **no information found**.
- Instantly $107 and Cloudflare $35/1,000 from the reel do not match anything I found (Cloudflare list price about $0.35/1,000).
- Apollo and Apify terms of use (cold email, data use, scraping Google Maps) were not read. Apollo's coverage of independent shops was not tested (would spend credits).
- The company's legal name, postal address and ICO registration are not in the repo; the Privacy Notice PDF was not read, so whether it covers prospect outreach is unknown.
- Resend's acceptable-use stance on cold/prospecting email was not found.

## Open decisions for the owner

1. Legal entity name/address for the footer, and ICO registration.
2. Sending subdomain (suggested `invite.the-loyalty-loop.com`) and DNS.
3. Whether to build the approval screen and sender now, or run Phase 0 (sheet, manual sends by a person).
4. Update the Privacy Notice for prospect outreach before any send.
5. Pakistan: leave manual/WhatsApp-opt-in only.
