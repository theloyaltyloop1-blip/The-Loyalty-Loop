import assert from "node:assert/strict";
import { test } from "node:test";
import { syncConnection } from "./pos-sync.ts";
import { buildAuthorizeUrl, listSales } from "./sumup.ts";

const MIN = 60 * 1000;
const NOW = Date.UTC(2026, 9, 19, 12, 30, 0);
const iso = (minsAgo) => new Date(NOW - minsAgo * MIN).toISOString();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

const conn = {
  id: "conn1", businessId: "biz1", merchantCode: "MH4H92C7",
  accessToken: "tok", refreshToken: "ref", tokenExpiresAt: NOW + 30 * MIN, syncCursor: NOW - 60 * MIN,
};

function fakeDb({ scans = [], existing = [], creditResult = { ok: true } } = {}) {
  const sales = new Map(existing.map((s) => [s.providerTxnId, { ...s }]));
  const log = { connectionPatches: [], saleUpdates: [], refunds: [], credits: [], expired: [] };
  const db = {
    log, sales,
    async updateConnection(_id, patch) { log.connectionPatches.push(patch); },
    async recordSales(_biz, incoming) {
      for (const s of incoming) {
        if (!sales.has(s.providerTxnId)) {
          sales.set(s.providerTxnId, {
            id: `sale-${s.providerTxnId}`, providerTxnId: s.providerTxnId, state: s.initialState,
            refundedPence: 0, amountPence: s.amountPence, occurredAt: s.occurredAt,
          });
        }
      }
      return incoming.map((s) => sales.get(s.providerTxnId));
    },
    async updateSale(id, patch) {
      log.saleUpdates.push({ id, patch });
      for (const row of sales.values()) if (row.id === id && patch.state) row.state = patch.state;
    },
    async applyRefund(id, pence) { log.refunds.push({ id, pence }); },
    async openSales() { return [...sales.values()].filter((s) => s.state === "open"); },
    async pendingScans() { return scans; },
    async setScanStatus(id, status) { log.expired.push({ id, status }); },
    async creditSale(saleId, scanId) {
      log.credits.push({ saleId, scanId });
      if (creditResult.ok) for (const row of sales.values()) if (row.id === saleId) row.state = "matched";
      return creditResult;
    },
    async maxAutoPence() { return 20000; },
  };
  return db;
}

const history = (items) => async () => json({ items, links: [] });
const item = (id, minsAgo, extra = {}) => ({
  transaction_id: id, amount: 42.5, currency: "GBP", timestamp: iso(minsAgo), status: "SUCCESSFUL",
  refunded_amount: 0, ...extra,
});
const deps = (db, fetchImpl) => ({ db, fetch: fetchImpl, now: NOW, clientId: "id", clientSecret: "secret" });

test("a new sale beside one scan is credited, amount converted to pence", async () => {
  const db = fakeDb({ scans: [{ id: "scan1", customerId: "alice", scannedAt: NOW - 20 * MIN }] });
  const summary = await syncConnection(deps(db, history([item("T1", 19)])), conn);
  assert.equal(summary.matched, 1);
  assert.deepEqual(db.log.credits, [{ saleId: "sale-T1", scanId: "scan1" }]);
  assert.equal(db.sales.get("T1").amountPence, 4250);
  assert.ok(db.log.connectionPatches.at(-1).sync_cursor, "cursor advances after a clean pass");
});

test("syncing the same sale twice does not credit twice", async () => {
  const db = fakeDb({ scans: [{ id: "scan1", customerId: "alice", scannedAt: NOW - 20 * MIN }] });
  await syncConnection(deps(db, history([item("T1", 19)])), conn);
  await syncConnection(deps(db, history([item("T1", 19)])), conn);
  assert.equal(db.log.credits.length, 1);
});

test("non-pound and unsuccessful sales are never credited", async () => {
  const db = fakeDb({ scans: [{ id: "scan1", customerId: "alice", scannedAt: NOW - 20 * MIN }] });
  await syncConnection(deps(db, history([
    item("EUR", 19, { currency: "EUR" }), item("FAIL", 19, { status: "FAILED" }),
  ])), conn);
  assert.equal(db.log.credits.length, 0);
  assert.equal(db.sales.get("EUR").state, "ignored");
  assert.equal(db.sales.get("FAIL").state, "ignored");
});

test("a refund on a credited sale is applied through the refund path", async () => {
  const existing = [{ id: "s1", providerTxnId: "T1", state: "matched", refundedPence: 0, amountPence: 4250, occurredAt: NOW - 90 * MIN }];
  const db = fakeDb({ existing });
  const summary = await syncConnection(deps(db, history([item("T1", 90, { status: "REFUNDED", refunded_amount: 42.5 })])), conn);
  assert.equal(summary.refunds, 1);
  assert.deepEqual(db.log.refunds, [{ id: "s1", pence: 4250 }]);
});

test("a partial refund passes the refunded amount", async () => {
  const existing = [{ id: "s1", providerTxnId: "T1", state: "matched", refundedPence: 0, amountPence: 4250, occurredAt: NOW - 90 * MIN }];
  const db = fakeDb({ existing });
  await syncConnection(deps(db, history([item("T1", 90, { refunded_amount: 10 })])), conn);
  assert.deepEqual(db.log.refunds, [{ id: "s1", pence: 1000 }]);
});

test("a revoked refresh token marks the connection for reconnect and stops", async () => {
  const db = fakeDb();
  const expired = { ...conn, tokenExpiresAt: NOW - MIN };
  const summary = await syncConnection(deps(db, async () => json({ error: "invalid_grant" }, 400)), expired);
  assert.deepEqual(summary.errors, ["token_refresh_failed"]);
  assert.equal(db.log.connectionPatches[0].status, "needs_reconnect");
});

test("an expired token is refreshed, saved, and used", async () => {
  const db = fakeDb();
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(String(url));
    if (String(url).endsWith("/token")) return json({ access_token: "new", refresh_token: "newref", expires_in: 3599 });
    assert.equal(init.headers.Authorization, "Bearer new");
    return json({ items: [], links: [] });
  };
  await syncConnection(deps(db, fetchImpl), { ...conn, tokenExpiresAt: NOW - MIN });
  assert.equal(db.log.connectionPatches[0].access_token, "new");
  assert.equal(db.log.connectionPatches[0].refresh_token, "newref");
});

test("a SumUp outage records the error and leaves the cursor alone", async () => {
  const db = fakeDb();
  const summary = await syncConnection(deps(db, async () => json({}, 500)), conn);
  assert.equal(summary.errors.length, 1);
  assert.ok(!("sync_cursor" in db.log.connectionPatches.at(-1)));
});

test("a failed credit sends the sale to the owner instead of losing it", async () => {
  const db = fakeDb({
    scans: [{ id: "scan1", customerId: "alice", scannedAt: NOW - 20 * MIN }],
    creditResult: { ok: false, reason: "not_a_member" },
  });
  const summary = await syncConnection(deps(db, history([item("T1", 19)])), conn);
  assert.equal(summary.review, 1);
  assert.equal(db.sales.get("T1").state, "review");
});

test("history follows pagination links and keeps only payments", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return urls.length === 1
      ? json({ items: [item("A", 5)], links: [{ rel: "next", href: "limit=100&oldest_ref=abc&order=ascending" }] })
      : json({ items: [item("B", 4)], links: [] });
  };
  const sales = await listSales(fetchImpl, "tok", "MH4H92C7", new Date(NOW - 60 * MIN));
  assert.deepEqual(sales.map((s) => s.providerTxnId), ["A", "B"]);
  assert.ok(urls[0].includes("types%5B%5D=PAYMENT"));
  assert.ok(urls[1].includes("oldest_ref=abc") && urls[1].includes("types%5B%5D=PAYMENT"));
});

test("the authorize URL carries the state and read-only scopes", () => {
  const url = new URL(buildAuthorizeUrl("cid", "https://x.test/cb", "STATE1"));
  assert.equal(url.searchParams.get("state"), "STATE1");
  assert.equal(url.searchParams.get("scope"), "transactions.history user.profile_readonly");
});
