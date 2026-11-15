# 1. Lawful outreach design (UK first; Pakistan noted)

Status: design, 2026-11-15. Not legal advice. Items marked **[verify]** come from search snippets or my recollection, not from the primary source; get them checked (ICO pages, or a solicitor) before the first send.

## Markets the apps support

`apps/shopper/src/money.ts` (`FALLBACK_COUNTRIES`) and `supabase/migrations/20261018120000_countries.sql` seed exactly two countries: **GB** and **PK**. There is no EU country today, so GDPR means **UK GDPR + PECR** in practice. EU/ePrivacy rules would only matter if an EU country row is added; do not outreach to the EU until it is (each member state has its own rules; several require prior consent even for B2B).

## Rules that decide who can be emailed (UK)

| Recipient | PECR rule on unsolicited marketing email | Consequence for us |
|---|---|---|
| Limited company, LLP, (Scottish partnership) = "corporate subscriber" | The consent rule does not apply, but you must still identify yourself and give a valid opt-out (reg 23). | Can email, with the conditions below. |
| Sole trader, ordinary (England/Wales/NI) partnership = "individual subscriber" | Treated like consumers: needs prior consent; the "soft opt-in" needs a previous sale or negotiation, which a cold prospect does not have. | **Do not cold-email.** |
| Unknown | Unknown | Treat as individual subscriber. |

Practical effect: many cafes, salons and independent shops are sole traders. For them email is off the table by default. Source: ICO "Business-to-business marketing" **[verify; I read search snippets, not the page]**.

How to tell them apart (free, verifiable): look the trading name up on Companies House. A match for a Ltd/LLP with the matching address is a corporate subscriber. No match = sole trader/partnership = no cold email. Record the result in `entity_type` (see 04).

Also, per the ICO, an email address that names a person (`jane@bean-and-leaf.co.uk`) is personal data, so **UK GDPR applies on top of PECR** even for a company. A generic role address (`hello@`, `info@`) on the shop's own website is lower risk. **Never guess addresses** (firstname@ patterns) and never use purchased lists.

## UK GDPR basis: legitimate interests

Basis: legitimate interests (Art. 6(1)(f)), documented in a short LIA before the first send:
- Purpose: tell a local business about a free tool relevant to its trade.
- Necessity: a single, low-volume, relevant email is a reasonable way to do this.
- Balance: business contact at a business address, expected business topic, easy opt-out, no tracking pixels, no profiling beyond business type and location.
Keep the LIA in `marketing/outreach/` once written (a template is a follow-up; not drafted here).

Transparency (Art. 14): because we obtained the address from somewhere other than the person, the first email must say where we found it ("your public website/listing"), who we are and how to object. Put this in the email footer (templates in 03 do).

## Mandatory elements of every message

1. Sender identity: the real trading name and a contact address. **Open item:** the legal entity name, registered address and ICO registration number are not in the repo (searched `apps/web/src` and `docs/`; the legal PDFs are binary and were not read). The owner must supply them; placeholders `{{LEGAL_NAME}}`, `{{POSTAL_ADDRESS}}` are used in templates. Check the ICO fee registration (data controllers who market must normally pay the fee) **[verify]**.
2. A real reply address (`help@the-loyalty-loop.com` is already the support address in `Help.tsx`). No `no-reply`.
3. Opt-out: a plain "reply STOP / click here, and we will not contact you again", honoured immediately and permanently.
4. Honest subject line and content; no fake "Re:", no pretending to know the owner.
5. A link to the Privacy Notice (`/legal/privacy-notice.pdf` exists on the website). **The notice must cover prospect outreach before sending**; the current text was not reviewed here. **[open]**

## Suppression list (hard rule)

- One table, `outreach_suppressions`, keyed by normalised email, **and** by domain and Google `place_id`. Checked immediately before every send, not only when the lead is created.
- Added automatically on: opt-out reply/click, bounce, spam complaint, "wrong person", anyone who says no in any channel (including a DM), and anyone who joins the product (they are no longer a prospect).
- Never deleted; stores only the hash/normalised address needed to honour the objection (UK GDPR allows keeping the minimum to respect the objection).
- Matches `requested_shops.status = 'suppressed'` in `docs/SHOP_REQUESTS_PLAN.md`; the two must be kept in step (a suppressed `place_id` in either blocks both).

## Other channels

- **Social/DM:** The ICO treats direct messages on social media as "electronic mail" for PECR **[verify]**, so the sole-trader restriction applies to DMs too. Instagram's own terms and anti-spam systems also forbid automated or bulk DMs **[verify]**: DMs are manual, from the real account, a handful a day, and only to corporate-looking businesses or businesses that have contacted us first.
- **Phone:** out of scope. Screening would need TPS/CTPS checks.
- **Post and in person:** not PECR "electronic mail". Postal letters to a business address rely on UK GDPR legitimate interests and the right to object; in-person visits are the most natural route for sole-trader cafes and salons, with the shop's own staff.
- **Inbound is best:** the shop-request flow (shoppers ask for a shop) gives a demand-led reason to contact; it does not change PECR for sole traders, but "8 people near you asked for you" is a far stronger, truthful message than a cold pitch.

## Pakistan (PK)

- PECA 2016 s.25 covers unsolicited ("spamming") messages and expects an opt-out; PTA has enforced opt-out on promotional SMS **[verify; from search snippets]**.
- No enacted general data-protection law as of mid-2026 per what I found (the Personal Data Protection Bill is still a bill) **[verify]**.
- Recommendation: do **no** automated or cold email outreach in PK yet. Use in-person/introduced contact and WhatsApp opt-in (see `docs/WHATSAPP_PLAN.md`). Revisit with local advice.

## Hard stops (applies to every design in this folder)

- No purchased or third-party "verified" lists unless the vendor can state a lawful basis and source and we record it. Apollo records are third-party data: using them to email is a UK GDPR Art. 14 matter and is only acceptable for corporate role addresses with the LIA done.
- No sending from `onboarding@resend.dev` (what `send-winback-emails` uses today: a shared Resend test sender, fine for its job, wrong for outreach).
- No sending until the human-approval step (02) exists and the owner has said go.
