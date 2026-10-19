import assert from "node:assert/strict";
import { test } from "node:test";
import { matchSales } from "./pos-matcher.ts";

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 19, 12, 0, 0);
const sale = (id, minutes, amountPence = 4000) => ({ id, amountPence, occurredAt: T0 + minutes * MIN });
const scan = (id, customerId, minutes) => ({ id, customerId, scannedAt: T0 + minutes * MIN });
const at = (minutes) => T0 + minutes * MIN;

test("one scan and one sale close together match", () => {
  const out = matchSales([sale("s1", 2)], [scan("c1", "alice", 0)], { now: at(3) });
  assert.deepEqual(out, [{ kind: "match", saleId: "s1", scanId: "c1", customerId: "alice" }]);
});

test("a scan after the sale still matches within the window", () => {
  const out = matchSales([sale("s1", 0)], [scan("c1", "alice", 4)], { now: at(5) });
  assert.equal(out[0].kind, "match");
});

test("two customers scanned for one sale: never auto-match, review once the window passes", () => {
  const sales = [sale("s1", 2)];
  const scans = [scan("c1", "alice", 0), scan("c2", "bob", 1)];
  assert.deepEqual(matchSales(sales, scans, { now: at(3) }), []);
  assert.deepEqual(matchSales(sales, scans, { now: at(13) }), [{ kind: "review", saleId: "s1" }]);
});

test("one customer scanned but two sales near it: neither is auto-matched", () => {
  const out = matchSales([sale("s1", 1), sale("s2", 3)], [scan("c1", "alice", 0)], { now: at(14) });
  assert.deepEqual(out.map((d) => [d.kind, d.saleId]), [["review", "s1"], ["review", "s2"]]);
});

test("a walk-in sale beside a scanner's sale is not credited to the scanner", () => {
  // Alice scanned and paid at minute 2, an unscanned shopper paid at minute 3.
  const out = matchSales([sale("alice-sale", 2), sale("walk-in", 3)], [scan("c1", "alice", 0)], { now: at(20) });
  assert.ok(out.every((d) => d.kind !== "match"));
});

test("duplicate scans by the same customer count as one customer", () => {
  const out = matchSales([sale("s1", 2)], [scan("c1", "alice", 0), scan("c2", "alice", 1)], { now: at(3) });
  assert.deepEqual(out, [{ kind: "match", saleId: "s1", scanId: "c2", customerId: "alice" }]);
});

test("a sale with no scan waits through the window, then needs nothing", () => {
  assert.deepEqual(matchSales([sale("s1", 0)], [], { now: at(5) }), []);
  assert.deepEqual(matchSales([sale("s1", 0)], [], { now: at(16) }), [{ kind: "no_scan", saleId: "s1" }]);
});

test("a scan with no sale expires only after the window and grace", () => {
  assert.deepEqual(matchSales([], [scan("c1", "alice", 0)], { now: at(14) }), []);
  assert.deepEqual(matchSales([], [scan("c1", "alice", 0)], { now: at(16) }), [{ kind: "expire_scan", scanId: "c1" }]);
});

test("a scan outside the window does not match", () => {
  const out = matchSales([sale("s1", 30)], [scan("c1", "alice", 0)], { now: at(60) });
  assert.deepEqual(out.map((d) => d.kind).sort(), ["expire_scan", "no_scan"]);
});

test("a sale over the auto limit goes to review even with a clean match", () => {
  const out = matchSales([sale("s1", 1, 90000)], [scan("c1", "alice", 0)], { now: at(12), maxAutoPence: 20000 });
  assert.deepEqual(out, [{ kind: "review", saleId: "s1" }]);
});

test("two separate shoppers, each with their own sale, both match", () => {
  const sales = [sale("s1", 1), sale("s2", 40)];
  const scans = [scan("c1", "alice", 0), scan("c2", "bob", 39)];
  const out = matchSales(sales, scans, { now: at(41) });
  assert.deepEqual(out.map((d) => [d.kind, d.saleId, d.customerId]), [
    ["match", "s1", "alice"],
    ["match", "s2", "bob"],
  ]);
});
