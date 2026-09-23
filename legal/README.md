# Policy documents

`generate.js` is the source for all six PDFs. Run `node legal/generate.js` from the
project root; it writes identical copies to `legal/` and `apps/web/public/legal/`.
The website and native apps link to those public URLs. Owner onboarding emails
fetch the PDFs from the deployed website, so local regeneration does not update
already-sent attachments or the live site.

## 23 September 2026 revision

Adds optional Fidel consent, card and transaction data, spend rewards and refund
adjustments, withdrawal and deletion, merchant enrolment permission, provider
roles and the distinction between usage analytics and transaction processing.
Existing programmes and unshipped features are described as a rollout.
New web terms/privacy acceptance rows use `2026-09-23`; historical acceptances
are preserved. Acceptance of a privacy notice is not card-monitoring consent.

## Release review still required

- Product owner: confirm the legal controller/entity name and contact details.
  The existing public support address, `developer@the-loyalty-loop.com`, is
  retained. The trading name alone may not identify the legal controller.
- Confirm actual provider agreements, controller/processor roles, lawful bases,
  transfer safeguards and retention criteria against operational practice. No
  fixed retention period, deletion SLA or provider contract was invented here.
- Obtain and record existing merchants' acceptance of the enrolment permission
  before declaring their consent to Fidel. Updating PDFs does not collect it.
- Present material policy changes to existing users. The current change updates
  new acceptance records, not a notice/reacceptance workflow for existing users.
- Verify the selected SDK's actual consent text and link these notices there.
  Fidel's current v4 documentation describes a Single.id flow different from
  the configuration in CARD_LINKING_PLAN.md; resolve this in CL-1.
- Ship and verify card unlink, provider-removal retries and complete account
  deletion before enabling real shopper card linking. Policy text alone does
  not implement these controls. Confirm refund reconciliation and manual-entry
  limits against the planned rollout.
- Deploy the website to publish these files. No deployment or email dispatch
  was performed during drafting. Publication was subsequently authorised by the
  product owner; see the shared CLAUDE_HANDOFF.md for deployment evidence.

## Evidence consulted

Repository: `ARCH_PLAN.md` sections 0a/0b, `CARD_LINKING_PLAN.md` decisions P1-P7,
the Fidel webhook, web usage analytics, cookie choice and legal acceptance code.

Official sources checked on 23 September 2026:

- [Fidel SDK v3](https://docs.fidelapi.com/docs/select/sdks/web/v3/)
- [Fidel SDK v4](https://docs.fidelapi.com/docs/select/sdks/web/v4/)
- [Fidel privacy notice](https://www.fidelapi.com/legal/privacy)
- [Fidel FAQ](https://www.fidelapi.com/faq)
- [ICO: privacy information to provide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)

These are implementation-aligned policy drafts for release review, not a finding
that the planned integration or existing policies satisfy every legal obligation.
