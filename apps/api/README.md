# Card-linked stamp API

Standalone Node/TypeScript, Express 5, PostgreSQL and Prisma service. `POST /webhooks/fidel` accepts Fidel Select **transaction.auth** payloads and credits provisional stamps. This foundation uses its own database; it does not update the existing Supabase/QR loyalty accounts or app screens. `ARCH_PLAN.md` was absent; these notes record the implementation decisions for architectural review.

## Run

Use Node 22.12+ and a dedicated PostgreSQL database. From `apps/api`:

```sh
npm ci
# Copy .env.example to .env and supply the database URL and Fidel settings.
npm run db:generate
npm run db:migrate
npm run dev
```

Register the exact public HTTPS URL ending in `/webhooks/fidel` for a **transaction.auth** subscription. Set `FIDEL_WEBHOOK_SECRET` to that subscription's `secretKey`, not the Fidel API key. `FIDEL_WEBHOOK_URL` must match the registered URL exactly; it is never inferred from request/proxy headers. Use separate secrets, databases, and deployments for test/live programs. Do not put secrets in frontend environments.

Trusted provisioning must create a `User`, `Merchant` with a positive `stampThresholdMinor`, `MerchantLocation` mapping the enrolled Fidel location and program, and `LinkedCard` mapping the enrolled Fidel card and program to that user. The webhook cannot create these mappings or accept a threshold/customer ID from payload metadata. No PAN, expiry, or card verification data is stored.

The migration creates the private `card_linked` schema with foreign keys, indexes, uniqueness and check constraints. Keep it outside browser-accessible APIs. In production, use a separate migration owner and a runtime role with schema usage, SELECT on mapping tables, SELECT/INSERT on `Transaction` and `StampLedger`, and SELECT/INSERT/UPDATE on `StampBalance`. Provisioning uses a separate trusted role.

## Amounts and balances

Fidel sends `amount` in **major units**: `12.50` GBP means **1,250 pence**, not 12 pence. Lossless JSON parsing retains the decimal token; conversion and all storage/calculation use `bigint`/PostgreSQL `BIGINT`. This initial adapter accepts GBP, plain positive decimal numbers with at most two fractional digits, and amounts within signed 64-bit range. Unsupported currencies, scientific notation, excess decimal precision and refunds fail closed.

Whole stamps per purchase are `amountMinor / merchant.stampThresholdMinor` using integer division. At a 500p threshold, 499p earns 0, 500p earns 1 and 1,250p earns 2. Remainders do not carry between purchases. Balances are per user and merchant; multiple mapped cards/locations share that balance. The applied threshold is snapshotted on each transaction.

Authorisations are not final settlement. Responses and storage explicitly mark these stamps **provisional**. This stage provides no redemption, clearing reconciliation, reversal/refund logic, notifications or account-onboarding endpoints. Implement reconciliation before making stamps spendable; do not subscribe clearing/refund events to this endpoint.

Successful response (integers serialized as strings to preserve precision):

```json
{"status":"provisional","duplicate":false,"stampsEarned":"2","provisionalStampBalance":"2"}
```

`stampsEarned` on a duplicate describes the original award, not an additional award. The balance reflects the database read at processing time.

## Verification and atomicity

1. Accept JSON only, cap the raw body at 64 KiB, reject compressed bodies.
2. Reject missing/ambiguous signature headers and timestamps more than five minutes in the past or future.
3. Compute HMAC-SHA256 twice over raw bytes + configured URL + timestamp, Base64 encoding each digest; compare in constant time.
4. Only then parse/validate the payload, account/program, transaction state, IDs and amount.
5. Resolve trusted card/location mappings and calculate stamps.
6. In one bounded database transaction, insert the unique provider transaction, increment the balance atomically, and insert its unique ledger entry. Respond only after commit.

`UNIQUE(provider, externalId)` is the concurrency guard, independent of delivery headers. After a racing unique violation the losing transaction rolls back, then returns the winner's committed award. Different purchases use a database-native increment to prevent lost updates. Reusing an ID with different normalized award data returns 409. Unknown/inactive cards and unknown locations leave no transaction behind, allowing replay after provisioning. No raw payloads are persisted or logged.

| HTTP | Meaning |
| --- | --- |
| 200 | Committed award or matching duplicate |
| 400 | Invalid JSON/UTF-8 or malformed body |
| 401 | Invalid signature/timestamp |
| 409 | Transaction ID conflicts with prior award data |
| 413 / 415 | Body too large / unsupported media or encoding |
| 422 | Invalid/unsupported transaction, wrong program or unknown mapping |
| 503 | Persistence failure; no acknowledgement of success |

Fidel retries failed deliveries for a limited period. Monitor non-2xx responses and replay failed events from Fidel after resolving configuration/mapping errors. This handler does only bounded database work synchronously; future notifications must use an outbox committed with the award and an asynchronous worker.

## Local signed request

Set a local URL such as `http://localhost:3001/webhooks/fidel` and a development-only secret in `.env`. After provisioning matching development mappings, set:

```dotenv
MOCK_CARD_ID=<enrolled-or-local-fixture-card-uuid>
MOCK_LOCATION_ID=<enrolled-or-local-fixture-location-uuid>
MOCK_AMOUNT_GBP=12.50
# Reuse this ID to test duplicate handling; omit for a new UUID each run.
MOCK_TRANSACTION_ID=<transaction-uuid>
```

Run `npm run mock:webhook`. It sends a synthetic documented-shape payload with a valid signature. This is not a real payment or evidence of a live Fidel integration. Automated integration tests provision their own synthetic mappings and need no credentials.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run db:validate
npm run build
```

Integration tests start a disposable PostgreSQL cluster under `.test-postgres`, apply the actual migration, and verify concurrent duplicates, concurrent distinct purchases, unknown mappings, conflicting replays, check constraints and rollback after a late ledger failure. They never use `DATABASE_URL`. The test binary needs normal process-launch permissions and a non-root OS account. The embedded PostgreSQL package is development-only. Patched `deepmerge-ts` and `mysql2` overrides address advisories in Prisma's CLI dependency tree.

Provider references: [Fidel signature and webhook contract](https://docs.fidelapi.com/docs/select/webhooks/), [transaction lifecycle](https://docs.fidelapi.com/docs/select/transactions). Confirm your subscription/product payload against these before live rollout; no provider credentials or live webhook registration were supplied or used.
