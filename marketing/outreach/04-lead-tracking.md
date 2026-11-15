# 4. Lead tracking design

## Do we need a table?

- **Phase 0 (now, first 2 to 4 weeks): a sheet is enough.** At 5 to 15 leads a day a Google Sheet/CSV with the columns below and a "suppressed" tab works, as long as suppression is checked by hand. Use it to prove replies are worth the effort before building anything.
- **A table is warranted as soon as anything automatic sends**, because suppression must be checked by code, atomically, at send time. A sheet cannot guarantee that.
- Demand-led leads already live in `requested_shops`; do not copy them. The new table covers shops nobody requested.

## Columns (sheet = table)

| Column | Notes |
|---|---|
| id | uuid |
| place_id | Google place id, the only Places data stored (matches existing retention rule). Unique when set. |
| requested_place_id | optional pointer to `requested_shops.place_id` |
| business_name | as the business names itself publicly; shop's own name is not Google listing data when read from its website **[verify with Places terms]** |
| town, category | cafe / salon / shop |
| entity_type | `company`, `sole_trader_or_partnership`, `unknown` (Companies House check) |
| channel_allowed | `email`, `manual_dm`, `in_person_or_post`, `none`; derived from entity_type |
| contact_email, email_source_url | role address on the shop's own site only |
| lawful_basis | `legitimate_interests` + `lia_version`; or `consent` if they asked us |
| status | `new`, `drafted`, `approved`, `sent`, `replied`, `joined`, `declined`, `suppressed`, `bounced` |
| draft_subject, draft_body, template | what the human approved |
| approved_by, approved_at | admin user id; send function refuses if null |
| sent_at, follow_up_due | |
| suppression_status | `clear` / `suppressed`, reason and date; send-time check reads the suppression table, not this column |
| joined_business_id | set when they sign up |
| notes | |

Suppression is its own table so it outlives lead deletion: key = lowercase email, domain, place_id, or social handle.

## Retention and rights
- Delete unsent and declined leads after 90 days; keep only a suppression row.
- Any subject-access or erasure request: delete the lead, keep the suppression key.
- Document in the Privacy Notice (see 01, open item).

## Draft migration (NOT applied)
`marketing/outreach/DRAFT_outreach_tables.sql` is outside `supabase/migrations/` on purpose, so no tooling applies it. Admin-only RLS, no anon/authenticated grants, a trigger that stops `approved` unless `approved_by` is set. Review and move it into `supabase/migrations/` with a real timestamp only when the owner decides to build the sender.
